import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:8000';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tasks, setTasks] = useState([]);
  const [plugins, setPlugins] = useState([]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchTasks();
    fetchPlugins();
  }, []);

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

  return (
    <div className="dashboard-container">
      <div className="sidebar">
        <div className="logo">SuperDashboard</div>
        <nav>
          <div
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 Dashboard
          </div>
          <div
            className={`nav-item ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => setActiveTab('tasks')}
          >
            ✅ Tasks
          </div>
          <div
            className={`nav-item ${activeTab === 'agent' ? 'active' : ''}`}
            onClick={() => setActiveTab('agent')}
          >
            🤖 AI Agent
          </div>
          <div
            className={`nav-item ${activeTab === 'plugins' ? 'active' : ''}`}
            onClick={() => setActiveTab('plugins')}
          >
            🧩 Plugins
          </div>
        </nav>
      </div>

      <div className="main-content">
        {activeTab === 'dashboard' && (
          <div className="animate-fade">
            <h1>Welcome back, Engineer</h1>
            <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div className="card">
                <h3>Quick Stats</h3>
                <p>Pending Tasks: {tasks.length}</p>
                <p>Active Plugins: {plugins.length}</p>
              </div>
              <div className="card">
                <h3>AI Assistant</h3>
                <p>Ready to help you offload work.</p>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button onClick={() => setActiveTab('agent')}>Ask GPT-4</button>
                  <button onClick={async () => {
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
                  }}>Smart Analyze Tasks</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="animate-fade">
            <h1>Task Tracker</h1>
            <div className="task-list">
              {tasks.length === 0 && <p>No tasks yet. Create one!</p>}
              {tasks.map(task => (
                <div key={task.id} className="task-card">
                  <h4>{task.title}</h4>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>{task.description}</p>
                  <span className={`status-badge status-${task.status}`}>{task.status}</span>
                </div>
              ))}
            </div>
            <div className="card" style={{ marginTop: '2rem' }}>
              <h3>Add New Task</h3>
              <input type="text" placeholder="Task Title" id="newTaskTitle" />
              <textarea placeholder="Description" id="newTaskDesc" />
              <button onClick={async () => {
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
              }}>Add Task</button>
            </div>
          </div>
        )}

        {activeTab === 'agent' && (
          <div className="animate-fade">
            <h1>AI Virtual Assistant</h1>
            <div className="card">
              <div className="ai-chat">
                <div className="chat-messages">
                  {aiResponse && (
                    <div className="message agent">
                      {aiResponse}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <input
                    type="text"
                    placeholder="Ask AI to do something..."
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && askAgent()}
                  />
                  <button onClick={askAgent} disabled={isLoading}>
                    {isLoading ? 'Thinking...' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'plugins' && (
          <div className="animate-fade">
            <h1>Plugin Registry</h1>
            <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' }}>
              {plugins.length === 0 && <p>No plugins detected in /plugins directory.</p>}
              {plugins.map(plugin => (
                <div key={plugin.name} className="card" style={{ padding: '1.5rem' }}>
                  <h3>{plugin.name}</h3>
                  <p style={{ color: 'var(--text-muted)' }}>Status: {plugin.status}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
