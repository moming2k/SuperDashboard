import React, { useState, useEffect } from 'react';
import { PomodoroProvider, usePomodoroContext } from '../context/PomodoroContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const PomodoroDetailedWidgetInner = () => {
  const {
    timeLeft,
    mode,
    isRunning,
    completedPomodoros,
    start,
    pause,
    reset,
    skipBreak,
    formatTime,
    getModeDisplay
  } = usePomodoroContext();

  const [stats, setStats] = useState(null);

  const modeDisplay = getModeDisplay();

  // Load stats
  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/plugins/pomodoro/stats`);
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('Failed to load stats:', error);
      }
    };

    loadStats();
    const interval = setInterval(loadStats, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const handleToggle = () => {
    if (isRunning) {
      pause();
    } else {
      start();
    }
  };

  return (
    <div className="flex flex-col h-full p-4">
      {/* Mode Badge */}
      <div className={`text-center text-sm font-semibold mb-3 ${modeDisplay.color}`}>
        {modeDisplay.emoji} {modeDisplay.label}
      </div>

      {/* Timer Display */}
      <div className="text-5xl font-bold text-center mb-4">
        {formatTime(timeLeft)}
      </div>

      {/* Controls */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={handleToggle}
          className={`flex-1 p-2 rounded-xl font-semibold text-sm transition-all ${isRunning
              ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/30'
              : 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30'
            }`}
        >
          {isRunning ? '⏸ Pause' : '▶️ Start'}
        </button>
        <button
          onClick={reset}
          className="p-2 px-3 rounded-xl font-semibold text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 transition-all"
        >
          ↻ Reset
        </button>
      </div>

      {/* Skip Break Button */}
      {mode === 'break' && (
        <button
          onClick={skipBreak}
          className="w-full p-2 rounded-xl font-semibold text-sm bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 transition-all mb-4"
        >
          ⏭ Skip Break
        </button>
      )}

      {/* Stats */}
      {stats && (
        <div className="bg-glass border border-glass-border rounded-xl p-3">
          <div className="text-xs text-text-muted mb-2">Today's Progress</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <div className="text-text-muted text-xs">Completed</div>
              <div className="font-bold text-primary">{stats.todaySessions || 0} 🍅</div>
            </div>
            <div>
              <div className="text-text-muted text-xs">This Week</div>
              <div className="font-bold text-accent">{stats.weekSessions || 0} 🍅</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PomodoroDetailedWidget = () => {
  return (
    <PomodoroProvider>
      <PomodoroDetailedWidgetInner />
    </PomodoroProvider>
  );
};

PomodoroDetailedWidget.displayName = 'Pomodoro Timer';

export default PomodoroDetailedWidget;
