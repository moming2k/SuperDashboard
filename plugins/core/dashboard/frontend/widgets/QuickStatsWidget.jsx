import React, { useState, useEffect } from 'react';
import config, { API_BASE } from '@/config';

function QuickStatsWidget() {
  const [tasks, setTasks] = useState([]);
  const [plugins, setPlugins] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tasksRes, pluginsRes] = await Promise.all([
          fetch(`${API_BASE}/tasks`),
          fetch(`${API_BASE}/plugins`)
        ]);

        const tasksData = await tasksRes.json();
        const pluginsData = await pluginsRes.json();

        setTasks(tasksData);
        setPlugins(pluginsData);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s

    return () => clearInterval(interval);
  }, []);

  const tasksByStatus = tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {});

  const enabledPlugins = plugins.filter(p => p.enabled).length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 space-y-4">
        {/* Tasks Section */}
        <div>
          <p className="text-text-muted text-sm mb-2">Tasks</p>
          <div className="bg-glass border border-glass-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold">{tasks.length}</span>
              <span className="text-3xl">📝</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-text-muted">Pending</p>
                <p className="font-bold text-yellow-400">{tasksByStatus.pending || 0}</p>
              </div>
              <div>
                <p className="text-text-muted">Progress</p>
                <p className="font-bold text-blue-400">{tasksByStatus['in-progress'] || 0}</p>
              </div>
              <div>
                <p className="text-text-muted">Done</p>
                <p className="font-bold text-green-400">{tasksByStatus.completed || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Plugins Section */}
        <div>
          <p className="text-text-muted text-sm mb-2">Plugins</p>
          <div className="bg-glass border border-glass-border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{enabledPlugins}</p>
                <p className="text-text-muted text-xs">Active Plugins</p>
              </div>
              <span className="text-3xl">🧩</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default QuickStatsWidget;
