import React, { useState, useEffect } from 'react';

import { API_BASE } from '../config';

function MCPSettings({ isOpen, onClose }) {
  const [mcpServers, setMcpServers] = useState([]);
  const [newServer, setNewServer] = useState({ name: '', url: '', apiKey: '' });
  const [isSaving, setIsSaving] = useState(false);

  const loadMCPServers = async () => {
    try {
      const res = await fetch(`${API_BASE}/mcp/servers`);
      const data = await res.json();
      setMcpServers(data.servers || []);
    } catch (e) {
      console.error('Failed to load MCP servers', e);
    }
  };

  const addServer = async () => {
    if (!newServer.name || !newServer.url) {
      alert('Please provide both name and URL for the MCP server');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/mcp/servers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newServer)
      });

      if (res.ok) {
        setNewServer({ name: '', url: '', apiKey: '' });
        await loadMCPServers();
      } else {
        const error = await res.json();
        alert(`Failed to add server: ${error.detail || 'Unknown error'}`);
      }
    } catch (e) {
      console.error('Failed to add MCP server', e);
      alert('Failed to add MCP server. Please check console for details.');
    }
    setIsSaving(false);
  };

  const removeServer = async (serverName) => {
    setIsSaving(true);
    try {
      await fetch(`${API_BASE}/mcp/servers/${serverName}`, {
        method: 'DELETE'
      });
      await loadMCPServers();
    } catch (e) {
      console.error('Failed to remove MCP server', e);
    }
    setIsSaving(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadMCPServers();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-bg-card border border-glass-border rounded-[24px] p-8 shadow-2xl max-w-3xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">MCP Server Configuration</h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-main transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-8">
          <p className="text-text-muted mb-4">
            Configure Model Context Protocol (MCP) servers to extend AI capabilities with external tools and data sources.
          </p>
        </div>

        {/* Existing Servers */}
        {mcpServers.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4">Configured Servers</h3>
            <div className="space-y-3">
              {mcpServers.map((server) => (
                <div key={server.name} className="bg-glass border border-glass-border rounded-xl p-4 flex justify-between items-center">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold">{server.name}</h4>
                      <span className={`text-xs px-2 py-1 rounded-full ${server.status === 'connected' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                        {server.status || 'unknown'}
                      </span>
                    </div>
                    <p className="text-sm text-text-muted">{server.url}</p>
                  </div>
                  <button
                    onClick={() => removeServer(server.name)}
                    disabled={isSaving}
                    className="ml-4 text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add New Server */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Add New Server</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Server Name</label>
              <input
                type="text"
                value={newServer.name}
                onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
                placeholder="e.g., GitHub Tools"
                className="w-full bg-glass border border-glass-border rounded-xl px-4 py-2 text-text-main placeholder-text-muted outline-none focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Server URL</label>
              <input
                type="text"
                value={newServer.url}
                onChange={(e) => setNewServer({ ...newServer, url: e.target.value })}
                placeholder="e.g., http://localhost:3000 or npx @modelcontextprotocol/server-github"
                className="w-full bg-glass border border-glass-border rounded-xl px-4 py-2 text-text-main placeholder-text-muted outline-none focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">API Key (Optional)</label>
              <input
                type="password"
                value={newServer.apiKey}
                onChange={(e) => setNewServer({ ...newServer, apiKey: e.target.value })}
                placeholder="Enter API key if required"
                className="w-full bg-glass border border-glass-border rounded-xl px-4 py-2 text-text-main placeholder-text-muted outline-none focus:border-primary transition-colors"
              />
            </div>

            <button
              onClick={addServer}
              disabled={isSaving}
              className="w-full bg-primary hover:bg-primary/80 text-white py-3 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Adding...' : 'Add Server'}
            </button>
          </div>
        </div>

        <div className="mt-6 p-4 bg-glass/50 border border-glass-border rounded-xl">
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            About MCP
          </h4>
          <p className="text-sm text-text-muted">
            Model Context Protocol allows AI assistants to connect to external tools and data sources.
            Configure MCP servers to enhance your AI assistant with capabilities like file system access,
            web browsing, database queries, and more.
          </p>
        </div>
      </div>
    </div>
  );
}

export default MCPSettings;
