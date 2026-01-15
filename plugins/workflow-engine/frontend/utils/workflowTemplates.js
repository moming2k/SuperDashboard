// Workflow Templates for quick start

export const workflowTemplates = [
    {
        id: 'whatsapp-auto-reply',
        name: 'WhatsApp Auto-Reply',
        description: 'Automatically reply to incoming WhatsApp messages',
        category: 'Communication',
        icon: '💬',
        workflow: {
            name: 'WhatsApp Auto-Reply',
            description: 'Automatically reply to incoming WhatsApp messages',
            enabled: true,
            schedule: '',
            nodes: [
                {
                    id: 'node_trigger_1',
                    type: 'trigger',
                    position: { x: 100, y: 200 },
                    data: {
                        id: 'node_trigger_1',
                        label: 'Webhook Trigger',
                        triggerType: 'webhook',
                        icon: '🔔',
                        color: 'bg-green-500',
                    },
                },
                {
                    id: 'node_condition_1',
                    type: 'logic',
                    position: { x: 350, y: 200 },
                    data: {
                        id: 'node_condition_1',
                        label: 'Check Message',
                        logicType: 'condition',
                        icon: '❓',
                        color: 'bg-blue-500',
                        condition: 'message.text.includes("help")',
                    },
                },
                {
                    id: 'node_action_1',
                    type: 'action',
                    position: { x: 600, y: 200 },
                    data: {
                        id: 'node_action_1',
                        label: 'Send Reply',
                        plugin: 'whatsapp',
                        action: 'send',
                        actionName: 'Send Message',
                        icon: '📱',
                        color: 'bg-primary',
                        parameters: {
                            message: 'Hello! How can I help you?',
                        },
                    },
                },
            ],
            edges: [
                {
                    id: 'edge_1',
                    source: 'node_trigger_1',
                    target: 'node_condition_1',
                    type: 'custom',
                },
                {
                    id: 'edge_2',
                    source: 'node_condition_1',
                    target: 'node_action_1',
                    type: 'custom',
                },
            ],
        },
    },
    {
        id: 'daily-report',
        name: 'Daily Report Generator',
        description: 'Generate and send daily reports automatically',
        category: 'Automation',
        icon: '📊',
        workflow: {
            name: 'Daily Report Generator',
            description: 'Generate and send daily reports automatically',
            enabled: true,
            schedule: '0 9 * * *', // 9 AM daily
            nodes: [
                {
                    id: 'node_trigger_1',
                    type: 'trigger',
                    position: { x: 100, y: 200 },
                    data: {
                        id: 'node_trigger_1',
                        label: 'Schedule Trigger',
                        triggerType: 'schedule',
                        icon: '⏰',
                        color: 'bg-green-500',
                    },
                },
                {
                    id: 'node_action_1',
                    type: 'action',
                    position: { x: 350, y: 150 },
                    data: {
                        id: 'node_action_1',
                        label: 'Get Data',
                        plugin: 'jira',
                        action: 'get-issues',
                        actionName: 'Get Issues',
                        icon: '📋',
                        color: 'bg-primary',
                        parameters: {
                            project: 'PROJ',
                            status: 'In Progress',
                        },
                    },
                },
                {
                    id: 'node_transform_1',
                    type: 'logic',
                    position: { x: 600, y: 150 },
                    data: {
                        id: 'node_transform_1',
                        label: 'Format Report',
                        logicType: 'transform',
                        icon: '💻',
                        color: 'bg-purple-500',
                        code: '// Format data into report\nreturn {\n  summary: data.length + " issues in progress",\n  details: data\n};',
                    },
                },
                {
                    id: 'node_action_2',
                    type: 'action',
                    position: { x: 850, y: 150 },
                    data: {
                        id: 'node_action_2',
                        label: 'Send Report',
                        plugin: 'ai-agent',
                        action: 'ask',
                        actionName: 'Generate Summary',
                        icon: '🤖',
                        color: 'bg-primary',
                        parameters: {
                            prompt: 'Create a summary report',
                        },
                    },
                },
            ],
            edges: [
                {
                    id: 'edge_1',
                    source: 'node_trigger_1',
                    target: 'node_action_1',
                    type: 'custom',
                },
                {
                    id: 'edge_2',
                    source: 'node_action_1',
                    target: 'node_transform_1',
                    type: 'custom',
                },
                {
                    id: 'edge_3',
                    source: 'node_transform_1',
                    target: 'node_action_2',
                    type: 'custom',
                },
            ],
        },
    },
    {
        id: 'data-transform',
        name: 'Data Transform Pipeline',
        description: 'Transform and process data through multiple steps',
        category: 'Data Processing',
        icon: '⚙️',
        workflow: {
            name: 'Data Transform Pipeline',
            description: 'Transform and process data through multiple steps',
            enabled: true,
            schedule: '',
            nodes: [
                {
                    id: 'node_trigger_1',
                    type: 'trigger',
                    position: { x: 100, y: 200 },
                    data: {
                        id: 'node_trigger_1',
                        label: 'Manual Trigger',
                        triggerType: 'manual',
                        icon: '👆',
                        color: 'bg-green-500',
                    },
                },
                {
                    id: 'node_transform_1',
                    type: 'logic',
                    position: { x: 350, y: 200 },
                    data: {
                        id: 'node_transform_1',
                        label: 'Transform Data',
                        logicType: 'transform',
                        icon: '💻',
                        color: 'bg-purple-500',
                        code: '// Transform input data\nreturn data.map(item => ({\n  ...item,\n  processed: true\n}));',
                    },
                },
                {
                    id: 'node_condition_1',
                    type: 'logic',
                    position: { x: 600, y: 200 },
                    data: {
                        id: 'node_condition_1',
                        label: 'Validate',
                        logicType: 'condition',
                        icon: '❓',
                        color: 'bg-blue-500',
                        condition: 'data.length > 0',
                    },
                },
            ],
            edges: [
                {
                    id: 'edge_1',
                    source: 'node_trigger_1',
                    target: 'node_transform_1',
                    type: 'custom',
                },
                {
                    id: 'edge_2',
                    source: 'node_transform_1',
                    target: 'node_condition_1',
                    type: 'custom',
                },
            ],
        },
    },
    {
        id: 'conditional-notification',
        name: 'Conditional Notification',
        description: 'Send notifications based on specific conditions',
        category: 'Notifications',
        icon: '🔔',
        workflow: {
            name: 'Conditional Notification',
            description: 'Send notifications based on specific conditions',
            enabled: true,
            schedule: '*/30 * * * *', // Every 30 minutes
            nodes: [
                {
                    id: 'node_trigger_1',
                    type: 'trigger',
                    position: { x: 100, y: 200 },
                    data: {
                        id: 'node_trigger_1',
                        label: 'Schedule Trigger',
                        triggerType: 'schedule',
                        icon: '⏰',
                        color: 'bg-green-500',
                    },
                },
                {
                    id: 'node_condition_1',
                    type: 'logic',
                    position: { x: 350, y: 200 },
                    data: {
                        id: 'node_condition_1',
                        label: 'Check Condition',
                        logicType: 'condition',
                        icon: '❓',
                        color: 'bg-blue-500',
                        condition: 'value > threshold',
                    },
                },
                {
                    id: 'node_action_1',
                    type: 'action',
                    position: { x: 600, y: 200 },
                    data: {
                        id: 'node_action_1',
                        label: 'Send Notification',
                        plugin: 'whatsapp',
                        action: 'send',
                        actionName: 'Send Alert',
                        icon: '📱',
                        color: 'bg-primary',
                        parameters: {
                            message: 'Alert: Threshold exceeded!',
                        },
                    },
                },
            ],
            edges: [
                {
                    id: 'edge_1',
                    source: 'node_trigger_1',
                    target: 'node_condition_1',
                    type: 'custom',
                },
                {
                    id: 'edge_2',
                    source: 'node_condition_1',
                    target: 'node_action_1',
                    type: 'custom',
                },
            ],
        },
    },
    {
        id: 'delayed-action',
        name: 'Delayed Action Workflow',
        description: 'Execute actions after a delay',
        category: 'Timing',
        icon: '⏱️',
        workflow: {
            name: 'Delayed Action Workflow',
            description: 'Execute actions after a delay',
            enabled: true,
            schedule: '',
            nodes: [
                {
                    id: 'node_trigger_1',
                    type: 'trigger',
                    position: { x: 100, y: 200 },
                    data: {
                        id: 'node_trigger_1',
                        label: 'Webhook Trigger',
                        triggerType: 'webhook',
                        icon: '🔔',
                        color: 'bg-green-500',
                    },
                },
                {
                    id: 'node_delay_1',
                    type: 'logic',
                    position: { x: 350, y: 200 },
                    data: {
                        id: 'node_delay_1',
                        label: 'Wait 5 minutes',
                        logicType: 'delay',
                        icon: '⏱️',
                        color: 'bg-yellow-500',
                        delay: 300000, // 5 minutes in ms
                    },
                },
                {
                    id: 'node_action_1',
                    type: 'action',
                    position: { x: 600, y: 200 },
                    data: {
                        id: 'node_action_1',
                        label: 'Execute Action',
                        plugin: 'ai-agent',
                        action: 'ask',
                        actionName: 'Process Request',
                        icon: '🤖',
                        color: 'bg-primary',
                        parameters: {},
                    },
                },
            ],
            edges: [
                {
                    id: 'edge_1',
                    source: 'node_trigger_1',
                    target: 'node_delay_1',
                    type: 'custom',
                },
                {
                    id: 'edge_2',
                    source: 'node_delay_1',
                    target: 'node_action_1',
                    type: 'custom',
                },
            ],
        },
    },
];

export default workflowTemplates;
