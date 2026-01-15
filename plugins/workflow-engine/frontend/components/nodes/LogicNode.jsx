import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { LogicNodeSubTypes } from '../../utils/nodeFactory';

const LogicNode = ({ data, selected, id }) => {
    const { label, logicType, icon, color } = data;

    const handleDelete = (e) => {
        e.stopPropagation();
        if (data.onDelete) {
            data.onDelete(id);
        }
    };

    // Get preview text based on logic type
    const getPreviewText = () => {
        if (logicType === LogicNodeSubTypes.DELAY && data.duration) {
            return `Wait ${data.duration}s`;
        }
        if (logicType === LogicNodeSubTypes.CONDITION && data.condition) {
            return data.condition;
        }
        if (logicType === LogicNodeSubTypes.TRANSFORM && data.code) {
            return 'Custom code';
        }
        return null;
    };

    const previewText = getPreviewText();

    return (
        <div
            className={`
        relative bg-glass backdrop-blur-xl border-2 rounded-xl p-4 min-w-[200px]
        transition-all duration-200
        ${selected ? 'border-primary shadow-lg shadow-primary/50' : 'border-glass-border'}
        hover:border-primary/50
      `}
        >
            {/* Delete Button - Only show when selected */}
            {selected && (
                <button
                    onClick={handleDelete}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all shadow-lg flex items-center justify-center z-10"
                    title="Delete node"
                >
                    <span className="text-xs">✕</span>
                </button>
            )}

            {/* Input Handle */}
            <Handle
                type="target"
                position={Position.Left}
                className="!w-3 !h-3 !bg-primary !border-2 !border-white"
                style={{ left: -6 }}
            />

            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center text-lg`}>
                    {icon}
                </div>
                <div className="flex-1">
                    <div className="text-xs text-text-muted uppercase font-semibold">Logic</div>
                    <div className="text-sm font-bold text-text-main">{label}</div>
                </div>
            </div>

            {/* Logic Type Badge */}
            <div className={`
        text-xs px-2 py-1 rounded inline-block
        ${logicType === 'delay' ? 'bg-yellow-500/20 text-yellow-400' : ''}
        ${logicType === 'condition' ? 'bg-blue-500/20 text-blue-400' : ''}
        ${logicType === 'transform' ? 'bg-purple-500/20 text-purple-400' : ''}
      `}>
                {logicType}
            </div>

            {/* Preview for specific logic types */}
            {logicType === 'delay' && data.delay && (
                <div className="mt-2 text-xs text-text-muted">
                    ⏱️ {data.delay}ms
                </div>
            )}

            {logicType === 'condition' && data.condition && (
                <div className="mt-2 text-xs text-text-muted truncate">
                    {data.condition}
                </div>
            )}

            {/* Status Indicators */}
            {data.status && (
                <div className={`
          absolute top-2 right-2 w-3 h-3 rounded-full
          ${data.status === 'running' ? 'bg-blue-500 animate-pulse' : ''}
          ${data.status === 'success' ? 'bg-green-500' : ''}
          ${data.status === 'error' ? 'bg-red-500' : ''}
        `} />
            )}

            {/* Output Handle */}
            <Handle
                type="source"
                position={Position.Right}
                className="!w-3 !h-3 !bg-primary !border-2 !border-white"
                style={{ right: -6 }}
            />
        </div>
    );
};

export default memo(LogicNode);
