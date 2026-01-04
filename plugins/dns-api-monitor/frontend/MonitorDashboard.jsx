import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../config';

function MonitorDashboard() {
  const [dnsMonitors, setDnsMonitors] = useState([]);
  const [apiMonitors, setApiMonitors] = useState([]);
  const [activeTab, setActiveTab] = useState('dns');
  const [showAddForm, setShowAddForm] = useState(false);

  // DNS form state
  const [dnsForm, setDnsForm] = useState({
    domain: '',
    check_interval: 300
  });

  // API form state
  const [apiForm, setApiForm] = useState({
    url: '',
    method: 'GET',
    headers: '',
    body: '',
    check_interval: 300
  });

  const [expandedHistory, setExpandedHistory] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMonitors();
    const interval = setInterval(fetchMonitors, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchMonitors = async () => {
    try {
      const response = await fetch(`${API_BASE}/plugins/dns-api-monitor/monitors`);
      const data = await response.json();
      setDnsMonitors(data.dns || []);
      setApiMonitors(data.api || []);
    } catch (error) {
      console.error('Error fetching monitors:', error);
    }
  };

  const addDnsMonitor = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/plugins/dns-api-monitor/dns-monitors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dnsForm)
      });
      if (response.ok) {
        setDnsForm({ domain: '', check_interval: 300 });
        setShowAddForm(false);
        await fetchMonitors();
      }
    } catch (error) {
      console.error('Error adding DNS monitor:', error);
    } finally {
      setLoading(false);
    }
  };

  const addApiMonitor = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const headers = apiForm.headers ? JSON.parse(apiForm.headers) : null;
      const response = await fetch(`${API_BASE}/plugins/dns-api-monitor/api-monitors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: apiForm.url,
          method: apiForm.method,
          headers: headers,
          body: apiForm.body || null,
          check_interval: apiForm.check_interval
        })
      });
      if (response.ok) {
        setApiForm({ url: '', method: 'GET', headers: '', body: '', check_interval: 300 });
        setShowAddForm(false);
        await fetchMonitors();
      }
    } catch (error) {
      console.error('Error adding API monitor:', error);
      alert('Error: Invalid JSON in headers field');
    } finally {
      setLoading(false);
    }
  };

  const deleteMonitor = async (id, type) => {
    if (!confirm('Are you sure you want to delete this monitor?')) return;

    try {
      const endpoint = type === 'dns' ? 'dns-monitors' : 'api-monitors';
      await fetch(`${API_BASE}/plugins/dns-api-monitor/${endpoint}/${id}`, {
        method: 'DELETE'
      });
      await fetchMonitors();
    } catch (error) {
      console.error('Error deleting monitor:', error);
    }
  };

  const manualCheck = async (id, type) => {
    try {
      const endpoint = type === 'dns' ? 'dns-monitors' : 'api-monitors';
      const response = await fetch(`${API_BASE}/plugins/dns-api-monitor/${endpoint}/${id}/check`, {
        method: 'POST'
      });
      if (response.ok) {
        await fetchMonitors();
      }
    } catch (error) {
      console.error('Error triggering manual check:', error);
    }
  };

  const toggleHistory = (id) => {
    setExpandedHistory(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
          📡 DNS & API Monitor
        </h1>
        <p className="text-text-muted">
          Monitor DNS CNAME changes and API endpoint responses in real-time
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-glass backdrop-blur-xl border border-glass-border rounded-xl p-6">
          <div className="text-text-muted text-sm mb-1">DNS Monitors</div>
          <div className="text-3xl font-bold text-primary">{dnsMonitors.length}</div>
        </div>
        <div className="bg-glass backdrop-blur-xl border border-glass-border rounded-xl p-6">
          <div className="text-text-muted text-sm mb-1">API Monitors</div>
          <div className="text-3xl font-bold text-accent">{apiMonitors.length}</div>
        </div>
        <div className="bg-glass backdrop-blur-xl border border-glass-border rounded-xl p-6">
          <div className="text-text-muted text-sm mb-1">Total Changes</div>
          <div className="text-3xl font-bold text-yellow-400">
            {[...dnsMonitors, ...apiMonitors].reduce((sum, m) => sum + (m.changes_detected || 0), 0)}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('dns')}
          className={`px-6 py-3 rounded-xl font-semibold transition-all ${activeTab === 'dns'
              ? 'bg-primary text-white'
              : 'bg-glass text-text-muted hover:bg-glass-hover'
            }`}
        >
          DNS Monitors ({dnsMonitors.length})
        </button>
        <button
          onClick={() => setActiveTab('api')}
          className={`px-6 py-3 rounded-xl font-semibold transition-all ${activeTab === 'api'
              ? 'bg-accent text-white'
              : 'bg-glass text-text-muted hover:bg-glass-hover'
            }`}
        >
          API Monitors ({apiMonitors.length})
        </button>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="ml-auto bg-gradient-to-r from-primary to-accent text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
        >
          {showAddForm ? '✕ Cancel' : '+ Add Monitor'}
        </button>
      </div>

      {/* Add Monitor Form */}
      {showAddForm && (
        <div className="bg-glass backdrop-blur-xl border border-glass-border rounded-xl p-6 mb-6">
          {activeTab === 'dns' ? (
            <form onSubmit={addDnsMonitor}>
              <h3 className="text-xl font-bold mb-4">Add DNS Monitor</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-text-muted mb-2">Domain</label>
                  <input
                    type="text"
                    value={dnsForm.domain}
                    onChange={(e) => setDnsForm({ ...dnsForm, domain: e.target.value })}
                    placeholder="example.com"
                    className="w-full bg-bg-dark border border-glass-border rounded-lg px-4 py-2 text-text-main focus:outline-none focus:border-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-muted mb-2">Check Interval (seconds)</label>
                  <input
                    type="number"
                    value={dnsForm.check_interval}
                    onChange={(e) => setDnsForm({ ...dnsForm, check_interval: parseInt(e.target.value) })}
                    className="w-full bg-bg-dark border border-glass-border rounded-lg px-4 py-2 text-text-main focus:outline-none focus:border-primary"
                    min="60"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-primary text-white px-6 py-2 rounded-lg font-semibold hover:bg-primary-hover transition-all disabled:opacity-50"
                >
                  {loading ? 'Adding...' : 'Add DNS Monitor'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={addApiMonitor}>
              <h3 className="text-xl font-bold mb-4">Add API Monitor</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-text-muted mb-2">URL</label>
                  <input
                    type="url"
                    value={apiForm.url}
                    onChange={(e) => setApiForm({ ...apiForm, url: e.target.value })}
                    placeholder="https://api.example.com/endpoint"
                    className="w-full bg-bg-dark border border-glass-border rounded-lg px-4 py-2 text-text-main focus:outline-none focus:border-accent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-muted mb-2">Method</label>
                  <select
                    value={apiForm.method}
                    onChange={(e) => setApiForm({ ...apiForm, method: e.target.value })}
                    className="w-full bg-bg-dark border border-glass-border rounded-lg px-4 py-2 text-text-main focus:outline-none focus:border-accent"
                  >
                    <option>GET</option>
                    <option>POST</option>
                    <option>PUT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-text-muted mb-2">Headers (JSON)</label>
                  <textarea
                    value={apiForm.headers}
                    onChange={(e) => setApiForm({ ...apiForm, headers: e.target.value })}
                    placeholder='{"Authorization": "Bearer token"}'
                    className="w-full bg-bg-dark border border-glass-border rounded-lg px-4 py-2 text-text-main focus:outline-none focus:border-accent font-mono text-sm"
                    rows="3"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-muted mb-2">Body (for POST/PUT)</label>
                  <textarea
                    value={apiForm.body}
                    onChange={(e) => setApiForm({ ...apiForm, body: e.target.value })}
                    placeholder='{"key": "value"}'
                    className="w-full bg-bg-dark border border-glass-border rounded-lg px-4 py-2 text-text-main focus:outline-none focus:border-accent font-mono text-sm"
                    rows="3"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-muted mb-2">Check Interval (seconds)</label>
                  <input
                    type="number"
                    value={apiForm.check_interval}
                    onChange={(e) => setApiForm({ ...apiForm, check_interval: parseInt(e.target.value) })}
                    className="w-full bg-bg-dark border border-glass-border rounded-lg px-4 py-2 text-text-main focus:outline-none focus:border-accent"
                    min="60"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-accent text-white px-6 py-2 rounded-lg font-semibold hover:bg-accent-hover transition-all disabled:opacity-50"
                >
                  {loading ? 'Adding...' : 'Add API Monitor'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* DNS Monitors List */}
      {activeTab === 'dns' && (
        <div className="space-y-4">
          {dnsMonitors.length === 0 ? (
            <div className="bg-glass backdrop-blur-xl border border-glass-border rounded-xl p-8 text-center text-text-muted">
              No DNS monitors configured. Click "Add Monitor" to get started.
            </div>
          ) : (
            dnsMonitors.map((monitor) => (
              <div key={monitor.id} className="bg-glass backdrop-blur-xl border border-glass-border rounded-xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold">{monitor.domain}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${monitor.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                        {monitor.status}
                      </span>
                      {monitor.changes_detected > 0 && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-400">
                          {monitor.changes_detected} changes
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-text-muted space-y-1">
                      <div>Current CNAME: <span className="text-text-main font-mono">{monitor.last_cname || 'N/A'}</span></div>
                      <div>Last checked: {monitor.last_check ? formatTimestamp(monitor.last_check) : 'Never'}</div>
                      <div>Check interval: {monitor.check_interval}s</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => manualCheck(monitor.id, 'dns')}
                      className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-hover transition-all"
                    >
                      ⟳ Check Now
                    </button>
                    <button
                      onClick={() => deleteMonitor(monitor.id, 'dns')}
                      className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm font-semibold hover:bg-red-500/30 transition-all"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* History */}
                {monitor.history && monitor.history.length > 0 && (
                  <div>
                    <button
                      onClick={() => toggleHistory(monitor.id)}
                      className="text-sm text-primary hover:text-primary-hover font-semibold mb-2"
                    >
                      {expandedHistory[monitor.id] ? '▼' : '▶'} History ({monitor.history.length} changes)
                    </button>
                    {expandedHistory[monitor.id] && (
                      <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                        {monitor.history.slice().reverse().map((change, idx) => (
                          <div key={idx} className="bg-bg-dark rounded-lg p-3 text-sm">
                            <div className="text-text-muted mb-1">{formatTimestamp(change.timestamp)}</div>
                            <div className="text-text-main">
                              <span className="text-red-400 line-through">{change.old_value}</span>
                              {' → '}
                              <span className="text-green-400">{change.new_value}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* API Monitors List */}
      {activeTab === 'api' && (
        <div className="space-y-4">
          {apiMonitors.length === 0 ? (
            <div className="bg-glass backdrop-blur-xl border border-glass-border rounded-xl p-8 text-center text-text-muted">
              No API monitors configured. Click "Add Monitor" to get started.
            </div>
          ) : (
            apiMonitors.map((monitor) => (
              <div key={monitor.id} className="bg-glass backdrop-blur-xl border border-glass-border rounded-xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold break-all">{monitor.url}</h3>
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400">
                        {monitor.method}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${monitor.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                        {monitor.status}
                      </span>
                      {monitor.changes_detected > 0 && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-400">
                          {monitor.changes_detected} changes
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-text-muted space-y-1">
                      {monitor.last_response && (
                        <>
                          <div>Status: <span className={`font-semibold ${monitor.last_response.status_code >= 200 && monitor.last_response.status_code < 300
                              ? 'text-green-400'
                              : 'text-red-400'
                            }`}>{monitor.last_response.status_code}</span></div>
                          <div>Content hash: <span className="text-text-main font-mono text-xs">{monitor.last_hash}</span></div>
                        </>
                      )}
                      {monitor.last_error && (
                        <div className="text-red-400">Error: {monitor.last_error}</div>
                      )}
                      <div>Last checked: {monitor.last_check ? formatTimestamp(monitor.last_check) : 'Never'}</div>
                      <div>Check interval: {monitor.check_interval}s</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => manualCheck(monitor.id, 'api')}
                      className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent-hover transition-all"
                    >
                      ⟳ Check Now
                    </button>
                    <button
                      onClick={() => deleteMonitor(monitor.id, 'api')}
                      className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm font-semibold hover:bg-red-500/30 transition-all"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* History */}
                {monitor.history && monitor.history.length > 0 && (
                  <div>
                    <button
                      onClick={() => toggleHistory(monitor.id)}
                      className="text-sm text-accent hover:text-accent-hover font-semibold mb-2"
                    >
                      {expandedHistory[monitor.id] ? '▼' : '▶'} History ({monitor.history.length} changes)
                    </button>
                    {expandedHistory[monitor.id] && (
                      <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                        {monitor.history.slice().reverse().map((change, idx) => (
                          <div key={idx} className="bg-bg-dark rounded-lg p-3 text-sm">
                            <div className="text-text-muted mb-1">{formatTimestamp(change.timestamp)}</div>
                            <div className="text-text-main space-y-1">
                              <div>Status: <span className={`font-semibold ${change.status_code >= 200 && change.status_code < 300
                                  ? 'text-green-400'
                                  : 'text-red-400'
                                }`}>{change.status_code}</span></div>
                              <div className="font-mono text-xs">
                                <span className="text-red-400">{change.old_hash}</span>
                                {' → '}
                                <span className="text-green-400">{change.new_hash}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default MonitorDashboard;
