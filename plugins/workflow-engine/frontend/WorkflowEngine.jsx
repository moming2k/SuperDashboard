import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { formatDistanceToNow, format } from 'date-fns';
import { z } from 'zod';

const API_BASE = 'http://localhost:8000';

// Zod validation schemas
const CronRegex = /^(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)$/;

const WorkflowSchema = z.object({
  name: z.string().min(1, "Workflow name is required").max(100, "Name too long"),
  description: z.string().max(500, "Description too long").optional(),
  enabled: z.boolean(),
  schedule: z.string().regex(CronRegex, "Invalid cron expression (format: minute hour day month day_of_week)").optional().or(z.literal('')),
  nodes: z.array(z.any()).min(1, "Workflow must have at least one node"),
  edges: z.array(z.any())
}).refine((data) => {
  // If schedule is provided and workflow is enabled, it should be valid
  if (data.enabled && data.schedule && data.schedule.length > 0) {
    return CronRegex.test(data.schedule);
  }
  return true;
}, {
  message: "Enabled workflows with schedules must have valid cron expressions",
  path: ["schedule"]
});

function WorkflowEngine() {
  const [workflows, setWorkflows] = useState([]);
  const [currentWorkflow, setCurrentWorkflow] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [availablePlugins, setAvailablePlugins] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [view, setView] = useState('list');
  const [draggedPaletteNode, setDraggedPaletteNode] = useState(null);
  const [connectionStart, setConnectionStart] = useState(null);
  const [tempConnection, setTempConnection] = useState(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    fetchWorkflows();
    fetchAvailablePlugins();
  }, []);

  useEffect(() => {
    if (currentWorkflow) {
      fetchExecutions(currentWorkflow.id);
    }
  }, [currentWorkflow]);

  const fetchWorkflows = async () => {
    try {
      const res = await fetch(`${API_BASE}/plugins/workflow-engine/workflows`);
      const data = await res.json();
      setWorkflows(data);
    } catch (error) {
      console.error('Failed to fetch workflows:', error);
    }
  };

  const fetchAvailablePlugins = async () => {
    try {
      const res = await fetch(`${API_BASE}/plugins/workflow-engine/available-plugins`);
      const data = await res.json();
      setAvailablePlugins(data.plugins || []);
    } catch (error) {
      console.error('Failed to fetch plugins:', error);
    }
  };

  const fetchExecutions = async (workflowId) => {
    try {
      const res = await fetch(`${API_BASE}/plugins/workflow-engine/executions?workflow_id=${workflowId}`);
      const data = await res.json();
      setExecutions(data);
    } catch (error) {
      console.error('Failed to fetch executions:', error);
    }
  };

  const createNewWorkflow = () => {
    setCurrentWorkflow({
      name: 'New Workflow',
      description: '',
      enabled: true,
      schedule: '',
      nodes: [],
      edges: []
    });
    setNodes([]);
    setEdges([]);
    setView('designer');
  };

  const loadWorkflow = (workflow) => {
    setCurrentWorkflow(workflow);
    setNodes(workflow.nodes || []);
    setEdges(workflow.edges || []);
    setView('designer');
  };

  const saveWorkflow = async () => {
    try {
      const workflowData = {
        ...currentWorkflow,
        nodes,
        edges
      };

      // Validate with Zod
      try {
        WorkflowSchema.parse(workflowData);
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          const errorMessages = validationError.errors.map(err => `${err.path.join('.')}: ${err.message}`).join('\n');
          alert(`Validation failed:\n\n${errorMessages}`);
          return;
        }
        throw validationError;
      }

      const method = currentWorkflow.id ? 'PUT' : 'POST';
      const url = currentWorkflow.id
        ? `${API_BASE}/plugins/workflow-engine/workflows/${currentWorkflow.id}`
        : `${API_BASE}/plugins/workflow-engine/workflows`;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflowData)
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const savedWorkflow = await res.json();
      setCurrentWorkflow(savedWorkflow);
      fetchWorkflows();
      alert('✅ Workflow saved successfully!');
    } catch (error) {
      console.error('Failed to save workflow:', error);
      alert(`❌ Failed to save workflow: ${error.message}`);
    }
  };

  const executeWorkflow = async (workflowId) => {
    try {
      const res = await fetch(`${API_BASE}/plugins/workflow-engine/workflows/${workflowId}/execute`, {
        method: 'POST'
      });
      const execution = await res.json();
      alert('Workflow executed successfully!');
      fetchExecutions(workflowId);
    } catch (error) {
      console.error('Failed to execute workflow:', error);
      alert('Failed to execute workflow');
    }
  };

  const deleteWorkflow = async (workflowId) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;

    try {
      await fetch(`${API_BASE}/plugins/workflow-engine/workflows/${workflowId}`, {
        method: 'DELETE'
      });
      fetchWorkflows();
      if (currentWorkflow?.id === workflowId) {
        setCurrentWorkflow(null);
        setView('list');
      }
    } catch (error) {
      console.error('Failed to delete workflow:', error);
      alert('Failed to delete workflow');
    }
  };

  const updateNode = (nodeId, updates) => {
    setNodes(nodes.map(node =>
      node.id === nodeId ? { ...node, ...updates } : node
    ));
  };

  const deleteNode = (nodeId) => {
    setNodes(nodes.filter(node => node.id !== nodeId));
    setEdges(edges.filter(edge => edge.source !== nodeId && edge.target !== nodeId));
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }
  };

  const handleCanvasDrop = (e) => {
    e.preventDefault();
    if (!draggedPaletteNode) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newNode = {
      id: `node_${Date.now()}`,
      type: draggedPaletteNode.type,
      position: { x, y },
      data: draggedPaletteNode.data || {}
    };

    setNodes([...nodes, newNode]);
    setDraggedPaletteNode(null);
  };

  const startConnection = useCallback((nodeId, event) => {
    event.stopPropagation();
    setConnectionStart(nodeId);

    const updateTempConnection = (e) => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setTempConnection({ x, y });
      }
    };

    const endConnection = () => {
      setConnectionStart(null);
      setTempConnection(null);
      document.removeEventListener('mousemove', updateTempConnection);
      document.removeEventListener('mouseup', endConnection);
    };

    document.addEventListener('mousemove', updateTempConnection);
    document.addEventListener('mouseup', endConnection);
  }, []);

  const completeConnection = useCallback((targetNodeId, event) => {
    event.stopPropagation();
    if (connectionStart && connectionStart !== targetNodeId) {
      const newEdge = {
        id: `edge_${Date.now()}`,
        source: connectionStart,
        target: targetNodeId
      };
      setEdges([...edges, newEdge]);
    }
    setConnectionStart(null);
    setTempConnection(null);
  }, [connectionStart, edges]);

  return (
    <div className="flex flex-col h-full bg-bg-dark text-text-main p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            ⚙️ Workflow Engine
          </h1>
          <p className="text-text-muted mt-1">Design and automate workflows across plugins</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setView('list')}
            className={`px-4 py-2 rounded-lg transition-all ${
              view === 'list'
                ? 'bg-primary text-white'
                : 'bg-glass border border-glass-border text-text-main hover:bg-glass-hover'
            }`}
          >
            📋 Workflows
          </button>
          <button
            onClick={createNewWorkflow}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-all"
          >
            ➕ New Workflow
          </button>
        </div>
      </div>

      {/* Main Content */}
      {view === 'list' && (
        <WorkflowList
          workflows={workflows}
          onLoad={loadWorkflow}
          onExecute={executeWorkflow}
          onDelete={deleteWorkflow}
        />
      )}

      {view === 'designer' && currentWorkflow && (
        <WorkflowDesigner
          workflow={currentWorkflow}
          setWorkflow={setCurrentWorkflow}
          nodes={nodes}
          setNodes={setNodes}
          edges={edges}
          setEdges={setEdges}
          onSave={saveWorkflow}
          onUpdateNode={updateNode}
          onDeleteNode={deleteNode}
          availablePlugins={availablePlugins}
          selectedNode={selectedNode}
          setSelectedNode={setSelectedNode}
          canvasRef={canvasRef}
          draggedPaletteNode={draggedPaletteNode}
          setDraggedPaletteNode={setDraggedPaletteNode}
          onCanvasDrop={handleCanvasDrop}
          executions={executions}
          setView={setView}
          connectionStart={connectionStart}
          tempConnection={tempConnection}
          startConnection={startConnection}
          completeConnection={completeConnection}
        />
      )}
    </div>
  );
}

// Workflow List Component
function WorkflowList({ workflows, onLoad, onExecute, onDelete }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {workflows.map(workflow => (
        <div
          key={workflow.id}
          className="bg-glass backdrop-blur-xl border border-glass-border rounded-xl p-6 hover:border-primary transition-all"
        >
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-xl font-bold">{workflow.name}</h3>
            <span
              className={`px-2 py-1 rounded text-xs ${
                workflow.enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
              }`}
            >
              {workflow.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>

          <p className="text-text-muted text-sm mb-4">{workflow.description || 'No description'}</p>

          {workflow.schedule && (
            <div className="bg-bg-card rounded p-2 mb-4 text-sm">
              <span className="text-text-muted">Schedule:</span> <code>{workflow.schedule}</code>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => onLoad(workflow)}
              className="flex-1 px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-all text-sm"
            >
              ✏️ Edit
            </button>
            <button
              onClick={() => onExecute(workflow.id)}
              className="flex-1 px-3 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-all text-sm"
            >
              ▶️ Run
            </button>
            <button
              onClick={() => onDelete(workflow.id)}
              className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all text-sm"
            >
              🗑️
            </button>
          </div>
        </div>
      ))}

      {workflows.length === 0 && (
        <div className="col-span-full text-center py-12 text-text-muted">
          <p className="text-lg">No workflows yet</p>
          <p className="text-sm mt-2">Create your first workflow to get started</p>
        </div>
      )}
    </div>
  );
}

// Workflow Designer Component
function WorkflowDesigner({
  workflow,
  setWorkflow,
  nodes,
  setNodes,
  edges,
  setEdges,
  onSave,
  onUpdateNode,
  onDeleteNode,
  availablePlugins,
  selectedNode,
  setSelectedNode,
  canvasRef,
  draggedPaletteNode,
  setDraggedPaletteNode,
  onCanvasDrop,
  executions,
  setView,
  connectionStart,
  tempConnection,
  startConnection,
  completeConnection
}) {
  const [showNodePalette, setShowNodePalette] = useState(true);
  const [showExecutions, setShowExecutions] = useState(false);

  return (
    <div className="flex gap-4 h-[calc(100vh-200px)]">
      {/* Node Palette */}
      {showNodePalette && (
        <NodePalette
          availablePlugins={availablePlugins}
          setDraggedPaletteNode={setDraggedPaletteNode}
        />
      )}

      {/* Canvas */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Toolbar */}
        <div className="bg-glass backdrop-blur-xl border border-glass-border rounded-xl p-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <input
              type="text"
              value={workflow.name}
              onChange={(e) => setWorkflow({ ...workflow, name: e.target.value })}
              className="bg-bg-card border border-glass-border rounded-lg px-4 py-2 text-text-main"
              placeholder="Workflow name"
            />
            <input
              type="text"
              value={workflow.schedule || ''}
              onChange={(e) => setWorkflow({ ...workflow, schedule: e.target.value })}
              className="bg-bg-card border border-glass-border rounded-lg px-4 py-2 text-text-main text-sm"
              placeholder="Cron: 0 9 * * * (optional)"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={workflow.enabled}
                onChange={(e) => setWorkflow({ ...workflow, enabled: e.target.checked })}
                className="rounded"
              />
              Enabled
            </label>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowExecutions(!showExecutions)}
              className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-all text-sm"
            >
              📊 Executions ({executions.length})
            </button>
            <button
              onClick={onSave}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-all"
            >
              💾 Save
            </button>
            <button
              onClick={() => setView('list')}
              className="px-4 py-2 bg-glass border border-glass-border text-text-main rounded-lg hover:bg-glass-hover transition-all"
            >
              ← Back
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div
          ref={canvasRef}
          className="flex-1 bg-glass backdrop-blur-xl border border-glass-border rounded-xl relative overflow-auto"
          onDrop={onCanvasDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => setSelectedNode(null)}
          style={{ minHeight: '500px' }}
        >
          {/* Grid background */}
          <div className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)',
              backgroundSize: '20px 20px'
            }}
          />

          {/* Edges and Connections */}
          <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 10 3, 0 6" fill="#6366f1" />
              </marker>
            </defs>

            {/* Existing edges */}
            {edges.map(edge => {
              const sourceNode = nodes.find(n => n.id === edge.source);
              const targetNode = nodes.find(n => n.id === edge.target);
              if (!sourceNode || !targetNode) return null;

              const x1 = sourceNode.position.x + 150;
              const y1 = sourceNode.position.y + 40;
              const x2 = targetNode.position.x;
              const y2 = targetNode.position.y + 40;

              const midX = (x1 + x2) / 2;

              return (
                <g key={edge.id}>
                  <path
                    d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                    stroke="#6366f1"
                    strokeWidth="2"
                    fill="none"
                    markerEnd="url(#arrowhead)"
                  />
                </g>
              );
            })}

            {/* Temporary connection line while dragging */}
            {connectionStart && tempConnection && (
              <path
                d={`M ${nodes.find(n => n.id === connectionStart).position.x + 150} ${nodes.find(n => n.id === connectionStart).position.y + 40} L ${tempConnection.x} ${tempConnection.y}`}
                stroke="#a855f7"
                strokeWidth="2"
                strokeDasharray="5,5"
                fill="none"
              />
            )}
          </svg>

          {/* Nodes */}
          {nodes.map(node => (
            <WorkflowNode
              key={node.id}
              node={node}
              isSelected={selectedNode?.id === node.id}
              isConnecting={connectionStart === node.id}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedNode(node);
              }}
              onDelete={() => onDeleteNode(node.id)}
              onUpdate={(updates) => onUpdateNode(node.id, updates)}
              onStartConnection={(e) => startConnection(node.id, e)}
              onCompleteConnection={(e) => completeConnection(node.id, e)}
              setNodes={setNodes}
              nodes={nodes}
            />
          ))}

          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-text-muted pointer-events-none">
              <div className="text-center">
                <p className="text-lg">Drag nodes from the palette to start building</p>
                <p className="text-sm mt-2">Drag from the right handle to connect nodes</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Executions Panel */}
      {showExecutions && (
        <ExecutionsPanel
          executions={executions}
          onClose={() => setShowExecutions(false)}
        />
      )}

      {/* Node Properties */}
      {selectedNode && !showExecutions && (
        <NodeProperties
          node={selectedNode}
          onUpdate={(updates) => onUpdateNode(selectedNode.id, updates)}
          onClose={() => setSelectedNode(null)}
          availablePlugins={availablePlugins}
        />
      )}
    </div>
  );
}

// CodeEditor Component with CodeMirror
function CodeEditor({ value, onChange, language = 'javascript', placeholder = '' }) {
  const editorRef = useRef(null);
  const viewRef = useRef(null);

  useEffect(() => {
    if (!editorRef.current) return;

    // Clean up existing view
    if (viewRef.current) {
      viewRef.current.destroy();
    }

    // Create new editor view
    const view = new EditorView({
      doc: value || '',
      extensions: [
        basicSetup,
        javascript(),
        oneDark,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          "&": {
            fontSize: "13px",
            borderRadius: "0.5rem",
            overflow: "hidden"
          },
          ".cm-scroller": {
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
          }
        })
      ],
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, []); // Only run once on mount

  // Update content when value changes externally
  useEffect(() => {
    if (viewRef.current && value !== viewRef.current.state.doc.toString()) {
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: viewRef.current.state.doc.length,
          insert: value || ''
        }
      });
    }
  }, [value]);

  return (
    <div className="border border-glass-border rounded-lg overflow-hidden">
      <div ref={editorRef} />
      {placeholder && !value && (
        <div className="absolute inset-0 pointer-events-none p-3 text-text-muted text-sm opacity-50">
          {placeholder}
        </div>
      )}
    </div>
  );
}

// Node Palette Component
function NodePalette({ availablePlugins, setDraggedPaletteNode }) {
  const triggerTypes = [
    { type: 'schedule', label: 'Schedule (Cron)', icon: '⏰', color: 'bg-green-500', data: { triggerType: 'schedule' } },
    { type: 'webhook', label: 'Webhook', icon: '🔔', color: 'bg-blue-500', data: { triggerType: 'webhook' } },
    { type: 'manual', label: 'Manual', icon: '👆', color: 'bg-purple-500', data: { triggerType: 'manual' } }
  ];

  const logicNodes = [
    { type: 'delay', label: 'Delay', icon: '⏱️', color: 'bg-yellow-500' },
    { type: 'condition', label: 'Condition', icon: '❓', color: 'bg-blue-500' },
    { type: 'transform', label: 'Code', icon: '💻', color: 'bg-purple-500' }
  ];

  return (
    <div className="w-64 bg-glass backdrop-blur-xl border border-glass-border rounded-xl p-4 overflow-y-auto">
      <h3 className="text-lg font-bold mb-4">Node Palette</h3>

      {/* Trigger Nodes */}
      <div className="mb-6">
        <p className="text-sm text-text-muted mb-2 font-semibold">⚡ Triggers</p>
        {triggerTypes.map(trigger => (
          <div
            key={trigger.type}
            draggable
            onDragStart={() => setDraggedPaletteNode({ type: 'trigger', data: trigger.data })}
            className="bg-bg-card border border-glass-border rounded-lg p-3 mb-2 cursor-move hover:border-primary transition-all"
          >
            <div className="flex items-center gap-2">
              <span className={`w-8 h-8 ${trigger.color} rounded flex items-center justify-center text-sm`}>
                {trigger.icon}
              </span>
              <span className="text-sm font-medium">{trigger.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Logic Nodes */}
      <div className="mb-6">
        <p className="text-sm text-text-muted mb-2 font-semibold">🔧 Logic</p>
        {logicNodes.map(nodeType => (
          <div
            key={nodeType.type}
            draggable
            onDragStart={() => setDraggedPaletteNode({ type: nodeType.type, data: {} })}
            className="bg-bg-card border border-glass-border rounded-lg p-3 mb-2 cursor-move hover:border-primary transition-all"
          >
            <div className="flex items-center gap-2">
              <span className={`w-8 h-8 ${nodeType.color} rounded flex items-center justify-center text-sm`}>
                {nodeType.icon}
              </span>
              <span className="text-sm font-medium">{nodeType.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Plugin Actions */}
      <div>
        <p className="text-sm text-text-muted mb-2 font-semibold">🔌 Plugin Actions</p>
        {availablePlugins.map(plugin => (
          <div key={plugin.name} className="mb-4">
            <p className="text-xs font-medium mb-2">{plugin.icon} {plugin.displayName}</p>
            {plugin.actions?.map(action => (
              <div
                key={action.id}
                draggable
                onDragStart={() => setDraggedPaletteNode({
                  type: 'plugin-action',
                  data: {
                    plugin: plugin.name,
                    action: action.endpoint,
                    method: action.method,
                    actionName: action.name,
                    actionId: action.id,
                    parameters: {}
                  }
                })}
                className="bg-bg-card border border-glass-border rounded-lg p-2 mb-2 cursor-move hover:border-primary transition-all"
              >
                <span className="text-xs">{action.name}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Workflow Node Component
function WorkflowNode({
  node,
  isSelected,
  isConnecting,
  onClick,
  onDelete,
  onUpdate,
  onStartConnection,
  onCompleteConnection,
  setNodes,
  nodes
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const nodeRef = useRef(null);

  const getNodeColor = (type) => {
    const colors = {
      trigger: 'bg-green-500',
      'plugin-action': 'bg-primary',
      condition: 'bg-blue-500',
      delay: 'bg-yellow-500',
      transform: 'bg-purple-500'
    };
    return colors[type] || 'bg-gray-500';
  };

  const getNodeIcon = (type, data) => {
    if (type === 'trigger') {
      const icons = {
        schedule: '⏰',
        webhook: '🔔',
        manual: '👆'
      };
      return icons[data?.triggerType] || '⚡';
    }
    const icons = {
      'plugin-action': '🔌',
      condition: '❓',
      delay: '⏱️',
      transform: '💻'
    };
    return icons[type] || '📦';
  };

  const getNodeLabel = (node) => {
    if (node.type === 'trigger') {
      const labels = {
        schedule: 'Schedule',
        webhook: 'Webhook',
        manual: 'Manual'
      };
      return labels[node.data?.triggerType] || 'Trigger';
    }
    if (node.type === 'plugin-action') {
      return node.data?.actionName || 'Plugin Action';
    }
    if (node.type === 'transform') {
      return 'Code';
    }
    return node.type.charAt(0).toUpperCase() + node.type.slice(1);
  };

  const handleMouseDown = (e) => {
    if (e.target.closest('.node-handle')) return;
    e.stopPropagation();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;

      onUpdate({
        position: {
          x: node.position.x + deltaX,
          y: node.position.y + deltaY
        }
      });

      setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart, node.position, onUpdate]);

  return (
    <div
      ref={nodeRef}
      className={`absolute bg-bg-card border-2 rounded-xl p-3 transition-all ${
        isSelected ? 'border-primary shadow-lg shadow-primary/50 z-20' : 'border-glass-border z-10'
      } ${isConnecting ? 'ring-2 ring-accent' : ''} ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{
        left: node.position.x,
        top: node.position.y,
        width: '150px'
      }}
      onClick={onClick}
      onMouseDown={handleMouseDown}
    >
      {/* Node Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-6 h-6 ${getNodeColor(node.type)} rounded flex items-center justify-center text-xs flex-shrink-0`}>
          {getNodeIcon(node.type, node.data)}
        </span>
        <span className="text-xs font-medium flex-1 truncate">{getNodeLabel(node)}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-red-400 hover:text-red-300 text-xs"
        >
          ✕
        </button>
      </div>

      {/* Connection Handles */}
      <div className="flex justify-between mt-2 relative">
        {/* Input handle (left) */}
        <button
          className="node-handle w-4 h-4 bg-blue-500 rounded-full hover:scale-125 transition-all cursor-pointer absolute left-[-8px] top-[50%] translate-y-[-50%]"
          onMouseUp={onCompleteConnection}
          title="Connect from another node"
          style={{ zIndex: 50 }}
        />
        {/* Output handle (right) */}
        <button
          className="node-handle w-4 h-4 bg-accent rounded-full hover:scale-125 transition-all cursor-pointer absolute right-[-8px] top-[50%] translate-y-[-50%]"
          onMouseDown={onStartConnection}
          title="Drag to connect to another node"
          style={{ zIndex: 50 }}
        />
      </div>
    </div>
  );
}

// Node Properties Panel
function NodeProperties({ node, onUpdate, onClose, availablePlugins }) {
  const [data, setData] = useState(node.data || {});

  useEffect(() => {
    setData(node.data || {});
  }, [node]);

  const handleUpdate = () => {
    onUpdate({ data });
  };

  return (
    <div className="w-96 bg-glass backdrop-blur-xl border border-glass-border rounded-xl p-4 overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">Node Properties</h3>
        <button onClick={onClose} className="text-text-muted hover:text-text-main">✕</button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-text-muted mb-1">Type</label>
          <div className="bg-bg-card rounded-lg px-3 py-2 text-sm">{node.type}</div>
        </div>

        {/* Trigger Node Configuration */}
        {node.type === 'trigger' && (
          <>
            <div>
              <label className="block text-sm text-text-muted mb-1">Trigger Type</label>
              <select
                value={data.triggerType || 'schedule'}
                onChange={(e) => setData({ ...data, triggerType: e.target.value })}
                className="w-full bg-bg-card border border-glass-border rounded-lg px-3 py-2"
              >
                <option value="schedule">Schedule (Cron)</option>
                <option value="webhook">Webhook</option>
                <option value="manual">Manual</option>
              </select>
            </div>

            {data.triggerType === 'webhook' && (
              <div>
                <label className="block text-sm text-text-muted mb-1">Webhook Source</label>
                <select
                  value={data.webhookPlugin || ''}
                  onChange={(e) => setData({ ...data, webhookPlugin: e.target.value })}
                  className="w-full bg-bg-card border border-glass-border rounded-lg px-3 py-2"
                >
                  <option value="">Select plugin...</option>
                  <option value="whatsapp">WhatsApp (incoming message)</option>
                  <option value="jira">Jira (issue update)</option>
                  <option value="custom">Custom webhook URL</option>
                </select>
                {data.webhookPlugin && (
                  <p className="text-xs text-text-muted mt-2">
                    Webhook URL: /plugins/workflow-engine/webhook/{node.id}
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {/* Plugin Action Configuration */}
        {node.type === 'plugin-action' && (
          <>
            <div>
              <label className="block text-sm text-text-muted mb-1">Plugin</label>
              <div className="bg-bg-card rounded-lg px-3 py-2 text-sm">{data.plugin}</div>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Action</label>
              <div className="bg-bg-card rounded-lg px-3 py-2 text-sm">{data.actionName}</div>
            </div>

            {/* Special handling for AI Agent */}
            {data.actionId === 'ask' && (
              <div>
                <label className="block text-sm text-text-muted mb-1 font-semibold">🤖 AI Prompt Template</label>
                <textarea
                  value={data.promptTemplate || ''}
                  onChange={(e) => setData({ ...data, promptTemplate: e.target.value })}
                  className="w-full bg-bg-card border border-glass-border rounded-lg px-3 py-2 text-sm font-mono"
                  rows={8}
                  placeholder="Enter your prompt. Use {{node_id.field}} to insert data from previous nodes.

Example:
Please analyze this WhatsApp message:
{{whatsapp_node.body}}

And provide a summary."
                />
                <div className="bg-bg-card border border-glass-border rounded p-2 text-xs text-text-muted mt-2">
                  <p className="font-semibold mb-1">💡 Tip:</p>
                  <p>Use <code className="text-accent">{'{{node_id.field}}'}</code> to reference previous node outputs</p>
                  <p className="mt-1">Example: <code className="text-accent">{'{{whatsapp_node.body}}'}</code> or <code className="text-accent">{'{{jira_node.issues}}'}</code></p>
                </div>
              </div>
            )}

            {/* Standard parameters */}
            {data.actionId !== 'ask' && (
              <div>
                <label className="block text-sm text-text-muted mb-1">Parameters (JSON)</label>
                <textarea
                  value={JSON.stringify(data.parameters || {}, null, 2)}
                  onChange={(e) => {
                    try {
                      const params = JSON.parse(e.target.value);
                      setData({ ...data, parameters: params });
                    } catch (err) {
                      // Invalid JSON, keep editing
                    }
                  }}
                  className="w-full bg-bg-card border border-glass-border rounded-lg px-3 py-2 text-sm font-mono"
                  rows={6}
                  placeholder='{\n  "to": "{{upstream.phone}}",\n  "body": "{{ai.response}}"\n}'
                />
                <p className="text-xs text-text-muted mt-1">
                  Use <code>{'{{node_id.field}}'}</code> for variable substitution
                </p>
              </div>
            )}
          </>
        )}

        {/* Delay Node */}
        {node.type === 'delay' && (
          <div>
            <label className="block text-sm text-text-muted mb-1">Delay (seconds)</label>
            <input
              type="number"
              value={data.delay || 1}
              onChange={(e) => setData({ ...data, delay: parseInt(e.target.value) })}
              className="w-full bg-bg-card border border-glass-border rounded-lg px-3 py-2"
              min="1"
            />
          </div>
        )}

        {/* Condition Node */}
        {node.type === 'condition' && (
          <>
            <div>
              <label className="block text-sm text-text-muted mb-1">Left Value</label>
              <input
                type="text"
                value={data.leftValue || ''}
                onChange={(e) => setData({ ...data, leftValue: e.target.value })}
                className="w-full bg-bg-card border border-glass-border rounded-lg px-3 py-2"
                placeholder="{{node_id.field}}"
              />
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Operator</label>
              <select
                value={data.operator || 'equals'}
                onChange={(e) => setData({ ...data, operator: e.target.value })}
                className="w-full bg-bg-card border border-glass-border rounded-lg px-3 py-2"
              >
                <option value="equals">Equals (==)</option>
                <option value="not_equals">Not Equals (!=)</option>
                <option value="contains">Contains</option>
                <option value="greater_than">Greater Than ({'>'})</option>
                <option value="less_than">Less Than ({'<'})</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Right Value</label>
              <input
                type="text"
                value={data.rightValue || ''}
                onChange={(e) => setData({ ...data, rightValue: e.target.value })}
                className="w-full bg-bg-card border border-glass-border rounded-lg px-3 py-2"
                placeholder="value or {{node_id.field}}"
              />
            </div>
          </>
        )}

        {/* Transform/Code Node */}
        {node.type === 'transform' && (
          <>
            <div>
              <label className="block text-sm text-text-muted mb-1 font-semibold">💻 Code (JavaScript)</label>
              <div className="mb-2">
                <CodeEditor
                  value={data.code || ''}
                  onChange={(newCode) => setData({ ...data, code: newCode })}
                  language="javascript"
                />
              </div>
              <div className="bg-bg-card border border-glass-border rounded p-2 text-xs text-text-muted space-y-1">
                <p className="font-semibold">Available variables:</p>
                <p>• <code className="text-primary">input</code> - Previous node output</p>
                <p>• <code className="text-primary">context</code> - All node outputs</p>
                <p className="mt-2 font-semibold">Example:</p>
                <code className="block bg-bg-dark p-2 rounded mt-1">
                  const phone = input.from_number;<br/>
                  return {'{ phone }'};
                </code>
              </div>
            </div>
          </>
        )}

        <button
          onClick={handleUpdate}
          className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-all"
        >
          Update Node
        </button>
      </div>
    </div>
  );
}

// Executions Panel
function ExecutionsPanel({ executions, onClose }) {
  const [selectedExecution, setSelectedExecution] = useState(null);

  const getStatusColor = (status) => {
    const colors = {
      completed: 'text-green-400',
      failed: 'text-red-400',
      running: 'text-yellow-400',
      pending: 'text-gray-400'
    };
    return colors[status] || 'text-gray-400';
  };

  return (
    <div className="w-96 bg-glass backdrop-blur-xl border border-glass-border rounded-xl p-4 overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">Execution History</h3>
        <button onClick={onClose} className="text-text-muted hover:text-text-main">✕</button>
      </div>

      {executions.length === 0 ? (
        <p className="text-text-muted text-sm">No executions yet</p>
      ) : (
        <div className="space-y-2">
          {executions.map(execution => (
            <div
              key={execution.id}
              className="bg-bg-card border border-glass-border rounded-lg p-3 cursor-pointer hover:border-primary transition-all"
              onClick={() => setSelectedExecution(selectedExecution?.id === execution.id ? null : execution)}
            >
              <div className="flex justify-between items-start mb-2">
                <span className={`text-sm font-medium ${getStatusColor(execution.status)}`}>
                  {execution.status.toUpperCase()}
                </span>
                <div className="text-xs text-text-muted text-right">
                  <div>{formatDistanceToNow(new Date(execution.start_time), { addSuffix: true })}</div>
                  <div className="text-[10px] opacity-70">{format(new Date(execution.start_time), 'MMM d, h:mm a')}</div>
                </div>
              </div>

              {selectedExecution?.id === execution.id && (
                <div className="mt-3 pt-3 border-t border-glass-border">
                  <p className="text-xs text-text-muted mb-2">Execution Logs:</p>
                  <div className="bg-bg-dark rounded p-2 max-h-48 overflow-y-auto">
                    {execution.logs?.map((log, idx) => (
                      <div key={idx} className="text-xs mb-1">
                        <span className={`font-mono ${
                          log.level === 'error' ? 'text-red-400' :
                          log.level === 'warning' ? 'text-yellow-400' :
                          'text-text-muted'
                        }`}>
                          [{log.level}] {log.message}
                        </span>
                      </div>
                    ))}
                  </div>
                  {execution.error && (
                    <div className="mt-2 p-2 bg-red-500/20 border border-red-500/50 rounded text-xs text-red-400">
                      {execution.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default WorkflowEngine;
