import React, { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const MonitorListWidget = () => {
  const [monitors, setMonitors] = useState([]);

  useEffect(() => {
    const fetchMonitors = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/plugins/dns-api-monitor/monitors`);
        const data = await response.json();
        setMonitors(data.slice(0, 5));
      } catch (error) {
        console.error('Failed to fetch monitors:', error);
      }
    };

    fetchMonitors();
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
        <span>Monitors</span>
      </h3>
      <div className="flex-1 overflow-y-auto space-y-2">
        {monitors.length === 0 ? (
          <div className="text-text-muted text-sm text-center py-4">
            No monitors configured
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
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MonitorListWidget;
