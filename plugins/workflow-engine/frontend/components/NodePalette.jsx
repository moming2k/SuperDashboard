import React, { useState } from 'react';
import { NodeTypes, TriggerSubTypes, LogicNodeSubTypes } from '../utils/nodeFactory';

const NodePalette = ({ availablePlugins = [], onNodeDragStart }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [collapsed, setCollapsed] = useState(false);

    const triggerTypes = [
        {
            type: TriggerSubTypes.SCHEDULE,
            label: 'Schedule (Cron)',
            icon: '⏰',
            color: 'bg-green-500',
            description: 'Trigger on a schedule'
        },
        {
            type: TriggerSubTypes.WEBHOOK,
            label: 'Webhook',
            icon: '🔔',
            color: 'bg-green-500',
            description: 'Trigger via HTTP webhook'
        },
        {
            type: TriggerSubTypes.MANUAL,
            label: 'Manual',
            icon: '👆',
            color: 'bg-green-500',
            description: 'Trigger manually'
        },
    ];

    const logicNodes = [
        {
            type: LogicNodeSubTypes.DELAY,
            label: 'Delay',
            icon: '⏱️',
            color: 'bg-yellow-500',
            description: 'Wait for a duration'
        },
        {
            type: LogicNodeSubTypes.CONDITION,
            label: 'Condition',
            icon: '❓',
            color: 'bg-blue-500',
            description: 'Branch based on condition'
        },
        {
            type: LogicNodeSubTypes.TRANSFORM,
            label: 'Code',
            icon: '💻',
            color: 'bg-purple-500',
            description: 'Transform data with code'
        },
    ];

    const handleDragStart = (event, nodeType, nodeData) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('application/reactflow', JSON.stringify({ nodeType, nodeData }));

        if (onNodeDragStart) {
            onNodeDragStart({ nodeType, nodeData });
        }
    };

    const filterItems = (items) => {
        if (!searchTerm) return items;
        return items.filter(item =>
            item.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.description?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    };

    if (collapsed) {
        return (
            <div className="w-12 bg-glass backdrop-blur-xl border border-glass-border rounded-xl p-2">
                <button
                    onClick={() => setCollapsed(false)}
                    className="w-full h-8 flex items-center justify-center text-text-main hover:bg-glass-hover rounded transition-all"
                    title="Expand palette"
                >
                    ▶️
                </button>
            </div>
        );
    }

    return (
        <div className="w-72 bg-glass backdrop-blur-xl border border-glass-border rounded-xl p-4 overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-text-main">Node Palette</h3>
                <button
                    onClick={() => setCollapsed(true)}
                    className="text-text-muted hover:text-text-main transition-all"
                    title="Collapse palette"
                >
                    ◀️
                </button>
            </div>

            {/* Search */}
            <input
                type="text"
                placeholder="Search nodes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-bg-card border border-glass-border rounded-lg px-3 py-2 text-sm text-text-main mb-4 focus:outline-none focus:border-primary"
            />

            {/* Trigger Nodes */}
            <div className="mb-6">
                <p className="text-sm text-text-muted mb-2 font-semibold">⚡ Triggers</p>
                {filterItems(triggerTypes).map((trigger) => (
                    <div
                        key={trigger.type}
                        draggable
                        onDragStart={(e) => handleDragStart(e, NodeTypes.TRIGGER, { triggerType: trigger.type })}
                        className="bg-bg-card border border-glass-border rounded-lg p-3 mb-2 cursor-move hover:border-primary transition-all"
                    >
                        <div className="flex items-center gap-2">
                            <span className={`w-8 h-8 ${trigger.color} rounded flex items-center justify-center text-sm flex-shrink-0`}>
                                {trigger.icon}
                            </span>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-text-main">{trigger.label}</div>
                                <div className="text-xs text-text-muted truncate">{trigger.description}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Logic Nodes */}
            <div className="mb-6">
                <p className="text-sm text-text-muted mb-2 font-semibold">🔧 Logic</p>
                {filterItems(logicNodes).map((node) => (
                    <div
                        key={node.type}
                        draggable
                        onDragStart={(e) => handleDragStart(e, NodeTypes.LOGIC, { logicType: node.type })}
                        className="bg-bg-card border border-glass-border rounded-lg p-3 mb-2 cursor-move hover:border-primary transition-all"
                    >
                        <div className="flex items-center gap-2">
                            <span className={`w-8 h-8 ${node.color} rounded flex items-center justify-center text-sm flex-shrink-0`}>
                                {node.icon}
                            </span>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-text-main">{node.label}</div>
                                <div className="text-xs text-text-muted truncate">{node.description}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Plugin Actions */}
            <div>
                <p className="text-sm text-text-muted mb-2 font-semibold">🔌 Plugin Actions</p>
                {availablePlugins.map((plugin) => (
                    <div key={plugin.name} className="mb-4">
                        <p className="text-xs font-medium text-text-main mb-2">
                            {plugin.icon} {plugin.displayName}
                        </p>
                        {plugin.actions?.filter(action =>
                            !searchTerm ||
                            action.name.toLowerCase().includes(searchTerm.toLowerCase())
                        ).map((action) => (
                            <div
                                key={action.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, NodeTypes.ACTION, {
                                    plugin: plugin.name,
                                    action: action.endpoint,
                                    method: action.method,
                                    actionName: action.name,
                                    actionId: action.id,
                                    icon: plugin.icon,
                                })}
                                className="bg-bg-card border border-glass-border rounded-lg p-2 mb-2 cursor-move hover:border-primary transition-all"
                            >
                                <div className="text-xs text-text-main">{action.name}</div>
                                {action.description && (
                                    <div className="text-xs text-text-muted truncate mt-1">{action.description}</div>
                                )}
                            </div>
                        ))}
                    </div>
                ))}

                {availablePlugins.length === 0 && (
                    <div className="text-xs text-text-muted text-center py-4">
                        No plugins available
                    </div>
                )}
            </div>
        </div>
    );
};

export default NodePalette;
