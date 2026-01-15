import React from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from 'reactflow';

const CustomEdge = ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    data,
    markerEnd,
}) => {
    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    const status = data?.status;

    // Determine edge color based on status
    const getEdgeColor = () => {
        if (status === 'success') return '#10b981'; // green
        if (status === 'error') return '#ef4444'; // red
        if (status === 'running') return '#3b82f6'; // blue
        if (status === 'pinned') return '#a855f7'; // purple
        return '#6366f1'; // default primary
    };

    const edgeColor = getEdgeColor();

    return (
        <>
            <BaseEdge
                path={edgePath}
                markerEnd={markerEnd}
                style={{
                    ...style,
                    stroke: edgeColor,
                    strokeWidth: 2,
                    animation: status === 'running' ? 'dash 1s linear infinite' : 'none',
                    strokeDasharray: status === 'running' ? '5,5' : 'none',
                }}
            />

            {/* Edge Label */}
            {data?.label && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                            fontSize: 10,
                            pointerEvents: 'all',
                        }}
                        className="bg-bg-card border border-glass-border rounded px-2 py-1 text-text-muted"
                    >
                        {data.label}
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
};

export default CustomEdge;
