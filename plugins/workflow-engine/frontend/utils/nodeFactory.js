// Node factory for creating workflow nodes with proper defaults

export const NodeTypes = {
    TRIGGER: 'trigger',
    ACTION: 'action',
    LOGIC: 'logic',
};

export const LogicNodeSubTypes = {
    DELAY: 'delay',
    CONDITION: 'condition',
    TRANSFORM: 'transform',
};

export const TriggerSubTypes = {
    SCHEDULE: 'schedule',
    WEBHOOK: 'webhook',
    MANUAL: 'manual',
};

// Icon mapping for different node types
export const getNodeIcon = (type, subType, data) => {
    if (type === NodeTypes.TRIGGER) {
        const icons = {
            [TriggerSubTypes.SCHEDULE]: '⏰',
            [TriggerSubTypes.WEBHOOK]: '🔔',
            [TriggerSubTypes.MANUAL]: '👆',
        };
        return icons[subType] || '⚡';
    }

    if (type === NodeTypes.LOGIC) {
        const icons = {
            [LogicNodeSubTypes.DELAY]: '⏱️',
            [LogicNodeSubTypes.CONDITION]: '❓',
            [LogicNodeSubTypes.TRANSFORM]: '💻',
        };
        return icons[subType] || '🔧';
    }

    if (type === NodeTypes.ACTION) {
        return data?.icon || '🔌';
    }

    return '📦';
};

// Color mapping for different node types
export const getNodeColor = (type, subType) => {
    if (type === NodeTypes.TRIGGER) {
        return 'bg-green-500';
    }

    if (type === NodeTypes.LOGIC) {
        const colors = {
            [LogicNodeSubTypes.DELAY]: 'bg-yellow-500',
            [LogicNodeSubTypes.CONDITION]: 'bg-blue-500',
            [LogicNodeSubTypes.TRANSFORM]: 'bg-purple-500',
        };
        return colors[subType] || 'bg-gray-500';
    }

    if (type === NodeTypes.ACTION) {
        return 'bg-primary';
    }

    return 'bg-gray-500';
};

// Create a new node with proper defaults
export const createNode = (type, position, data = {}) => {
    const id = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const baseNode = {
        id,
        type,
        position,
        data: {
            ...data,
            id,
        },
    };

    return baseNode;
};

// Create a trigger node
export const createTriggerNode = (position, triggerType, data = {}) => {
    return createNode(NodeTypes.TRIGGER, position, {
        label: `${triggerType.charAt(0).toUpperCase() + triggerType.slice(1)} Trigger`,
        triggerType,
        icon: getNodeIcon(NodeTypes.TRIGGER, triggerType),
        color: getNodeColor(NodeTypes.TRIGGER),
        ...data,
    });
};

// Create an action node
export const createActionNode = (position, plugin, action, data = {}) => {
    return createNode(NodeTypes.ACTION, position, {
        label: data.actionName || action,
        plugin,
        action,
        method: data.method || 'POST',
        parameters: data.parameters || {},
        icon: getNodeIcon(NodeTypes.ACTION, null, data),
        color: getNodeColor(NodeTypes.ACTION),
        ...data,
    });
};

// Create a logic node
export const createLogicNode = (position, logicType, data = {}) => {
    const labels = {
        [LogicNodeSubTypes.DELAY]: 'Delay',
        [LogicNodeSubTypes.CONDITION]: 'Condition',
        [LogicNodeSubTypes.TRANSFORM]: 'Code',
    };

    return createNode(NodeTypes.LOGIC, position, {
        label: labels[logicType] || logicType,
        logicType,
        icon: getNodeIcon(NodeTypes.LOGIC, logicType),
        color: getNodeColor(NodeTypes.LOGIC, logicType),
        ...data,
    });
};

// Get node label for display
export const getNodeLabel = (node) => {
    if (!node || !node.data) return 'Unknown';

    if (node.type === NodeTypes.TRIGGER) {
        return node.data.label || `${node.data.triggerType} Trigger`;
    }

    if (node.type === NodeTypes.ACTION) {
        return node.data.label || node.data.actionName || node.data.action;
    }

    if (node.type === NodeTypes.LOGIC) {
        return node.data.label || node.data.logicType;
    }

    return node.data.label || 'Node';
};
