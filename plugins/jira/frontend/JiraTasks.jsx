import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:8000';

export function JiraTasks({ jiraIssues, fetchJiraIssues, isLoading }) {
    const [selectedIssue, setSelectedIssue] = useState(null);
    const [jiraComments, setJiraComments] = useState([]);
    const [newComment, setNewComment] = useState('');

    const fetchJiraComments = async (key) => {
        try {
            const res = await fetch(`${API_BASE}/plugins/jira/issues/${key}/comments`);
            const data = await res.json();
            setJiraComments(data);
        } catch (e) {
            console.error("Failed to fetch Jira comments", e);
        }
    };

    const addJiraComment = async () => {
        if (!newComment || !selectedIssue) return;
        try {
            await fetch(`${API_BASE}/plugins/jira/issues/${selectedIssue.key}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ body: newComment })
            });
            setNewComment('');
            fetchJiraComments(selectedIssue.key);
        } catch (e) {
            console.error("Failed to add comment", e);
        }
    };

    const updateJiraStatus = async (key, status) => {
        try {
            await fetch(`${API_BASE}/plugins/jira/issues/${key}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status_name: status })
            });
            fetchJiraIssues();
            if (selectedIssue && selectedIssue.key === key) {
                setSelectedIssue({ ...selectedIssue, status });
            }
        } catch (e) {
            console.error("Failed to update status", e);
        }
    };

    return (
        <div className="animate-fade">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">Jira Issue Tracker</h1>
                <button
                    onClick={fetchJiraIssues}
                    className="bg-glass border border-glass-border p-2 px-4 rounded-lg hover:bg-glass/20 transition-colors"
                >
                    Refresh Jira
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {jiraIssues.length === 0 && <p className="text-text-muted col-span-full">No Jira issues found.</p>}
                {jiraIssues.map((issue) => (
                    <div
                        key={issue.key}
                        className="bg-glass border border-glass-border rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02] hover:border-primary cursor-pointer shadow-lg"
                        onClick={() => {
                            setSelectedIssue(issue);
                            fetchJiraComments(issue.key);
                        }}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-primary font-bold">{issue.key}</span>
                            <span className="text-xs text-text-muted italic">{issue.priority}</span>
                        </div>
                        <h4 className="text-lg font-bold mb-4 line-clamp-2">{issue.summary}</h4>
                        <div className="flex justify-between items-center">
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/20 text-primary">
                                {issue.status}
                            </span>
                            <span className="text-xs text-text-muted">{issue.assignee}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Jira Detail Modal */}
            {selectedIssue && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-bg-dark border border-glass-border w-full max-w-4xl max-h-[90vh] rounded-[32px] shadow-2xl overflow-hidden flex flex-col animate-fade">
                        <div className="p-8 border-b border-glass-border flex justify-between items-center bg-bg-card">
                            <div>
                                <span className="text-primary font-bold mb-1 block">{selectedIssue.key}</span>
                                <h2 className="text-2xl font-bold">{selectedIssue.summary}</h2>
                            </div>
                            <button
                                onClick={() => setSelectedIssue(null)}
                                className="text-text-muted hover:text-white text-2xl"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="md:col-span-2 space-y-8">
                                <div>
                                    <h4 className="text-text-muted uppercase tracking-widest text-xs font-bold mb-4">Description</h4>
                                    <div className="bg-glass p-6 rounded-2xl border border-glass-border min-h-[150px] whitespace-pre-wrap text-sm">
                                        {selectedIssue.description || 'No description provided.'}
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-text-muted uppercase tracking-widest text-xs font-bold mb-4">Comments</h4>
                                    <div className="space-y-4 mb-6">
                                        {jiraComments.map(comment => (
                                            <div key={comment.id} className="bg-bg-dark/40 p-4 rounded-xl border border-glass-border/30">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-xs font-bold text-primary">{comment.author}</span>
                                                    <span className="text-[10px] text-text-muted">{new Date(comment.created).toLocaleString()}</span>
                                                </div>
                                                <p className="text-sm">{comment.body}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <textarea
                                            value={newComment}
                                            onChange={(e) => setNewComment(e.target.value)}
                                            placeholder="Add a comment..."
                                            className="bg-bg-dark/50 border border-glass-border rounded-xl p-3 text-sm text-white w-full h-20 outline-none focus:border-primary transition-colors resize-none"
                                        />
                                        <button
                                            onClick={addJiraComment}
                                            className="bg-primary text-white p-3 px-6 rounded-xl font-semibold h-fit self-end"
                                        >
                                            Post
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="bg-glass p-6 rounded-2xl border border-glass-border">
                                    <h4 className="text-text-muted uppercase tracking-widest text-xs font-bold mb-4">Status</h4>
                                    <div className="flex flex-col gap-2">
                                        <span className="bg-primary/20 text-primary px-4 py-2 rounded-xl text-center font-bold mb-4">
                                            {selectedIssue.status}
                                        </span>
                                        <p className="text-xs text-text-muted mb-2 font-bold">Transition to:</p>
                                        {['To Do', 'In Progress', 'Done', 'Selected for Development'].filter(s => s !== selectedIssue.status).map(status => (
                                            <button
                                                key={status}
                                                onClick={() => updateJiraStatus(selectedIssue.key, status)}
                                                className="text-xs bg-bg-dark/60 p-2 rounded-lg border border-glass-border hover:border-primary transition-all text-left px-4"
                                            >
                                                → {status}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-glass p-6 rounded-2xl border border-glass-border space-y-4">
                                    <div>
                                        <h4 className="text-text-muted uppercase tracking-widest text-[10px] font-bold">Assignee</h4>
                                        <p className="text-sm font-semibold">{selectedIssue.assignee}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-text-muted uppercase tracking-widest text-[10px] font-bold">Priority</h4>
                                        <p className="text-sm font-semibold">{selectedIssue.priority}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-text-muted uppercase tracking-widest text-[10px] font-bold">Created</h4>
                                        <p className="text-xs text-text-muted">{new Date(selectedIssue.created).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
