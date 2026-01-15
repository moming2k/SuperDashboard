import React, { useCallback } from 'react';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    addEdge,
    MarkerType,
} from 'reactflow';

import { nodeTypes } from './nodes';
import CustomEdge from './edges/CustomEdge';

const edgeTypes = {
    custom: CustomEdge,
};

const WorkflowCanvas = ({
    nodes = [],
    edges = [],
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeClick,
    onPaneClick,
    readOnly = false,
}) => {
    // Handle new connections
    const handleConnect = useCallback((params) => {
        const newEdge = {
            ...params,
            type: 'custom',
            markerEnd: {
                type: MarkerType.ArrowClosed,
                color: '#6366f1',
            },
            data: {},
        };

        if (onConnect) {
            onConnect(newEdge);
        }
    }, [onConnect]);

    return (
        <div className="w-full h-full">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={handleConnect}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                fitViewOptions={{
                    padding: 0.2,
                    minZoom: 0.5,
                    maxZoom: 1.5,
                }}
                nodesDraggable={!readOnly}
                nodesConnectable={!readOnly}
                elementsSelectable={!readOnly}
                className="bg-bg-dark"
                defaultEdgeOptions={{
                    type: 'custom',
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        color: '#6366f1',
                    },
                }}
            >
                <Background
                    color="#6366f1"
                    gap={20}
                    size={1}
                    variant="dots"
                    className="opacity-20"
                />
                <Controls
                    className="bg-glass backdrop-blur-xl border border-glass-border rounded-lg"
                    showInteractive={false}
                />
                <MiniMap
                    className="bg-glass backdrop-blur-xl border border-glass-border rounded-lg"
                    nodeColor={(node) => {
                        if (node.type === 'trigger') return '#10b981';
                        if (node.type === 'action') return '#6366f1';
                        if (node.type === 'logic') return '#a855f7';
                        return '#6b7280';
                    }}
                    maskColor="rgba(0, 0, 0, 0.6)"
                />
            </ReactFlow>
        </div>
    );
};

export default WorkflowCanvas;
