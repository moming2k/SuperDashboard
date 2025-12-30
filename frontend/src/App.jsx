import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:8000';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tasks, setTasks] = useState([]);
  const [plugins, setPlugins] = useState([]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Jira State
  const [jiraIssues, setJiraIssues] = useState([]);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [jiraComments, setJiraComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  const isJiraEnabled = plugins.some(p => p.name === 'jira');

  useEffect(() => {
    fetchTasks();
    fetchPlugins();
  }, []);

  useEffect(() => {
    if (isJiraEnabled && activeTab === 'tasks') {
      fetchJiraIssues();
    }
  }, [isJiraEnabled, activeTab]);

  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_BASE}/tasks`);
      const data = await res.json();
      setTasks(data);
    } catch (e) {
      console.error("Failed to fetch tasks", e);
    }
  };

  const fetchPlugins = async () => {
    try {
      const res = await fetch(`${API_BASE}/plugins`);
      const data = await res.json();
      setPlugins(data);
    } catch (e) {
      console.error("Failed to fetch plugins", e);
    }
  };

  const fetchJiraIssues = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/plugins/jira/issues`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setJiraIssues(data);
      }
    } catch (e) {
      console.error("Failed to fetch Jira issues", e);
    }
    setIsLoading(false);
  };

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

  const askAgent = async () => {
    if (!aiPrompt) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/agents/ask?prompt=${encodeURIComponent(aiPrompt)}`, {
        method: 'POST'
      });
      const data = await res.json();
      setAiResponse(data.response || data.error);
    } catch (e) {
      setAiResponse("Error communicating with AI agent.");
    }
    setIsLoading(false);
  };

  const analyzeTasks = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/agents/analyze-tasks`, { method: 'POST' });
      const data = await res.json();
      setAiResponse(data.response || data.error);
      setActiveTab('agent');
    } catch (e) {
      setAiResponse("Error analyzed tasks.");
    }
    setIsLoading(false);
  };

  const addTask = async () => {
    const title = document.getElementById('newTaskTitle').value;
    const desc = document.getElementById('newTaskDesc').value;
    if (!title) return;
    await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description: desc })
    });
    fetchTasks();
    document.getElementById('newTaskTitle').value = '';
    document.getElementById('newTaskDesc').value = '';
  };

  return (
    <div className="flex h-screen bg-bg-dark font-outfit text-text-main">
      {/* Sidebar */}
      <div className="w-[260px] bg-glass backdrop-blur-xl border-r border-glass-border p-8 flex flex-col gap-8">
        <div className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-8">
          SuperDashboard
        </div>
        <nav className="flex flex-col gap-2">
          {[
            { id: 'dashboard', label: '📊 Dashboard' },
            { id: 'tasks', label: isJiraEnabled ? '🏷️ Jira Tasks' : '✅ Tasks' },
            { id: 'agent', label: '🤖 AI Agent' },
            { id: 'plugins', label: '🧩 Plugins' },
          ].map((tab) => (
            <div
              key={tab.id}
              className={`flex items-center gap-3 p-3 px-4 rounded-xl cursor-pointer transition-all duration-300 hover:bg-glass hover:text-text-main hover:translate-x-1 ${activeTab === tab.id ? 'bg-glass text-text-main translate-x-1' : 'text-text-muted'
                }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </div>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        {activeTab === 'dashboard' && (
          <div className="animate-fade">
            <h1 className="text-3xl font-bold mb-8">Welcome back, Engineer</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-bg-card backdrop-blur-xl border border-glass-border rounded-[24px] p-8 shadow-2xl">
                <h3 className="text-xl font-semibold mb-4">Quick Stats</h3>
                <p className="text-text-muted mb-2">
                  {isJiraEnabled ? 'Jira Issues:' : 'Pending Tasks:'} <span className="text-text-main font-bold">{isJiraEnabled ? jiraIssues.length : tasks.length}</span>
                </p>
                <p className="text-text-muted">Active Plugins: <span className="text-text-main font-bold">{plugins.length}</span></p>
              </div>
              <div className="bg-bg-card backdrop-blur-xl border border-glass-border rounded-[24px] p-8 shadow-2xl">
                <h3 className="text-xl font-semibold mb-4">AI Assistant</h3>
                <p className="text-text-muted mb-6">Ready to help you offload work.</p>
                <div className="flex gap-4">
                  <button
                    className="bg-primary text-white p-3 px-6 rounded-xl font-semibold cursor-pointer transition-all duration-300 hover:bg-primary-hover hover:-translate-y-0.5 hover:shadow-[0_5px_15px_rgba(99,102,241,0.4)]"
                    onClick={() => setActiveTab('agent')}
                  >
                    Ask GPT-4
                  </button>
                  <button
                    className="bg-primary text-white p-3 px-6 rounded-xl font-semibold cursor-pointer transition-all duration-300 hover:bg-primary-hover hover:-translate-y-0.5 hover:shadow-[0_5px_15px_rgba(99,102,241,0.4)]"
                    onClick={analyzeTasks}
                  >
                    Smart Analyze
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="animate-fade">
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-3xl font-bold">{isJiraEnabled ? 'Jira Issue Tracker' : 'Task Tracker'}</h1>
              {isJiraEnabled && (
                <button
                  onClick={fetchJiraIssues}
                  className="bg-glass border border-glass-border p-2 px-4 rounded-lg hover:bg-glass/20 transition-colors"
                >
                  Refresh Jira
                </button>
              )}
            </div>

            {isJiraEnabled ? (
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
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  {tasks.length === 0 && <p className="text-text-muted col-span-full">No tasks yet. Create one!</p>}
                  {tasks.map((task) => (
                    <div key={task.id} className="bg-glass border border-glass-border rounded-2xl p-6 transition-transform duration-300 hover:scale-[1.02] hover:border-primary">
                      <h4 className="text-lg font-bold mb-2">{task.title}</h4>
                      <p className="text-text-muted mb-4 line-clamp-2">{task.description}</p>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${task.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                        {task.status}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="bg-bg-card backdrop-blur-xl border border-glass-border rounded-[24px] p-8 shadow-2xl">
                  <h3 className="text-xl font-semibold mb-6">Add New Task</h3>
                  <div className="flex flex-col gap-4">
                    <input
                      type="text"
                      placeholder="Task Title"
                      id="newTaskTitle"
                      className="bg-bg-dark/50 border border-glass-border rounded-xl p-3 text-white w-full outline-none focus:border-primary transition-colors"
                    />
                    <textarea
                      placeholder="Description"
                      id="newTaskDesc"
                      className="bg-bg-dark/50 border border-glass-border rounded-xl p-3 text-white w-full h-32 outline-none focus:border-primary transition-colors resize-none"
                    />
                    <button
                      className="bg-primary text-white p-3 px-6 rounded-xl font-semibold cursor-pointer transition-all duration-300 hover:bg-primary-hover hover:-translate-y-0.5 hover:shadow-[0_5px_15px_rgba(99,102,241,0.4)] self-start"
                      onClick={addTask}
                    >
                      Add Task
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'agent' && (
          <div className="animate-fade">
            <h1 className="text-3xl font-bold mb-8">AI Virtual Assistant</h1>
            <div className="bg-bg-card backdrop-blur-xl border border-glass-border rounded-[24px] p-8 shadow-2xl flex flex-col h-[600px] gap-6">
              <div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-2">
                {!aiResponse && !isLoading && (
                  <div className="text-text-muted text-center mt-20 italic">
                    Ask the agent anything or use "Smart Analyze" from the dashboard.
                  </div>
                )}
                {aiResponse && (
                  <div className="self-start bg-glass border border-glass-border p-4 px-6 rounded-2xl max-w-[90%] whitespace-pre-wrap text-sm leading-relaxed">
                    {aiResponse}
                  </div>
                )}
              </div>
              <div className="flex gap-4">
                <input
                  type="text"
                  placeholder="Ask AI to do something..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && askAgent()}
                  className="bg-bg-dark/50 border border-glass-border rounded-xl p-3 text-white w-full outline-none focus:border-primary transition-colors"
                />
                <button
                  className="bg-primary text-white p-3 px-8 rounded-xl font-semibold cursor-pointer transition-all duration-300 hover:bg-primary-hover hover:-translate-y-0.5 disabled:opacity-50 whitespace-nowrap"
                  onClick={askAgent}
                  disabled={isLoading}
                >
                  {isLoading ? 'Thinking...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'plugins' && (
          <div className="animate-fade">
            <h1 className="text-3xl font-bold mb-8">Plugin Registry</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {plugins.length === 0 && <p className="text-text-muted">No plugins detected in /plugins directory.</p>}
              {plugins.map(plugin => (
                <div key={plugin.name} className="bg-bg-card backdrop-blur-xl border border-glass-border rounded-[24px] p-8 shadow-2xl transition-all hover:border-primary">
                  <h3 className="text-xl font-bold mb-2">{plugin.name}</h3>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400"></div>
                    <p className="text-text-muted text-sm uppercase tracking-wider">{plugin.status}</p>
                  </div>
                  <button className="mt-6 w-full bg-glass border border-glass-border p-2 rounded-lg text-sm hover:bg-glass/20 transition-colors">
                    Configure
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
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

export default App;
