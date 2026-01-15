import React, { useState } from 'react';
import { workflowTemplates } from '../utils/workflowTemplates';

const TemplateSelector = ({ isOpen, onClose, onSelectTemplate }) => {
    const [selectedCategory, setSelectedCategory] = useState('All');

    if (!isOpen) return null;

    // Get unique categories
    const categories = ['All', ...new Set(workflowTemplates.map(t => t.category))];

    // Filter templates by category
    const filteredTemplates = selectedCategory === 'All'
        ? workflowTemplates
        : workflowTemplates.filter(t => t.category === selectedCategory);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-glass backdrop-blur-xl border border-glass-border rounded-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-glass-border bg-gradient-to-r from-primary/10 to-accent/10">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold text-text-main">📚 Workflow Templates</h2>
                            <p className="text-text-muted text-sm mt-1">Choose a template to get started quickly</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-text-muted hover:text-text-main hover:bg-glass-hover rounded p-2 transition-all"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Category Filter */}
                    <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                        {categories.map(category => (
                            <button
                                key={category}
                                onClick={() => setSelectedCategory(category)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${selectedCategory === category
                                        ? 'bg-primary text-white'
                                        : 'bg-glass border border-glass-border text-text-main hover:bg-glass-hover'
                                    }`}
                            >
                                {category}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Templates Grid */}
                <div className="p-6 overflow-y-auto max-h-[calc(80vh-200px)]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredTemplates.map(template => (
                            <div
                                key={template.id}
                                className="bg-glass backdrop-blur-xl border border-glass-border rounded-xl p-5 hover:border-primary transition-all cursor-pointer group"
                                onClick={() => onSelectTemplate(template)}
                            >
                                {/* Template Header */}
                                <div className="flex items-start gap-3 mb-3">
                                    <div className="text-4xl">{template.icon}</div>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-bold text-text-main group-hover:text-primary transition-colors">
                                            {template.name}
                                        </h3>
                                        <span className="text-xs px-2 py-1 bg-primary/20 text-primary rounded inline-block mt-1">
                                            {template.category}
                                        </span>
                                    </div>
                                </div>

                                {/* Description */}
                                <p className="text-text-muted text-sm mb-4">
                                    {template.description}
                                </p>

                                {/* Template Info */}
                                <div className="flex items-center gap-4 text-xs text-text-muted">
                                    <div className="flex items-center gap-1">
                                        <span>📦</span>
                                        <span>{template.workflow.nodes.length} nodes</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span>🔗</span>
                                        <span>{template.workflow.edges.length} connections</span>
                                    </div>
                                    {template.workflow.schedule && (
                                        <div className="flex items-center gap-1">
                                            <span>⏰</span>
                                            <span>Scheduled</span>
                                        </div>
                                    )}
                                </div>

                                {/* Use Template Button */}
                                <button className="w-full mt-4 px-4 py-2 bg-gradient-to-r from-primary to-accent text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all font-semibold">
                                    Use This Template →
                                </button>
                            </div>
                        ))}
                    </div>

                    {filteredTemplates.length === 0 && (
                        <div className="text-center py-12 text-text-muted">
                            <p className="text-lg">No templates found in this category</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TemplateSelector;
