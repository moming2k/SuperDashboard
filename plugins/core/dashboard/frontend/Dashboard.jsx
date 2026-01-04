import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../config';

function Dashboard() {
  const [tasks, setTasks] = useState([]);
  const [plugins, setPlugins] = useState([]);

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

  const analyzeTasks = async () => {
    try {
      const res = await fetch(`${API_BASE}/agents/analyze-tasks`, { method: 'POST' });
      const data = await res.json();

      // Store analysis in localStorage for AI agent to pick up
      const analysisMessage = {
        role: 'assistant',
        content: data.response || data.error || 'No analysis available',
        timestamp: new Date().toISOString()
      };

      const savedConversation = JSON.parse(localStorage.getItem('ai_conversation') || '[]');
      const updatedConversation = [...savedConversation, analysisMessage];
      localStorage.setItem('ai_conversation', JSON.stringify(updatedConversation));

      // Navigate to agent tab
      window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab: 'agent' } }));
    } catch (e) {
      console.error("Error analyzing tasks", e);
    }
  };

  return (
    <div className="animate-fade">
      <h1 className="text-3xl font-bold mb-8">Welcome back, Engineer</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-bg-card backdrop-blur-xl border border-glass-border rounded-[24px] p-8 shadow-2xl">
          <h3 className="text-xl font-semibold mb-4">Quick Stats</h3>
          <p className="text-text-muted mb-2">
            Tasks: <span className="text-text-main font-bold">{tasks.length}</span>
          </p>
          <p className="text-text-muted">Active Plugins: <span className="text-text-main font-bold">{plugins.length}</span></p>
        </div>
        <div className="bg-bg-card backdrop-blur-xl border border-glass-border rounded-[24px] p-8 shadow-2xl">
          <h3 className="text-xl font-semibold mb-4">AI Assistant</h3>
          <p className="text-text-muted mb-6">Ready to help you offload work.</p>
          <div className="flex gap-4">
            <button
              className="bg-primary text-white p-3 px-6 rounded-xl font-semibold cursor-pointer transition-all duration-300 hover:bg-primary-hover hover:-translate-y-0.5 hover:shadow-[0_5px_15px_rgba(99,102,241,0.4)]"
              onClick={() => window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab: 'agent' } }))}
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
  );
}

export default Dashboard;
