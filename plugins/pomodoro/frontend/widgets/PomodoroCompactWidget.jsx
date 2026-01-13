import React, { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const PomodoroCompactWidget = () => {
  const [timeLeft, setTimeLeft] = useState(0);
  const [mode, setMode] = useState('work');
  const [isRunning, setIsRunning] = useState(false);

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

  useEffect(() => {
    loadTimerState();
    const interval = setInterval(loadTimerState, 2000);
    return () => clearInterval(interval);
  }, []);

  const getModeDisplay = () => {
    switch (mode) {
      case 'work':
        return { label: 'Work', color: 'text-red-400', bgColor: 'bg-red-500/20' };
      case 'break':
        return { label: 'Break', color: 'text-green-400', bgColor: 'bg-green-500/20' };
      case 'idle':
        return { label: 'Ready', color: 'text-blue-400', bgColor: 'bg-blue-500/20' };
      default:
        return { label: 'Work', color: 'text-red-400', bgColor: 'bg-red-500/20' };
    }
  };

  const modeDisplay = getModeDisplay();

  return (
    <div className="h-full flex flex-col items-center justify-center p-4">
      <div className="text-5xl mb-2">🍅</div>
      <div className={`text-4xl font-bold ${modeDisplay.color} font-mono mb-2`}>
        {formatTime(timeLeft)}
      </div>
      <div className={`${modeDisplay.bgColor} px-3 py-1 rounded-lg flex items-center gap-2`}>
        <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></span>
        <span className="text-sm text-text-muted">{modeDisplay.label}</span>
      </div>
    </div>
  );
};

export default PomodoroCompactWidget;
