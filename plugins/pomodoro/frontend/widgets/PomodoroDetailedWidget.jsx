import React, { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const PomodoroDetailedWidget = () => {
  const [timeLeft, setTimeLeft] = useState(0);
  const [mode, setMode] = useState('work');
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState(null);

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Load timer state
  const loadTimerState = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/plugins/pomodoro/state`);
      const data = await response.json();

      if (data && data.id) {
        setTimeLeft(data.timeLeft || 1500);
        setMode(data.mode || 'work');
        setIsRunning(data.isRunning || false);
      }
    } catch (error) {
      console.error('Failed to load timer state:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/plugins/pomodoro/stats`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const saveTimerState = async (newState) => {
    try {
      await fetch(`${API_BASE_URL}/plugins/pomodoro/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newState)
      });
      loadTimerState();
    } catch (error) {
      console.error('Failed to save timer state:', error);
    }
  };

  useEffect(() => {
    loadTimerState();
    loadStats();
    const interval = setInterval(() => {
      loadTimerState();
      loadStats();
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = () => {
    saveTimerState({
      timeLeft,
      mode,
      isRunning: isRunning ? 0 : 1,
      completedPomodoros: 0
    });
  };

  const handleReset = async () => {
    try {
      await fetch(`${API_BASE_URL}/plugins/pomodoro/state/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      loadTimerState();
    } catch (error) {
      console.error('Failed to reset timer:', error);
    }
  };

  const getModeDisplay = () => {
    switch (mode) {
      case 'work':
        return { label: 'Work Time', color: 'text-red-400', bgColor: 'bg-red-500/20', borderColor: 'border-red-500/50' };
      case 'break':
        return { label: 'Break Time', color: 'text-green-400', bgColor: 'bg-green-500/20', borderColor: 'border-green-500/50' };
      case 'idle':
        return { label: 'Ready', color: 'text-blue-400', bgColor: 'bg-blue-500/20', borderColor: 'border-blue-500/50' };
      default:
        return { label: 'Work Time', color: 'text-red-400', bgColor: 'bg-red-500/20', borderColor: 'border-red-500/50' };
    }
  };

  const modeDisplay = getModeDisplay();
  const progress = mode === 'work'
    ? ((1500 - timeLeft) / 1500) * 100
    : ((300 - timeLeft) / 300) * 100;

  return (
    <div className="h-full flex flex-col p-4">
      <div className={`${modeDisplay.bgColor} ${modeDisplay.borderColor} border rounded-xl p-3 mb-4 text-center`}>
        <h3 className={`text-lg font-bold ${modeDisplay.color}`}>{modeDisplay.label}</h3>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="text-center mb-4">
          <div className={`text-6xl font-bold ${modeDisplay.color} font-mono`}>
            {formatTime(timeLeft)}
          </div>
        </div>

        <div className="w-full bg-glass rounded-full h-2 mb-4 overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ${
              mode === 'work' ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-gradient-to-r from-green-500 to-emerald-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={handleToggle}
            className={`flex-1 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
              isRunning
                ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
            }`}
          >
            {isRunning ? '⏸ Pause' : '▶ Start'}
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 rounded-lg font-semibold text-sm bg-glass text-text-muted hover:text-text-main transition-all"
          >
            ↻ Reset
          </button>
        </div>

        {stats && (
          <div className="bg-glass rounded-xl p-3">
            <h4 className="text-sm font-semibold mb-3 text-text-main">📊 Statistics</h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-bg-card rounded-lg p-2 text-center">
                <p className="text-xl font-bold text-primary">{stats.todaySessions}</p>
                <p className="text-xs text-text-muted">Today</p>
              </div>
              <div className="bg-bg-card rounded-lg p-2 text-center">
                <p className="text-xl font-bold text-accent">{stats.weekSessions}</p>
                <p className="text-xs text-text-muted">This Week</p>
              </div>
              <div className="bg-bg-card rounded-lg p-2 text-center">
                <p className="text-xl font-bold text-green-400">{stats.totalSessions}</p>
                <p className="text-xs text-text-muted">Total</p>
              </div>
              <div className="bg-bg-card rounded-lg p-2 text-center">
                <p className="text-xl font-bold text-blue-400">{stats.totalWorkHours}h</p>
                <p className="text-xs text-text-muted">Hours</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PomodoroDetailedWidget;
