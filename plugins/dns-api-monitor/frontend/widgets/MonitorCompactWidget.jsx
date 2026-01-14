import React, { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const MonitorCompactWidget = () => {
  const [monitorCount, setMonitorCount] = useState(0);
  const [healthyCount, setHealthyCount] = useState(0);

  useEffect(() => {
    const fetchMonitors = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/plugins/dns-api-monitor/monitors`);
        const data = await response.json();
        setMonitorCount(data.length);
        setHealthyCount(data.filter(m => m.status === 'healthy').length);
      } catch (error) {
        console.error('Failed to fetch monitors:', error);
      }
    };

    fetchMonitors();
  }, []);

  return (
    <div className="h-full flex flex-col items-center justify-center p-4">
      <div className="text-5xl mb-2">📡</div>
      <div className="flex gap-4 mt-2">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-400">{healthyCount}</div>
          <div className="text-xs text-text-muted">Healthy</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-text-main">{monitorCount}</div>
          <div className="text-xs text-text-muted">Total</div>
        </div>
      </div>
    </div>
  );
};

export default MonitorCompactWidget;
