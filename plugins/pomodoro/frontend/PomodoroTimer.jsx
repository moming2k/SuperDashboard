import React, { useState, useEffect, useRef } from 'react';

const WORK_TIME = 25 * 60; // 25 minutes in seconds
const BREAK_TIME = 5 * 60; // 5 minutes in seconds

function PomodoroTimer() {
  const [timeLeft, setTimeLeft] = useState(WORK_TIME);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState('work'); // 'work', 'break', or 'idle'
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const timerRef = useRef(null);
  const audioRef = useRef(null);

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Play notification sound
  const playNotification = () => {
    // Create a simple beep sound using Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  };

  // Timer effect
  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      // Timer reached 0
      playNotification();

      if (mode === 'work') {
        // Transition to break
        setMode('break');
        setTimeLeft(BREAK_TIME);
        setCompletedPomodoros((prev) => prev + 1);
      } else if (mode === 'break') {
        // Break finished, stop and wait
        setMode('idle');
        setIsRunning(false);
        setTimeLeft(WORK_TIME);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning, timeLeft, mode]);

  // Control handlers
  const handleStart = () => {
    if (mode === 'idle') {
      setMode('work');
      setTimeLeft(WORK_TIME);
    }
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setMode('work');
    setTimeLeft(WORK_TIME);
  };

  const handleSkipBreak = () => {
    setMode('work');
    setTimeLeft(WORK_TIME);
    setIsRunning(false);
  };

  // Get current mode display
  const getModeDisplay = () => {
    switch (mode) {
      case 'work':
        return { label: 'Work Time', color: 'text-red-400', bgColor: 'bg-red-500/20', borderColor: 'border-red-500/50' };
      case 'break':
        return { label: 'Break Time', color: 'text-green-400', bgColor: 'bg-green-500/20', borderColor: 'border-green-500/50' };
      case 'idle':
        return { label: 'Ready to Start', color: 'text-blue-400', bgColor: 'bg-blue-500/20', borderColor: 'border-blue-500/50' };
      default:
        return { label: 'Work Time', color: 'text-red-400', bgColor: 'bg-red-500/20', borderColor: 'border-red-500/50' };
    }
  };

  const modeDisplay = getModeDisplay();
  const progress = mode === 'work'
    ? ((WORK_TIME - timeLeft) / WORK_TIME) * 100
    : ((BREAK_TIME - timeLeft) / BREAK_TIME) * 100;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-red-400 to-orange-500 bg-clip-text text-transparent">
          🍅 Pomodoro Timer
        </h1>
        <p className="text-text-muted">
          Stay focused with the Pomodoro Technique: 25 minutes work, 5 minutes break
        </p>
      </div>

      {/* Main Timer Card */}
      <div className={`bg-bg-card backdrop-blur-xl border ${modeDisplay.borderColor} rounded-[32px] p-12 shadow-2xl mb-6 transition-all duration-500`}>
        {/* Mode Indicator */}
        <div className={`${modeDisplay.bgColor} ${modeDisplay.borderColor} border rounded-2xl p-4 mb-8 text-center`}>
          <h2 className={`text-2xl font-bold ${modeDisplay.color}`}>
            {modeDisplay.label}
          </h2>
        </div>

        {/* Timer Display */}
        <div className="text-center mb-8">
          <div className={`text-8xl font-bold ${modeDisplay.color} font-mono tracking-wider`}>
            {formatTime(timeLeft)}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-glass rounded-full h-4 mb-8 overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ${
              mode === 'work' ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-gradient-to-r from-green-500 to-emerald-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Control Buttons */}
        <div className="flex gap-4 justify-center">
          {!isRunning ? (
            <button
              onClick={handleStart}
              className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-8 py-4 rounded-xl font-semibold text-lg cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-[0_8px_20px_rgba(34,197,94,0.4)]"
            >
              {mode === 'idle' ? '▶ Start Pomodoro' : '▶ Resume'}
            </button>
          ) : (
            <button
              onClick={handlePause}
              className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-8 py-4 rounded-xl font-semibold text-lg cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-[0_8px_20px_rgba(234,179,8,0.4)]"
            >
              ⏸ Pause
            </button>
          )}

          <button
            onClick={handleReset}
            className="bg-glass backdrop-blur-xl border border-glass-border text-text-main px-8 py-4 rounded-xl font-semibold text-lg cursor-pointer transition-all duration-300 hover:scale-105 hover:border-primary"
          >
            ↻ Reset
          </button>

          {mode === 'break' && (
            <button
              onClick={handleSkipBreak}
              className="bg-glass backdrop-blur-xl border border-glass-border text-text-main px-8 py-4 rounded-xl font-semibold text-lg cursor-pointer transition-all duration-300 hover:scale-105 hover:border-accent"
            >
              ⏭ Skip Break
            </button>
          )}
        </div>
      </div>

      {/* Stats Card */}
      <div className="bg-bg-card backdrop-blur-xl border border-glass-border rounded-[24px] p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-text-muted text-sm mb-1">Completed Pomodoros Today</p>
            <p className="text-3xl font-bold text-primary">{completedPomodoros}</p>
          </div>
          <div className="text-6xl">🎯</div>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-8 bg-glass backdrop-blur-xl border border-glass-border rounded-2xl p-6">
        <h3 className="text-xl font-bold mb-4 text-text-main">How it works:</h3>
        <ul className="space-y-2 text-text-muted">
          <li className="flex items-start gap-2">
            <span className="text-red-400">🍅</span>
            <span><strong>Work Session:</strong> Focus for 25 minutes on a single task</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400">☕</span>
            <span><strong>Break Time:</strong> Take a 5-minute break automatically</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400">🔔</span>
            <span><strong>Notifications:</strong> Audio alert when transitioning between modes</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-400">⏸</span>
            <span><strong>Flexible:</strong> Pause, resume, or reset anytime</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

export default PomodoroTimer;
