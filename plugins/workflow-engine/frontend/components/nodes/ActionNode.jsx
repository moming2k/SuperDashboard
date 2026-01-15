import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

const ActionNode = ({ data, selected, id }) => {
    const { label, plugin, action, icon, color } = data;

    const handleDelete = (e) => {
        e.stopPropagation();
        if (data.onDelete) {
            data.onDelete(id);
        }
    };

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
                    <div className="text-xs text-text-muted uppercase font-semibold">Action</div>
                    <div className="text-sm font-bold text-text-main">{label}</div>
                </div>
            </div>

            {/* Plugin Name */}
            {plugin && (
                <div className="bg-primary/20 text-primary text-xs px-2 py-1 rounded inline-block">
                    {plugin}
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

            {/* Configuration Indicator */}
            {data.configured === false && (
                <div className="absolute bottom-2 right-2 text-yellow-500 text-xs">
                    ⚠️
                </div>
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

export default memo(ActionNode);
