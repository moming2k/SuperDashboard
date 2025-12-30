import React from 'react';

const ModelSelector = ({ selectedModel, onModelChange, availableModels }) => {
    const models = availableModels || [
        { id: 'gpt-4', name: 'GPT-4', description: 'Most capable, best for complex tasks' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Faster GPT-4 with 128k context' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and efficient' },
    ];

    return (
        <div className="relative group">
            <select
                value={selectedModel}
                onChange={(e) => onModelChange(e.target.value)}
                className="bg-glass border border-glass-border text-text-main px-4 py-2 pr-10 rounded-xl text-sm outline-none focus:border-primary transition-colors cursor-pointer hover:bg-glass/80 appearance-none"
            >
                {models.map((model) => (
                    <option key={model.id} value={model.id}>
                        {model.name}
                    </option>
                ))}
            </select>

            {/* Custom dropdown arrow */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </div>

            {/* Tooltip with model description */}
            <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-10 w-64">
                <div className="bg-glass border border-glass-border rounded-xl p-3 shadow-xl">
                    <p className="text-xs text-text-muted">
                        {models.find(m => m.id === selectedModel)?.description}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ModelSelector;
