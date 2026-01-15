import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { formatDistanceToNow, format } from 'date-fns';

const API_BASE = 'http://localhost:8000';

// CodeEditor Component with CodeMirror
function CodeEditor({ value, onChange, language = 'javascript', placeholder = '' }) {
    const editorRef = useRef(null);
    const viewRef = useRef(null);

    useEffect(() => {
        if (!editorRef.current) return;

        // Clean up existing view
        if (viewRef.current) {
            viewRef.current.destroy();
        }

        // Create new editor view
        const view = new EditorView({
            doc: value || '',
            extensions: [
                basicSetup,
                javascript(),
                oneDark,
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        onChange(update.state.doc.toString());
                    }
                }),
                EditorView.theme({
                    "&": {
                        fontSize: "13px",
                        borderRadius: "0.5rem",
                        overflow: "hidden"
                    },
                    ".cm-scroller": {
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                    }
                })
            ],
            parent: editorRef.current,
        });

        viewRef.current = view;

        return () => {
            if (viewRef.current) {
                viewRef.current.destroy();
                viewRef.current = null;
            }
        };
    }, []); // Only run once on mount

    // Update content when value changes externally
    useEffect(() => {
        if (viewRef.current && value !== viewRef.current.state.doc.toString()) {
            viewRef.current.dispatch({
                changes: {
                    from: 0,
                    to: viewRef.current.state.doc.length,
                    insert: value || ''
                }
            });
        }
    }, [value]);

    return (
        <div className="border border-glass-border rounded-lg overflow-hidden">
            <div ref={editorRef} />
            {placeholder && !value && (
                <div className="absolute inset-0 pointer-events-none p-3 text-text-muted text-sm opacity-50">
                    {placeholder}
                </div>
            )}
        </div>
    );
}

// Node Properties Panel
function NodeProperties({ node, onUpdate, onClose, onDelete, onDuplicate, availablePlugins }) {
    const [data, setData] = useState(node.data || {});

    useEffect(() => {
        setData(node.data || {});
    }, [node]);

    const handleUpdate = () => {
        onUpdate({ data });
    };

    const getNodeTypeIcon = (type) => {
        const icons = {
            trigger: '⚡',
            action: '🔌',
            logic: '🔧',
        };
        return icons[type] || '📦';
    };

    return (
        <div className="w-96 bg-glass backdrop-blur-xl border border-glass-border rounded-xl overflow-hidden flex flex-col max-h-full">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-glass-border bg-gradient-to-r from-primary/10 to-accent/10">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">{getNodeTypeIcon(node.type)}</span>
                    <div>
                        <h3 className="text-lg font-bold">Node Properties</h3>
                        <p className="text-xs text-text-muted">{node.type}</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="text-text-muted hover:text-text-main hover:bg-glass-hover rounded p-2 transition-all"
                    title="Close properties"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Trigger Node Configuration */}
                {node.type === 'trigger' && (
                    <>
                        <div>
                            <label className="block text-sm font-semibold text-text-main mb-2">
                                ⚡ Trigger Type
                            </label>
                            <select
                                value={data.triggerType || 'schedule'}
                                onChange={(e) => setData({ ...data, triggerType: e.target.value })}
                                className="w-full bg-bg-card border border-glass-border rounded-lg px-3 py-2 focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                            >
                                <option value="schedule">⏰ Schedule (Cron)</option>
                                <option value="webhook">🔔 Webhook</option>
                                <option value="manual">👆 Manual</option>
                            </select>
                            <p className="text-xs text-text-muted mt-1">
                                {data.triggerType === 'schedule' && 'Triggered by the workflow schedule'}
                                {data.triggerType === 'webhook' && 'Triggered by external events'}
                                {data.triggerType === 'manual' && 'Triggered manually'}
                            </p>
                        </div>
                    </>
                )}

                {/* Action Node Configuration */}
                {node.type === 'action' && (
                    <>
                        <div className="bg-gradient-to-br from-primary/5 to-accent/5 border border-glass-border rounded-lg p-3 space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-text-muted mb-1">Plugin</label>
                                <div className="bg-bg-card rounded-lg px-3 py-2 text-sm font-medium">{data.plugin}</div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-text-muted mb-1">Action</label>
                                <div className="bg-bg-card rounded-lg px-3 py-2 text-sm font-medium">{data.actionName || data.action}</div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-text-main mb-2">
                                ⚙️ Parameters (JSON)
                            </label>
                            <textarea
                                value={JSON.stringify(data.parameters || {}, null, 2)}
                                onChange={(e) => {
                                    try {
                                        const params = JSON.parse(e.target.value);
                                        setData({ ...data, parameters: params });
                                    } catch (err) {
                                        // Invalid JSON, keep editing
                                    }
                                }}
                                className="w-full bg-bg-card border border-glass-border rounded-lg px-3 py-2 text-sm font-mono focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                rows={8}
                                placeholder='{\n  "key": "value"\n}'
                            />
                        </div>
                    </>
                )}

                {/* Logic Node Configuration */}
                {node.type === 'logic' && (
                    <>
                        {data.logicType === 'delay' && (
                            <div>
                                <label className="block text-sm font-semibold text-text-main mb-2">
                                    ⏱️ Delay Duration (ms)
                                </label>
                                <input
                                    type="number"
                                    value={data.delay || 1000}
                                    onChange={(e) => setData({ ...data, delay: parseInt(e.target.value) })}
                                    className="w-full bg-bg-card border border-glass-border rounded-lg px-3 py-2 focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                    min="1"
                                />
                            </div>
                        )}

                        {data.logicType === 'condition' && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-text-main mb-2">
                                        Condition Expression
                                    </label>
                                    <input
                                        type="text"
                                        value={data.condition || ''}
                                        onChange={(e) => setData({ ...data, condition: e.target.value })}
                                        className="w-full bg-bg-card border border-glass-border rounded-lg px-3 py-2 font-mono text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                        placeholder="value > 10"
                                    />
                                </div>
                            </div>
                        )}

                        {data.logicType === 'transform' && (
                            <div>
                                <label className="block text-sm font-semibold text-text-main mb-2">
                                    💻 JavaScript Code
                                </label>
                                <CodeEditor
                                    value={data.code || ''}
                                    onChange={(newCode) => setData({ ...data, code: newCode })}
                                    language="javascript"
                                />
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Footer with action buttons */}
            <div className="p-4 border-t border-glass-border bg-bg-card flex gap-2">
                <button
                    onClick={handleUpdate}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-primary to-accent text-white rounded-lg hover:shadow-lg hover:shadow-primary/50 transition-all font-semibold"
                >
                    ✓ Update
                </button>
                {onDuplicate && (
                    <button
                        onClick={onDuplicate}
                        className="px-4 py-3 bg-glass border border-glass-border text-text-main rounded-lg hover:bg-glass-hover transition-all"
                        title="Duplicate node"
                    >
                        📋
                    </button>
                )}
                {onDelete && (
                    <button
                        onClick={onDelete}
                        className="px-4 py-3 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-all"
                        title="Delete node"
                    >
                        🗑️
                    </button>
                )}
            </div>
        </div>
    );
}

// Executions Panel
function ExecutionsPanel({ executions, onClose }) {
    const [selectedExecution, setSelectedExecution] = useState(null);

    const getStatusColor = (status) => {
        const colors = {
            completed: 'text-green-400',
            failed: 'text-red-400',
            running: 'text-yellow-400',
            pending: 'text-gray-400'
        };
        return colors[status] || 'text-gray-400';
    };

    return (
        <div className="w-96 bg-glass backdrop-blur-xl border border-glass-border rounded-xl p-4 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Execution History</h3>
                <button onClick={onClose} className="text-text-muted hover:text-text-main">✕</button>
            </div>

            {executions.length === 0 ? (
                <p className="text-text-muted text-sm">No executions yet</p>
            ) : (
                <div className="space-y-2">
                    {executions.map(execution => (
                        <div
                            key={execution.id}
                            className="bg-bg-card border border-glass-border rounded-lg p-3 cursor-pointer hover:border-primary transition-all"
                            onClick={() => setSelectedExecution(selectedExecution?.id === execution.id ? null : execution)}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className={`text-sm font-medium ${getStatusColor(execution.status)}`}>
                                    {execution.status.toUpperCase()}
                                </span>
                                <div className="text-xs text-text-muted text-right">
                                    <div>{formatDistanceToNow(new Date(execution.start_time), { addSuffix: true })}</div>
                                    <div className="text-[10px] opacity-70">{format(new Date(execution.start_time), 'MMM d, h:mm a')}</div>
                                </div>
                            </div>

                            {selectedExecution?.id === execution.id && execution.logs && (
                                <div className="mt-3 pt-3 border-t border-glass-border">
                                    <p className="text-xs text-text-muted mb-2">Execution Logs:</p>
                                    <div className="bg-bg-dark rounded p-2 max-h-48 overflow-y-auto">
                                        {execution.logs.map((log, idx) => (
                                            <div key={idx} className="text-xs mb-1">
                                                <span className={`font-mono ${log.level === 'error' ? 'text-red-400' :
                                                    log.level === 'warning' ? 'text-yellow-400' :
                                                        'text-text-muted'
                                                    }`}>
                                                    [{log.level}] {log.message}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export { CodeEditor, NodeProperties, ExecutionsPanel };
