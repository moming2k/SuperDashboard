import React, { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const MonitorDetailedWidget = () => {
  const [monitors, setMonitors] = useState([]);
  const [stats, setStats] = useState({ healthy: 0, warning: 0, error: 0 });

  useEffect(() => {
    const fetchMonitors = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/plugins/dns-api-monitor/monitors`);
        const data = await response.json();
        setMonitors(data.slice(0, 8));

        // Calculate stats
        const newStats = {
          healthy: data.filter(m => m.status === 'healthy').length,
          warning: data.filter(m => m.status === 'warning').length,
          error: data.filter(m => m.status === 'error').length
        };
        setStats(newStats);
      } catch (error) {
        console.error('Failed to fetch monitors:', error);
      }
    };

    fetchMonitors();
    const interval = setInterval(fetchMonitors, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy': return 'text-green-400 bg-green-500/20';
      case 'warning': return 'text-yellow-400 bg-yellow-500/20';
      case 'error': return 'text-red-400 bg-red-500/20';
      default: return 'text-text-muted bg-glass';
    }
  };

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      <h3 className="text-lg font-bold mb-3 text-text-main flex items-center gap-2">
        <span>📡</span>
        <span>DNS & API Monitor</span>
      </h3>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-2 text-center">
          <div className="text-xl font-bold text-green-400">{stats.healthy}</div>
          <div className="text-xs text-text-muted">Healthy</div>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 text-center">
          <div className="text-xl font-bold text-yellow-400">{stats.warning}</div>
          <div className="text-xs text-text-muted">Warning</div>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-center">
          <div className="text-xl font-bold text-red-400">{stats.error}</div>
          <div className="text-xs text-text-muted">Error</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {monitors.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted text-sm">
            <div className="text-4xl mb-2">📡</div>
            <p>No monitors configured</p>
          </div>
        ) : (
          monitors.map((monitor) => (
            <div key={monitor.id} className="bg-glass rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm text-text-main">{monitor.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(monitor.status)}`}>
                  {monitor.status}
                </span>
              </div>
              <div className="text-xs text-text-muted truncate">{monitor.target}</div>
              {monitor.lastChecked && (
                <div className="text-xs text-text-muted mt-1">
                  Last checked: {new Date(monitor.lastChecked).toLocaleTimeString()}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <button
        onClick={() => window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab: 'dns-api-monitor' } }))}
        className="mt-3 w-full bg-primary text-white py-2 rounded-lg font-semibold text-sm hover:bg-primary/80 transition-all"
      >
        Open Monitor Dashboard
      </button>
    </div>
  );
};

export default MonitorDetailedWidget;
