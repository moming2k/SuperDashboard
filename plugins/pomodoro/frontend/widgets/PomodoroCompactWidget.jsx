import React from 'react';
import { PomodoroProvider, usePomodoroContext } from '../context/PomodoroContext';

const PomodoroCompactWidgetInner = () => {
  const { timeLeft, mode, isRunning, formatTime, getModeDisplay } = usePomodoroContext();

  const modeDisplay = getModeDisplay();

  return (
    <div className="flex flex-col items-center justify-center h-full p-4">
      {/* Mode Badge */}
      <div className={`text-sm font-semibold mb-2 ${modeDisplay.color}`}>
        {modeDisplay.emoji} {modeDisplay.label}
      </div>

      {/* Timer Display */}
      <div className="text-4xl font-bold mb-2">
        {formatTime(timeLeft)}
      </div>

      {/* Status Indicator */}
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
        <span>{isRunning ? 'Running' : 'Paused'}</span>
      </div>
    </div>
  );
};

const PomodoroCompactWidget = () => {
  return (
    <PomodoroProvider>
      <PomodoroCompactWidgetInner />
    </PomodoroProvider>
  );
};

PomodoroCompactWidget.displayName = 'Pomodoro Timer';

export default PomodoroCompactWidget;
