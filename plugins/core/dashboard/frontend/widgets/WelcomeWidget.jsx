import React, { useState, useEffect } from 'react';
import config, { API_BASE } from '../../../../../../frontend/src/config';

function WelcomeWidget() {
  const [stats, setStats] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`${API_BASE}/health`);
        const data = await res.json();
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };

    fetchStats();

    // Update time every second
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <div className="flex flex-col h-full justify-between">
      <div>
        <h2 className="text-2xl font-bold mb-2">{getGreeting()}! 👋</h2>
        <p className="text-text-muted">
          Welcome to your SuperDashboard
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="bg-glass border border-glass-border rounded-xl p-3">
          <p className="text-text-muted text-xs mb-1">Status</p>
          <p className="text-lg font-bold text-green-400">{stats?.status || 'Loading...'}</p>
        </div>
        <div className="bg-glass border border-glass-border rounded-xl p-3">
          <p className="text-text-muted text-xs mb-1">Plugins</p>
          <p className="text-lg font-bold">{stats?.services?.plugins?.enabled || 0} Active</p>
        </div>
      </div>

      <div className="mt-4 text-text-muted text-sm">
        <p>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        <p>{currentTime.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
    </div>
  );
}

export default WelcomeWidget;
