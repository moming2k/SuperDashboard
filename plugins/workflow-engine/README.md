# Workflow Engine Plugin

A powerful workflow automation plugin for SuperDashboard that enables visual workflow design, cron-based scheduling, and plugin orchestration.

## Features

- **Visual Workflow Designer**: Drag-and-drop interface inspired by n8n
- **Cron Scheduling**: Schedule workflows to run automatically using cron expressions
- **Plugin Orchestration**: Chain actions across different plugins (AI Agent, WhatsApp, Jira, etc.)
- **Execution Logging**: View detailed execution history and logs
- **Conditional Logic**: Add if/else conditions to control workflow flow
- **Data Transformation**: Transform and merge data between workflow steps
- **Real-time Monitoring**: Monitor workflow executions in real-time

## Installation

The plugin is automatically discovered by SuperDashboard. Just ensure the backend dependencies are installed:

```bash
cd backend
pip install -r requirements.txt
```

Required dependencies:
- APScheduler >= 3.10.4
- httpx >= 0.27.0
- sqlalchemy >= 2.0.0

## Usage

### Creating a Workflow

1. Click the "Workflows" tab in the sidebar
2. Click "New Workflow" button
3. Drag nodes from the palette onto the canvas
4. Connect nodes by clicking the right handle (output) and then the left handle (input) of another node
5. Configure node properties by clicking on a node
6. Set a cron schedule (optional) for automatic execution
7. Click "Save" to save the workflow

### Node Types

#### Basic Nodes

- **Trigger (⚡)**: Starting point for workflows (can be scheduled or manual)
- **Delay (⏱️)**: Add a delay between steps (in seconds)
- **Condition (❓)**: Add if/else logic based on conditions
- **Transform (🔄)**: Transform or merge data between steps

#### Plugin Action Nodes

Plugin action nodes call APIs from other plugins:

- **AI Agent**: Ask questions to GPT-4
- **WhatsApp**: Send messages, get conversations
- **Jira**: Get issues, update status

### Cron Expression Format

Schedule workflows using standard cron syntax:

```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-6, Sunday=0)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

**Examples:**
- `0 9 * * *` - Run at 9:00 AM every day
- `*/30 * * * *` - Run every 30 minutes
- `0 0 * * 0` - Run at midnight every Sunday
- `0 8 * * 1-5` - Run at 8:00 AM Monday through Friday

### Example Workflows

#### 1. Daily WhatsApp Summary

**Description**: Get AI-generated summary and send it via WhatsApp every morning

**Nodes:**
1. Trigger (Schedule: `0 9 * * *`)
2. AI Agent - Ask AI (Input: "Summarize today's tasks")
3. WhatsApp - Send Message (Input: `{{ai_response}}`, To: "+1234567890")

**Setup:**
1. Add Trigger node
2. Add AI Agent node, set parameters:
   ```json
   {
     "messages": [
       {"role": "user", "content": "Give me a brief summary of what I should focus on today"}
     ]
   }
   ```
3. Add WhatsApp node, set parameters:
   ```json
   {
     "to": "1234567890",
     "body": "{{node_ai_agent.response}}"
   }
   ```
4. Connect: Trigger → AI Agent → WhatsApp
5. Set schedule to `0 9 * * *` (9 AM daily)
6. Enable and save

#### 2. Jira Issue Notification

**Description**: Check Jira for high-priority issues and send WhatsApp notification

**Nodes:**
1. Trigger (Schedule: `0 */2 * * *` - every 2 hours)
2. Jira - Get Issues
3. Condition - Check if issues exist
4. WhatsApp - Send Message (if condition true)

#### 3. AI-Powered Task Automation

**Description**: Get WhatsApp messages, process with AI, and respond

**Nodes:**
1. Trigger (Schedule: `*/5 * * * *` - every 5 minutes)
2. WhatsApp - Get Messages
3. AI Agent - Process message
4. WhatsApp - Send Response

### Variable Substitution

Use `{{variable}}` syntax to reference data from previous nodes:

- `{{node_id.field}}` - Access specific field from a node's output
- `{{node_id}}` - Access entire node output

**Example:**
```json
{
  "body": "Hello! The AI said: {{ai_agent_node.response}}"
}
```

### Node Configuration

#### Plugin Action Nodes

Configure plugin actions by setting the parameters in JSON format:

**AI Agent - Ask:**
```json
{
  "messages": [
    {"role": "user", "content": "Your question here"}
  ]
}
```

**WhatsApp - Send Message:**
```json
{
  "to": "1234567890",
  "body": "Your message text"
}
```

**Jira - Get Issues:**
```json
{}
```

#### Condition Nodes

Configure conditions with:
- **Left Value**: Variable or value to compare (e.g., `{{node_id.status}}`)
- **Operator**: `equals`, `not_equals`, `contains`, `greater_than`, `less_than`
- **Right Value**: Value to compare against

#### Transform Nodes

Configure transformations:
- **Type**: `set` or `merge`
- **Variable**: Variable name to set
- **Value**: Value or expression

## API Endpoints

### Workflows

- `GET /plugins/workflow-engine/workflows` - List all workflows
- `GET /plugins/workflow-engine/workflows/{id}` - Get workflow details
- `POST /plugins/workflow-engine/workflows` - Create workflow
- `PUT /plugins/workflow-engine/workflows/{id}` - Update workflow
- `DELETE /plugins/workflow-engine/workflows/{id}` - Delete workflow
- `POST /plugins/workflow-engine/workflows/{id}/execute` - Execute workflow manually
- `POST /plugins/workflow-engine/workflows/{id}/toggle` - Enable/disable workflow

### Executions

- `GET /plugins/workflow-engine/executions` - List executions
- `GET /plugins/workflow-engine/executions/{id}` - Get execution details

### Other

- `GET /plugins/workflow-engine/scheduled` - List scheduled workflows
- `GET /plugins/workflow-engine/available-plugins` - Get available plugin actions
- `GET /plugins/workflow-engine/health` - Health check

## Architecture

### Backend Components

1. **Models** (`models.py`): SQLAlchemy models for workflows and executions
2. **Executor** (`executor.py`): Workflow execution engine that traverses nodes
3. **Scheduler** (`scheduler.py`): APScheduler-based cron scheduling
4. **Main** (`main.py`): FastAPI router with API endpoints

### Frontend Components

1. **WorkflowEngine.jsx**: Main component with workflow list and designer
2. **WorkflowDesigner**: Visual canvas with drag-and-drop
3. **NodePalette**: Available nodes for dragging
4. **WorkflowNode**: Individual node component
5. **NodeProperties**: Node configuration panel
6. **ExecutionsPanel**: Execution history viewer

### Workflow Execution Flow

```
1. Trigger (schedule/manual) → Executor starts
2. Executor finds trigger node
3. Executor executes node (calls plugin API or performs action)
4. Executor follows edges to next nodes
5. Executor evaluates conditions and transforms data
6. Executor continues until no more nodes
7. Execution result saved to database
```

## Troubleshooting

### Workflows Not Executing on Schedule

- Check that the workflow is enabled
- Verify the cron expression is valid
- Check backend logs for scheduler errors
- Ensure APScheduler is running (`GET /health`)

### Plugin Action Fails

- Verify the plugin is enabled and configured
- Check plugin API endpoint is correct
- Ensure parameters match plugin requirements
- View execution logs for detailed error messages

### Variable Substitution Not Working

- Use correct syntax: `{{node_id.field}}`
- Ensure the source node has executed before the current node
- Check execution logs to see actual values

## Future Enhancements

- [ ] Webhook triggers
- [ ] Loop nodes for iteration
- [ ] Error handling nodes (try/catch)
- [ ] Parallel execution branches
- [ ] Workflow templates
- [ ] Export/import workflows
- [ ] Workflow versioning
- [ ] Visual execution debugger
- [ ] Subworkflows (call one workflow from another)
- [ ] Custom JavaScript expressions for transformations

## Contributing

To add new node types or features:

1. Add node type to `executor.py` in `_execute_node()` method
2. Add node type to `NodePalette` component
3. Add configuration UI in `NodeProperties` component
4. Update this README with usage instructions

## License

MIT - Same as SuperDashboard
