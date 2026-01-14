import React from 'react';
import { PomodoroProvider, usePomodoroContext } from '../context/PomodoroContext';

const PomodoroStandardWidgetInner = () => {
  const {
    timeLeft,
    mode,
    isRunning,
    start,
    pause,
    reset,
    formatTime,
    getModeDisplay
  } = usePomodoroContext();

  const modeDisplay = getModeDisplay();

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
      <div className={`text-center text-sm font-semibold mb-4 ${modeDisplay.color}`}>
        {modeDisplay.emoji} {modeDisplay.label}
      </div>

      {/* Timer Display */}
      <div className="text-5xl font-bold text-center mb-6">
        {formatTime(timeLeft)}
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <button
          onClick={handleToggle}
          className={`flex-1 p-3 rounded-xl font-semibold transition-all ${isRunning
              ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/30'
              : 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30'
            }`}
        >
          {isRunning ? '⏸ Pause' : '▶️ Start'}
        </button>
        <button
          onClick={reset}
          className="p-3 px-4 rounded-xl font-semibold bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 transition-all"
        >
          ↻
        </button>
      </div>

      {/* Status */}
      <div className="mt-4 text-center text-sm text-text-muted">
        {isRunning ? '🔥 Focus time!' : '⏸️ Paused'}
      </div>
    </div>
  );
};

const PomodoroStandardWidget = () => {
  return (
    <PomodoroProvider>
      <PomodoroStandardWidgetInner />
    </PomodoroProvider>
  );
};

PomodoroStandardWidget.displayName = 'Pomodoro Timer';

export default PomodoroStandardWidget;
