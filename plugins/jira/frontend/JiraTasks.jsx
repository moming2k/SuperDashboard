import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:8000';

export default function JiraTasks() {
    const [jiraIssues, setJiraIssues] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedIssue, setSelectedIssue] = useState(null);
    const [jiraProjects, setJiraProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState('');
    const [jiraComments, setJiraComments] = useState([]);
    const [newComment, setNewComment] = useState('');

    useEffect(() => {
        fetchJiraProjects();
        fetchJiraIssues();
    }, []);

    const handleProjectChange = (projectKey) => {
        setSelectedProject(projectKey);
        fetchJiraIssues(projectKey);
    };

    const fetchJiraProjects = async () => {
        try {
            const res = await fetch(`${API_BASE}/plugins/jira/projects`);
            const data = await res.json();
            setJiraProjects(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error("Failed to fetch Jira projects", e);
            setJiraProjects([]);
        }
    };

    const fetchJiraIssues = async (projectKey = null) => {
        setIsLoading(true);
        try {
            const url = projectKey
                ? `${API_BASE}/plugins/jira/issues?project_key=${projectKey}`
                : `${API_BASE}/plugins/jira/issues`;
            const res = await fetch(url);
            const data = await res.json();
            setJiraIssues(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error("Failed to fetch Jira issues", e);
            setJiraIssues([]);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchJiraComments = async (key) => {
        try {
            const res = await fetch(`${API_BASE}/plugins/jira/issues/${key}/comments`);
            const data = await res.json();
            setJiraComments(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error("Failed to fetch Jira comments", e);
            setJiraComments([]);
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
                <div className="flex gap-4 items-center">
                    <select
                        onChange={(e) => handleProjectChange(e.target.value)}
                        className="bg-glass border border-glass-border p-2 px-4 rounded-lg hover:bg-glass/20 transition-colors disabled:opacity-50"
                    >
                        <option value="">All Projects</option>
                        {jiraProjects.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
                    </select>
                    {isLoading && <span className="text-sm text-text-muted animate-pulse">Syncing...</span>}
                    <button
                        onClick={() => fetchJiraIssues(selectedProject)}
                        disabled={isLoading}
                        className="bg-glass border border-glass-border p-2 px-4 rounded-lg hover:bg-glass/20 transition-colors disabled:opacity-50"
                    >
                        Refresh Jira
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {jiraIssues.length === 0 && !isLoading && <p className="text-text-muted col-span-full text-center py-20 bg-glass/10 rounded-3xl border border-dashed border-glass-border">No Jira issues found. Check your JQL configuration.</p>}
                {jiraIssues.map((issue) => (
                    <div
                        key={issue.key || Math.random()}
                        className="bg-bg-card backdrop-blur-xl border border-glass-border rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02] hover:border-primary cursor-pointer shadow-lg group"
                        onClick={() => {
                            setSelectedIssue(issue);
                            fetchJiraComments(issue.key);
                        }}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-primary font-bold group-hover:text-accent transition-colors">{issue.key}</span>
                            <span className="text-[10px] text-text-muted uppercase tracking-widest font-bold">{issue.priority}</span>
                        </div>
                        <h4 className="text-lg font-bold mb-4 line-clamp-2 h-14">{issue.summary}</h4>
                        <div className="flex justify-between items-center mt-auto border-t border-glass-border/30 pt-4">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${issue.status === 'Done' ? 'bg-green-500/20 text-green-400' :
                                    issue.status === 'In Progress' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'
                                }`}>
                                {issue.status}
                            </span>
                            <span className="text-xs text-text-muted">{issue.assignee || 'Unassigned'}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Jira Detail Modal */}
            {selectedIssue && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-bg-dark border border-glass-border w-full max-w-4xl max-h-[90vh] rounded-[32px] shadow-2xl overflow-hidden flex flex-col animate-fade">
                        <div className="p-8 border-b border-glass-border flex justify-between items-center bg-bg-card/50">
                            <div>
                                <span className="text-primary font-bold mb-1 block tracking-widest">{selectedIssue.key}</span>
                                <h2 className="text-2xl font-bold">{selectedIssue.summary}</h2>
                            </div>
                            <button
                                onClick={() => setSelectedIssue(null)}
                                className="w-10 h-10 flex items-center justify-center rounded-full bg-glass hover:bg-glass/20 transition-all text-text-muted hover:text-white"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="md:col-span-2 space-y-8 text-left">
                                <div>
                                    <h4 className="text-text-muted uppercase tracking-widest text-[10px] font-bold mb-4">Description</h4>
                                    <div className="bg-glass/30 p-6 rounded-2xl border border-glass-border/50 min-h-[150px] whitespace-pre-wrap text-sm leading-relaxed">
                                        {selectedIssue.description || 'No description provided.'}
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-text-muted uppercase tracking-widest text-[10px] font-bold mb-4">Comments</h4>
                                    <div className="space-y-4 mb-6">
                                        {jiraComments.length === 0 && <p className="text-xs text-text-muted italic">No comments yet.</p>}
                                        {jiraComments.map(comment => (
                                            <div key={comment.id} className="bg-bg-card/40 p-5 rounded-2xl border border-glass-border/20 shadow-sm">
                                                <div className="flex justify-between items-center mb-3">
                                                    <span className="text-xs font-bold text-primary">{comment.author}</span>
                                                    <span className="text-[10px] text-text-muted font-medium bg-glass px-2 py-0.5 rounded-md">{new Date(comment.created).toLocaleString()}</span>
                                                </div>
                                                <p className="text-sm text-text-main/90">{comment.body}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        <textarea
                                            value={newComment}
                                            onChange={(e) => setNewComment(e.target.value)}
                                            placeholder="Write a comment..."
                                            className="bg-bg-dark/50 border border-glass-border rounded-2xl p-4 text-sm text-white w-full h-24 outline-none focus:border-primary transition-all resize-none shadow-inner"
                                        />
                                        <button
                                            onClick={addJiraComment}
                                            className="bg-primary text-white p-3 px-8 rounded-xl font-bold h-fit self-end shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all active:translate-y-0"
                                        >
                                            Post Comment
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="bg-glass/20 p-6 rounded-3xl border border-glass-border shadow-xl">
                                    <h4 className="text-text-muted uppercase tracking-widest text-[10px] font-bold mb-4">Current Status</h4>
                                    <div className="flex flex-col gap-3">
                                        <div className="bg-primary/10 text-primary border border-primary/20 p-3 rounded-2xl text-center font-bold text-sm shadow-[0_0_15px_rgba(99,102,241,0.1)]">
                                            {selectedIssue.status}
                                        </div>
                                        <div className="h-[1px] bg-glass-border my-2"></div>
                                        <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold mb-1">Move to:</p>
                                        {['To Do', 'In Progress', 'Done', 'Selected for Development'].filter(s => s !== selectedIssue.status).map(status => (
                                            <button
                                                key={status}
                                                onClick={() => updateJiraStatus(selectedIssue.key, status)}
                                                className="text-xs bg-bg-card/60 p-3 rounded-xl border border-glass-border hover:border-primary hover:bg-primary/5 transition-all text-left flex justify-between items-center group/btn"
                                            >
                                                <span>{status}</span>
                                                <span className="opacity-0 group-hover/btn:opacity-100 transition-opacity">→</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-glass/20 p-6 rounded-3xl border border-glass-border space-y-5 shadow-xl">
                                    <div className="flex flex-col gap-1">
                                        <h4 className="text-text-muted uppercase tracking-widest text-[10px] font-bold">Assignee</h4>
                                        <p className="text-sm font-bold text-text-main">{selectedIssue.assignee || 'Unassigned'}</p>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <h4 className="text-text-muted uppercase tracking-widest text-[10px] font-bold">Priority</h4>
                                        <p className="text-sm font-bold text-text-main flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-accent"></span>
                                            {selectedIssue.priority}
                                        </p>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <h4 className="text-text-muted uppercase tracking-widest text-[10px] font-bold">Created Date</h4>
                                        <p className="text-xs text-text-muted font-medium bg-glass px-2 py-1 rounded-lg w-fit">
                                            {new Date(selectedIssue.created).toLocaleDateString(undefined, { dateStyle: 'long' })}
                                        </p>
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
