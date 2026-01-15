// Migration utilities for converting old workflow format to React Flow format

import { NodeTypes } from './nodeFactory';

/**
 * Convert old workflow format to React Flow format
 * @param {Object} oldWorkflow - Old workflow object
 * @returns {Object} - Converted workflow with React Flow format
 */
export const migrateWorkflow = (oldWorkflow) => {
    if (!oldWorkflow) return null;

    // Check if already in new format
    if (oldWorkflow.reactFlowVersion) {
        return oldWorkflow;
    }

    const nodes = (oldWorkflow.nodes || []).map(migrateNode);
    const edges = (oldWorkflow.edges || []).map(migrateEdge);

    return {
        ...oldWorkflow,
        nodes,
        edges,
        reactFlowVersion: '1.0',
    };
};

/**
 * Migrate a single node to React Flow format
 */
const migrateNode = (oldNode) => {
    // If already in new format, return as-is
    if (oldNode.type && [NodeTypes.TRIGGER, NodeTypes.ACTION, NodeTypes.LOGIC].includes(oldNode.type)) {
        return oldNode;
    }

    // Determine node type from old data
    let type = NodeTypes.ACTION;
    let data = { ...oldNode.data };

    if (oldNode.type === 'trigger') {
        type = NodeTypes.TRIGGER;
        data = {
            ...data,
            triggerType: oldNode.data?.triggerType || 'manual',
        };
    } else if (['delay', 'condition', 'transform'].includes(oldNode.type)) {
        type = NodeTypes.LOGIC;
        data = {
            ...data,
            logicType: oldNode.type,
        };
    } else if (oldNode.type === 'plugin-action') {
        type = NodeTypes.ACTION;
    }

    return {
        id: oldNode.id,
        type,
        position: oldNode.position || { x: 0, y: 0 },
        data: {
            ...data,
            id: oldNode.id,
        },
    };
};

/**
 * Migrate a single edge to React Flow format
 */
const migrateEdge = (oldEdge) => {
    return {
        id: oldEdge.id,
        source: oldEdge.source,
        target: oldEdge.target,
        sourceHandle: oldEdge.sourceHandle || null,
        targetHandle: oldEdge.targetHandle || null,
        type: 'custom',
        data: oldEdge.data || {},
    };
};

/**
 * Convert React Flow format back to old format for API compatibility
 */
export const convertToLegacyFormat = (workflow) => {
    if (!workflow) return null;

    const nodes = (workflow.nodes || []).map(node => ({
        id: node.id,
        type: node.type === NodeTypes.TRIGGER ? 'trigger' :
            node.type === NodeTypes.LOGIC ? node.data.logicType :
                'plugin-action',
        position: node.position,
        data: node.data,
    }));

    const edges = (workflow.edges || []).map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
    }));

    return {
        ...workflow,
        nodes,
        edges,
    };
};
