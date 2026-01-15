import 'reactflow/dist/style.css';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ReactFlowProvider, applyNodeChanges, applyEdgeChanges } from 'reactflow';

import WorkflowCanvas from './components/WorkflowCanvas';
import NodePalette from './components/NodePalette';
import { NodeProperties, ExecutionsPanel } from './components/SharedComponents';
import WorkflowErrorBoundary from './components/WorkflowErrorBoundary';
import { createTriggerNode, createActionNode, createLogicNode, NodeTypes } from './utils/nodeFactory';
import { migrateWorkflow, convertToLegacyFormat } from './utils/workflowMigration';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

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
                            className={`px-2 py-1 rounded text-xs ${workflow.enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
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

// Node drop offset constants
const NODE_DROP_OFFSET = { x: 100, y: 40 };

// Workflow Designer Component
function WorkflowDesigner({
    workflow,
    setWorkflow,
    onSave,
    onBack,
    availablePlugins,
    executions,
    saving = false,
}) {
    const [nodes, setNodes] = useState(workflow.nodes || []);
    const [edges, setEdges] = useState(workflow.edges || []);
    const [selectedNode, setSelectedNode] = useState(null);
    const [showExecutions, setShowExecutions] = useState(false);
    const reactFlowWrapper = useRef(null);

    // Handle drop from palette
    const onDrop = useCallback((event) => {
        event.preventDefault();

        const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
        const data = JSON.parse(event.dataTransfer.getData('application/reactflow'));

        const position = {
            x: event.clientX - reactFlowBounds.left - NODE_DROP_OFFSET.x,
            y: event.clientY - reactFlowBounds.top - NODE_DROP_OFFSET.y,
        };

        let newNode;
        if (data.nodeType === NodeTypes.TRIGGER) {
            newNode = createTriggerNode(position, data.nodeData.triggerType, data.nodeData);
        } else if (data.nodeType === NodeTypes.ACTION) {
            newNode = createActionNode(position, data.nodeData.plugin, data.nodeData.action, data.nodeData);
        } else if (data.nodeType === NodeTypes.LOGIC) {
            newNode = createLogicNode(position, data.nodeData.logicType, data.nodeData);
        }

        if (newNode) {
            setNodes((nds) => [...nds, newNode]);
        }
    }, []);

    const onDragOver = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    // Handle node click
    const handleNodeClick = useCallback((event, node) => {
        setSelectedNode(node);
    }, []);

    // Handle pane click (deselect)
    const handlePaneClick = useCallback(() => {
        setSelectedNode(null);
    }, []);

    // Handle node changes using React Flow's utility
    const handleNodesChange = useCallback((changes) => {
        setNodes((nds) => applyNodeChanges(changes, nds));
    }, []);

    // Handle edge changes using React Flow's utility
    const handleEdgesChange = useCallback((changes) => {
        setEdges((eds) => applyEdgeChanges(changes, eds));
    }, []);

    // Handle new connections
    const handleConnect = useCallback((connection) => {
        setEdges((eds) => [...eds, connection]);
    }, []);

    // Update node
    const handleNodeUpdate = useCallback((nodeId, updates) => {
        setNodes((nds) =>
            nds.map((node) =>
                node.id === nodeId ? { ...node, ...updates } : node
            )
        );
        if (selectedNode?.id === nodeId) {
            setSelectedNode((prev) => ({ ...prev, ...updates }));
        }
    }, [selectedNode]);

    // Handle save
    const handleSave = async () => {
        const workflowData = {
            ...workflow,
            nodes,
            edges,
        };
        await onSave(workflowData);
    };

    // Sync nodes/edges with workflow
    useEffect(() => {
        setNodes(workflow.nodes || []);
        setEdges(workflow.edges || []);
    }, [workflow]);

    return (
        <div className="flex gap-4 h-[calc(100vh-200px)]">
            {/* Node Palette */}
            <NodePalette availablePlugins={availablePlugins} />

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
                            onClick={handleSave}
                            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={saving}
                        >
                            {saving ? '💾 Saving...' : '💾 Save'}
                        </button>
                        <button
                            onClick={onBack}
                            className="px-4 py-2 bg-glass border border-glass-border text-text-main rounded-lg hover:bg-glass-hover transition-all"
                        >
                            ← Back
                        </button>
                    </div>
                </div>

                {/* Canvas Area */}
                <div
                    ref={reactFlowWrapper}
                    className="flex-1 bg-glass backdrop-blur-xl border border-glass-border rounded-xl overflow-hidden"
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                >
                    <WorkflowCanvas
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={handleNodesChange}
                        onEdgesChange={handleEdgesChange}
                        onConnect={handleConnect}
                        onNodeClick={handleNodeClick}
                        onPaneClick={handlePaneClick}
                    />
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
                    onUpdate={(updates) => handleNodeUpdate(selectedNode.id, updates)}
                    onClose={() => setSelectedNode(null)}
                    availablePlugins={availablePlugins}
                />
            )}
        </div>
    );
}

// Main Workflow Engine Component
function WorkflowEngine() {
    const [workflows, setWorkflows] = useState([]);
    const [currentWorkflow, setCurrentWorkflow] = useState(null);
    const [executions, setExecutions] = useState([]);
    const [availablePlugins, setAvailablePlugins] = useState([]);
    const [view, setView] = useState('list');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            await Promise.all([
                fetchWorkflows(),
                fetchAvailablePlugins()
            ]);
            setLoading(false);
        };
        loadData();
    }, []);

    useEffect(() => {
        if (currentWorkflow?.id) {
            fetchExecutions(currentWorkflow.id);
        }
    }, [currentWorkflow]);

    const fetchWorkflows = async () => {
        try {
            const res = await fetch(`${API_BASE}/plugins/workflow-engine/workflows`);
            if (!res.ok) {
                console.warn('Workflow engine API not available');
                setWorkflows([]);
                return;
            }
            const data = await res.json();
            // Handle both array and object responses
            const workflowsArray = Array.isArray(data) ? data : [];
            // Migrate workflows to new format
            const migratedWorkflows = workflowsArray.map(migrateWorkflow);
            setWorkflows(migratedWorkflows);
        } catch (error) {
            console.error('Failed to fetch workflows:', error);
            setWorkflows([]);
        }
    };

    const fetchAvailablePlugins = async () => {
        try {
            const res = await fetch(`${API_BASE}/plugins/workflow-engine/available-plugins`);
            if (!res.ok) {
                console.warn('Available plugins API not available');
                setAvailablePlugins([]);
                return;
            }
            const data = await res.json();
            setAvailablePlugins(data.plugins || []);
        } catch (error) {
            console.error('Failed to fetch plugins:', error);
            setAvailablePlugins([]);
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
            edges: [],
            reactFlowVersion: '1.0',
        });
        setView('designer');
    };

    const loadWorkflow = (workflow) => {
        const migratedWorkflow = migrateWorkflow(workflow);
        setCurrentWorkflow(migratedWorkflow);
        setView('designer');
    };

    const saveWorkflow = async (workflowData) => {
        setSaving(true);
        try {
            // Convert to legacy format for API
            const legacyWorkflow = convertToLegacyFormat(workflowData);

            const method = currentWorkflow.id ? 'PUT' : 'POST';
            const url = currentWorkflow.id
                ? `${API_BASE}/plugins/workflow-engine/workflows/${currentWorkflow.id}`
                : `${API_BASE}/plugins/workflow-engine/workflows`;

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(legacyWorkflow)
            });

            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }

            const savedWorkflow = await res.json();
            const migratedSaved = migrateWorkflow(savedWorkflow);
            setCurrentWorkflow(migratedSaved);
            await fetchWorkflows();

            // Success notification
            const message = currentWorkflow.id ? 'Workflow updated successfully!' : 'Workflow created successfully!';
            console.log('✅', message);
        } catch (error) {
            console.error('Failed to save workflow:', error);
            console.error('❌ Failed to save workflow:', error.message);
        } finally {
            setSaving(false);
        }
    };

    const executeWorkflow = async (workflowId) => {
        try {
            const res = await fetch(`${API_BASE}/plugins/workflow-engine/workflows/${workflowId}/execute`, {
                method: 'POST'
            });

            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }

            await res.json();
            console.log('✅ Workflow executed successfully!');
            await fetchExecutions(workflowId);
        } catch (error) {
            console.error('Failed to execute workflow:', error);
            console.error('❌ Failed to execute workflow:', error.message);
        }
    };

    const deleteWorkflow = async (workflowId) => {
        if (!confirm('Are you sure you want to delete this workflow?')) return;

        try {
            const res = await fetch(`${API_BASE}/plugins/workflow-engine/workflows/${workflowId}`, {
                method: 'DELETE'
            });

            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }

            await fetchWorkflows();
            if (currentWorkflow?.id === workflowId) {
                setCurrentWorkflow(null);
                setView('list');
            }
            console.log('✅ Workflow deleted successfully!');
        } catch (error) {
            console.error('Failed to delete workflow:', error);
            console.error('❌ Failed to delete workflow:', error.message);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col h-full bg-bg-dark text-text-main p-6">
                <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                        <p className="text-text-muted">Loading workflow engine...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <ReactFlowProvider>
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
                            className={`px-4 py-2 rounded-lg transition-all ${view === 'list'
                                ? 'bg-primary text-white'
                                : 'bg-glass border border-glass-border text-text-main hover:bg-glass-hover'
                                }`}
                        >
                            📋 Workflows
                        </button>
                        <button
                            onClick={createNewWorkflow}
                            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-all"
                            disabled={saving}
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
                        onSave={saveWorkflow}
                        onBack={() => setView('list')}
                        availablePlugins={availablePlugins}
                        executions={executions}
                        saving={saving}
                    />
                )}
            </div>
        </ReactFlowProvider>
    );
}

// Wrap with error boundary
function WorkflowEngineWithErrorBoundary() {
    return (
        <WorkflowErrorBoundary>
            <WorkflowEngine />
        </WorkflowErrorBoundary>
    );
}

export default WorkflowEngineWithErrorBoundary;

