import httpx
import json
from datetime import datetime
from typing import Dict, Any, List, Optional
import asyncio
import re


class WorkflowExecutor:
    """Executes workflows by traversing nodes and calling plugin APIs"""

    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.execution_context = {}  # Store variables between nodes

    async def execute_workflow(
        self,
        workflow_id: str,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
        trigger_type: str = "manual"
    ) -> Dict[str, Any]:
        """
        Execute a workflow starting from trigger nodes

        Args:
            workflow_id: Workflow identifier
            nodes: List of workflow nodes
            edges: List of workflow edges
            trigger_type: How the workflow was triggered

        Returns:
            Execution result with logs and output
        """
        logs = []
        result = {}

        try:
            # Find trigger node (should be first node or node with type 'trigger')
            trigger_nodes = [n for n in nodes if n.get('type') == 'trigger']

            if not trigger_nodes:
                # If no explicit trigger, start with the first node
                trigger_nodes = [nodes[0]] if nodes else []

            if not trigger_nodes:
                return {
                    'status': 'failed',
                    'logs': [{'timestamp': datetime.utcnow().isoformat(), 'message': 'No trigger node found', 'level': 'error'}],
                    'result': None
                }

            # Execute starting from trigger node
            for trigger_node in trigger_nodes:
                logs.append({
                    'timestamp': datetime.utcnow().isoformat(),
                    'message': f"Starting workflow execution from node: {trigger_node.get('id')}",
                    'level': 'info'
                })

                result = await self._execute_node_chain(trigger_node, nodes, edges, logs)

            return {
                'status': 'completed',
                'logs': logs,
                'result': result
            }

        except Exception as e:
            logs.append({
                'timestamp': datetime.utcnow().isoformat(),
                'message': f"Workflow execution failed: {str(e)}",
                'level': 'error'
            })
            return {
                'status': 'failed',
                'logs': logs,
                'result': None,
                'error': str(e)
            }

    async def _execute_node_chain(
        self,
        current_node: Dict[str, Any],
        all_nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
        logs: List[Dict[str, Any]]
    ) -> Any:
        """Recursively execute nodes following edges"""

        node_id = current_node.get('id')
        node_type = current_node.get('type')

        logs.append({
            'timestamp': datetime.utcnow().isoformat(),
            'message': f"Executing node: {node_id} (type: {node_type})",
            'level': 'info'
        })

        # Execute current node
        node_result = await self._execute_node(current_node, logs)

        # Store result in context for next nodes
        self.execution_context[node_id] = node_result

        # Find outgoing edges from current node
        outgoing_edges = [e for e in edges if e.get('source') == node_id]

        # Execute next nodes
        next_results = []
        for edge in outgoing_edges:
            target_node_id = edge.get('target')
            target_node = next((n for n in all_nodes if n.get('id') == target_node_id), None)

            if target_node:
                # Check edge condition if exists
                if self._evaluate_edge_condition(edge, node_result):
                    result = await self._execute_node_chain(target_node, all_nodes, edges, logs)
                    next_results.append(result)

        # Return combined results
        if next_results:
            return next_results[-1]  # Return last result
        return node_result

    async def _execute_node(self, node: Dict[str, Any], logs: List[Dict[str, Any]]) -> Any:
        """Execute a single node based on its type"""

        node_type = node.get('type')
        node_id = node.get('id')
        config = node.get('data', {})

        try:
            if node_type == 'trigger':
                # Trigger nodes just pass through
                return {'triggered': True, 'timestamp': datetime.utcnow().isoformat()}

            elif node_type == 'plugin-action':
                # Execute plugin action
                return await self._execute_plugin_action(node, logs)

            elif node_type == 'condition':
                # Evaluate condition
                return await self._execute_condition(node, logs)

            elif node_type == 'delay':
                # Delay execution
                delay_seconds = config.get('delay', 1)
                logs.append({
                    'timestamp': datetime.utcnow().isoformat(),
                    'message': f"Delaying execution for {delay_seconds} seconds",
                    'level': 'info'
                })
                await asyncio.sleep(delay_seconds)
                return {'delayed': delay_seconds}

            elif node_type == 'transform':
                # Transform data
                return await self._execute_transform(node, logs)

            else:
                logs.append({
                    'timestamp': datetime.utcnow().isoformat(),
                    'message': f"Unknown node type: {node_type}",
                    'level': 'warning'
                })
                return None

        except Exception as e:
            logs.append({
                'timestamp': datetime.utcnow().isoformat(),
                'message': f"Error executing node {node_id}: {str(e)}",
                'level': 'error'
            })
            raise

    async def _execute_plugin_action(self, node: Dict[str, Any], logs: List[Dict[str, Any]]) -> Any:
        """Execute a plugin action by making HTTP request"""

        config = node.get('data', {})
        plugin_name = config.get('plugin')
        action = config.get('action')
        method = config.get('method', 'GET')
        action_id = config.get('actionId')
        params = config.get('parameters', {})

        # Special handling for AI Agent with prompt template
        if action_id == 'ask' and 'promptTemplate' in config:
            prompt_template = config.get('promptTemplate', '')
            # Replace variables in the prompt template
            processed_prompt = self._replace_variables(prompt_template)

            # Build messages array for AI
            params = {
                'messages': [
                    {'role': 'user', 'content': processed_prompt}
                ]
            }
            logs.append({
                'timestamp': datetime.utcnow().isoformat(),
                'message': f"Using prompt template with processed content (length: {len(processed_prompt)} chars)",
                'level': 'info'
            })
        else:
            # Replace variable placeholders in parameters
            params = self._replace_variables(params)

        url = f"{self.base_url}/plugins/{plugin_name}{action}"

        logs.append({
            'timestamp': datetime.utcnow().isoformat(),
            'message': f"Calling plugin API: {method} {url}",
            'level': 'info'
        })

        async with httpx.AsyncClient() as client:
            if method.upper() == 'GET':
                response = await client.get(url, params=params, timeout=30.0)
            elif method.upper() == 'POST':
                response = await client.post(url, json=params, timeout=30.0)
            elif method.upper() == 'PUT':
                response = await client.put(url, json=params, timeout=30.0)
            elif method.upper() == 'DELETE':
                response = await client.delete(url, timeout=30.0)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")

            response.raise_for_status()
            result = response.json()

            logs.append({
                'timestamp': datetime.utcnow().isoformat(),
                'message': f"Plugin API response: {response.status_code}",
                'level': 'info'
            })

            return result

    async def _execute_condition(self, node: Dict[str, Any], logs: List[Dict[str, Any]]) -> bool:
        """Evaluate a condition node"""

        config = node.get('data', {})
        condition_type = config.get('conditionType', 'always')

        if condition_type == 'always':
            return True

        # Add more condition types as needed (equals, contains, greater_than, etc.)
        left_value = self._replace_variables(config.get('leftValue'))
        right_value = self._replace_variables(config.get('rightValue'))
        operator = config.get('operator', 'equals')

        if operator == 'equals':
            return left_value == right_value
        elif operator == 'not_equals':
            return left_value != right_value
        elif operator == 'contains':
            return right_value in str(left_value)
        elif operator == 'greater_than':
            return float(left_value) > float(right_value)
        elif operator == 'less_than':
            return float(left_value) < float(right_value)

        return False

    async def _execute_transform(self, node: Dict[str, Any], logs: List[Dict[str, Any]]) -> Any:
        """Transform data using JavaScript code or expressions"""

        config = node.get('data', {})

        # Check if this is a code-based transform
        if 'code' in config and config.get('code'):
            return await self._execute_javascript_transform(config, logs)

        # Legacy transform types
        transform_type = config.get('transformType', 'set')

        if transform_type == 'set':
            # Set a variable
            variable_name = config.get('variable')
            value = self._replace_variables(config.get('value'))
            self.execution_context[variable_name] = value
            return {variable_name: value}

        elif transform_type == 'merge':
            # Merge multiple values
            sources = config.get('sources', [])
            merged = {}
            for source in sources:
                source_value = self._replace_variables(source)
                if isinstance(source_value, dict):
                    merged.update(source_value)
            return merged

        return None

    async def _execute_javascript_transform(self, config: Dict[str, Any], logs: List[Dict[str, Any]]) -> Any:
        """
        Execute JavaScript code for data transformation.

        NOTE: This is a simplified Python-based implementation.
        For full JavaScript support, integrate PyMiniRacer or similar.

        The code can access:
        - input: output from previous node
        - context: all node outputs
        """
        code = config.get('code', '')

        if not code:
            return None

        logs.append({
            'timestamp': datetime.utcnow().isoformat(),
            'message': f"Executing transform code (length: {len(code)} chars)",
            'level': 'info'
        })

        try:
            # Prepare execution context with previous node data
            # Get the last non-trigger node's output as 'input'
            input_data = None
            for node_id in reversed(list(self.execution_context.keys())):
                if node_id != 'trigger':
                    input_data = self.execution_context.get(node_id)
                    break

            # Create a safe execution environment
            # NOTE: In production, use PyMiniRacer or similar for actual JS execution
            # This is a simplified version that handles common patterns

            result = self._evaluate_simple_javascript(code, input_data, self.execution_context)

            logs.append({
                'timestamp': datetime.utcnow().isoformat(),
                'message': f"Transform code executed successfully",
                'level': 'info'
            })

            return result

        except Exception as e:
            logs.append({
                'timestamp': datetime.utcnow().isoformat(),
                'message': f"Error executing transform code: {str(e)}",
                'level': 'error'
            })
            raise

    def _evaluate_simple_javascript(self, code: str, input_data: Any, context: Dict[str, Any]) -> Any:
        """
        Evaluate simple JavaScript-like code patterns.

        Supported patterns:
        - return { key: value };
        - const x = input.field; return { x };
        - if (condition) { return {...} }

        NOTE: This is NOT a full JavaScript interpreter.
        For production, use PyMiniRacer or similar.
        """

        # For now, implement basic Python execution with restricted globals
        # Replace JavaScript syntax with Python equivalents

        # Convert common JS patterns to Python
        python_code = code
        python_code = python_code.replace('const ', '')
        python_code = python_code.replace('let ', '')
        python_code = python_code.replace('var ', '')
        python_code = python_code.replace('===', '==')
        python_code = python_code.replace('!==', '!=')

        # Create safe execution environment
        safe_globals = {
            '__builtins__': {
                'len': len,
                'str': str,
                'int': int,
                'float': float,
                'bool': bool,
                'list': list,
                'dict': dict,
                'range': range,
                'enumerate': enumerate,
                'zip': zip,
                'map': map,
                'filter': filter,
                'sum': sum,
                'max': max,
                'min': min,
                'abs': abs,
                'round': round,
                'sorted': sorted,
                'reversed': reversed,
                'any': any,
                'all': all,
            },
            'input': input_data,
            'context': context,
            'json': json,
        }

        # Execute the code
        local_vars = {}
        exec(python_code, safe_globals, local_vars)

        # Return the result (last assigned variable or explicit return)
        if 'return' in python_code:
            # Try to extract return value
            for var_name, var_value in local_vars.items():
                if var_name != '__builtins__':
                    return var_value

        return local_vars if local_vars else None

    def _evaluate_edge_condition(self, edge: Dict[str, Any], node_result: Any) -> bool:
        """Evaluate if edge condition is met"""

        condition = edge.get('condition')
        if not condition:
            return True  # No condition, always pass

        # Evaluate condition based on node result
        # For now, simple boolean check
        if isinstance(node_result, bool):
            return node_result

        return True

    def _replace_variables(self, value: Any) -> Any:
        """Replace variable placeholders like {{node_id.field}} with actual values"""

        if isinstance(value, str):
            # Replace {{variable}} with actual value from context
            if value.startswith('{{') and value.endswith('}}'):
                var_path = value[2:-2].strip()
                return self._get_context_value(var_path)
            return value

        elif isinstance(value, dict):
            return {k: self._replace_variables(v) for k, v in value.items()}

        elif isinstance(value, list):
            return [self._replace_variables(v) for v in value]

        return value

    def _get_context_value(self, path: str) -> Any:
        """Get value from execution context using dot notation"""

        parts = path.split('.')
        value = self.execution_context

        for part in parts:
            if isinstance(value, dict):
                value = value.get(part)
            else:
                return None

        return value
