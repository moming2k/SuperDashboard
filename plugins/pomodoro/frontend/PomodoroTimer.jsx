import React, { useState, useEffect, useRef } from 'react';

const WORK_TIME = 25 * 60; // 25 minutes in seconds
const BREAK_TIME = 5 * 60; // 5 minutes in seconds
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function PomodoroTimer() {
  const [timeLeft, setTimeLeft] = useState(WORK_TIME);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState('work'); // 'work', 'break', or 'idle'
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState('default');
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [sessionNotes, setSessionNotes] = useState('');
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [stateLoaded, setStateLoaded] = useState(false); // Track if state has been loaded
  const timerRef = useRef(null);
  const audioRef = useRef(null);

  // Request notification permission and load data on mount
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);

      if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          setNotificationPermission(permission);
        });
      }
    }

    // Load session history, stats, and timer state
    loadSessions();
    loadStats();
    loadTimerState().then(() => {
      setStateLoaded(true); // Mark state as loaded
    });
  }, []);

  // Helper function to send notification to backend
  const sendNotificationToBackend = async (title, description, priority = 'medium') => {
    try {
      await fetch(`${API_BASE_URL}/plugins/pomodoro/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, priority })
      });
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  };

  // Helper function to create session record
  const createSessionRecord = async (sessionType, startTime, endTime, completed = true) => {
    try {
      await fetch(`${API_BASE_URL}/plugins/pomodoro/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionType,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          completed,
          notes: sessionNotes,
          tags: ''
        })
      });
      setSessionNotes(''); // Clear notes after saving
      loadSessions(); // Reload session list
      loadStats(); // Reload stats
    } catch (error) {
      console.error('Failed to create session record:', error);
    }
  };

  // Load session history
  const loadSessions = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/plugins/pomodoro/sessions?limit=10`);
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  // Load statistics
  const loadStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/plugins/pomodoro/stats`);
      const data = await response.json();
      setStats(data);
      // Update completed pomodoros counter from today's stats
      if (data.todaySessions !== undefined) {
        setCompletedPomodoros(data.todaySessions);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  // Load timer state from backend
  const loadTimerState = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/plugins/pomodoro/state`);
      const data = await response.json();

      if (data && data.id) {
        // Backend already calculates elapsed time, just use the values directly
        setTimeLeft(data.timeLeft || WORK_TIME);
        setMode(data.mode || 'work');
        setIsRunning(data.isRunning || false);
        setCompletedPomodoros(data.completedPomodoros || 0);
      }
    } catch (error) {
      console.error('Failed to load timer state:', error);
    }
  };

  // Use refs to track the latest state values
  const stateRef = useRef({ timeLeft, mode, isRunning, completedPomodoros });

  // Update ref whenever state changes
  useEffect(() => {
    stateRef.current = { timeLeft, mode, isRunning, completedPomodoros };
  }, [timeLeft, mode, isRunning, completedPomodoros]);

  // Save timer state to backend using current state from ref
  const saveTimerState = async () => {
    try {
      const currentState = stateRef.current;
      await fetch(`${API_BASE_URL}/plugins/pomodoro/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeLeft: currentState.timeLeft,
          mode: currentState.mode,
          isRunning: currentState.isRunning ? 1 : 0, // Convert boolean to integer
          completedPomodoros: currentState.completedPomodoros
        })
      });
    } catch (error) {
      console.error('Failed to save timer state:', error);
    }
  };


  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Format relative time (e.g., "5 minutes ago", "2 hours ago")
  const formatRelativeTime = (timestamp) => {
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    // For older sessions, show the full date
    return past.toLocaleDateString();
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

  // Show desktop notification
  const showDesktopNotification = (title, body, icon) => {
    if ('Notification' in window && notificationPermission === 'granted') {
      new Notification(title, {
        body,
        icon: icon || '🍅',
        badge: '🍅',
        requireInteraction: false,
        silent: false
      });
    }
  };

  // Poll backend for timer state (like widgets do)
  useEffect(() => {
    const pollInterval = setInterval(() => {
      loadTimerState();
    }, 500); // Poll every 500ms for smooth updates

    return () => clearInterval(pollInterval);
  }, []);

  // Watch for mode transitions to trigger notifications
  const prevModeRef = useRef(mode);
  const prevTimeLeftRef = useRef(timeLeft);

  useEffect(() => {
    const prevMode = prevModeRef.current;
    const prevTimeLeft = prevTimeLeftRef.current;

    // Detect work session completion (work mode ended with time at 0)
    if (prevMode === 'work' && mode === 'break' && prevTimeLeft > 0 && timeLeft <= 300) {
      playNotification();
      const title = '🍅 Work Session Complete!';
      const description = 'Great job! Time for a 5-minute break.';
      showDesktopNotification(title, description, '🍅');
      sendNotificationToBackend(title, description, 'medium');

      // Create session record
      if (sessionStartTime) {
        const endTime = new Date();
        createSessionRecord('work', sessionStartTime, endTime, true);
        setCompletedPomodoros((prev) => prev + 1); // Increment here as backend doesn't do it
        setSessionStartTime(new Date()); // Start break session
      }
    }

    // Detect break completion
    if (prevMode === 'break' && mode === 'idle') {
      playNotification();
      const title = '☕ Break Time Over!';
      const description = 'Ready to start another Pomodoro?';
      showDesktopNotification(title, description, '🍅');
      sendNotificationToBackend(title, description, 'low');

      // Create break session record
      if (sessionStartTime) {
        const endTime = new Date();
        createSessionRecord('break', sessionStartTime, endTime, true);
        setSessionStartTime(null);
      }
    }

    prevModeRef.current = mode;
    prevTimeLeftRef.current = timeLeft;
  }, [mode, timeLeft, sessionStartTime]);

  // Control handlers
  const handleStart = async () => {
    if (mode === 'idle') {
      setMode('work');
      setTimeLeft(WORK_TIME);
      setSessionStartTime(new Date()); // Track session start time
    }
    setIsRunning(true);
    // Manually update ref to ensure save gets correct value
    stateRef.current = {
      ...stateRef.current,
      isRunning: true,
      mode: mode === 'idle' ? 'work' : mode,
      timeLeft: mode === 'idle' ? WORK_TIME : stateRef.current.timeLeft
    };
    await saveTimerState(); // Save to backend immediately on start
  };

  const handleResume = async () => {
    if (!sessionStartTime && mode === 'work') {
      setSessionStartTime(new Date()); // Track if resuming
    }
    setIsRunning(true);
    // Manually update ref to ensure save gets correct value
    stateRef.current = { ...stateRef.current, isRunning: true };
    await saveTimerState(); // Save to backend immediately on resume
  };

  const handlePause = async () => {
    setIsRunning(false);
    // Manually update ref to ensure save gets correct value
    stateRef.current = { ...stateRef.current, isRunning: false };
    await saveTimerState(); // Save to backend immediately on pause
  };

  const handleReset = async () => {
    try {
      // Call backend to reset state
      await fetch(`${API_BASE_URL}/plugins/pomodoro/state/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      // Update local state
      setIsRunning(false);
      setMode('work');
      setTimeLeft(WORK_TIME);
      setSessionStartTime(null);
    } catch (error) {
      console.error('Failed to reset timer:', error);
      // Still update local state even if backend fails
      setIsRunning(false);
      setMode('work');
      setTimeLeft(WORK_TIME);
      setSessionStartTime(null);
    }
  };

  const handleSkipBreak = async () => {
    setMode('work');
    setTimeLeft(WORK_TIME);
    setIsRunning(false);
    setSessionStartTime(null);
    // Manually update ref to ensure save gets correct value
    stateRef.current = {
      ...stateRef.current,
      mode: 'work',
      timeLeft: WORK_TIME,
      isRunning: false
    };
    await saveTimerState(); // Save immediately on skip
  };

  const handleRequestNotification = () => {
    if ('Notification' in window && notificationPermission !== 'granted') {
      Notification.requestPermission().then((permission) => {
        setNotificationPermission(permission);
      });
    }
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

        {/* Notification Status Banner */}
        {notificationPermission === 'granted' && (
          <div className="mt-4 bg-green-500/10 border border-green-500/30 rounded-xl p-3 flex items-center gap-2">
            <span className="text-green-400">🔔</span>
            <span className="text-sm text-green-400">Desktop notifications enabled</span>
          </div>
        )}
        {notificationPermission === 'denied' && (
          <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-2">
            <span className="text-red-400">🔕</span>
            <span className="text-sm text-red-400">Desktop notifications blocked</span>
          </div>
        )}
        {notificationPermission === 'default' && 'Notification' in window && (
          <div className="mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-yellow-400">🔔</span>
              <span className="text-sm text-yellow-400">Desktop notifications available</span>
            </div>
            <button
              onClick={handleRequestNotification}
              className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 px-4 py-1 rounded-lg text-sm font-semibold transition-all"
            >
              Enable
            </button>
          </div>
        )}
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
            className={`h-full transition-all duration-1000 ${mode === 'work' ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-gradient-to-r from-green-500 to-emerald-500'
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

      {/* Session Notes Input */}
      {mode === 'work' && isRunning && (
        <div className="bg-bg-card backdrop-blur-xl border border-glass-border rounded-[24px] p-6 shadow-xl mb-6">
          <h3 className="text-lg font-bold mb-3 text-text-main">📝 Session Notes</h3>
          <textarea
            value={sessionNotes}
            onChange={(e) => setSessionNotes(e.target.value)}
            placeholder="What are you working on? (optional)"
            className="w-full bg-glass border border-glass-border rounded-xl p-3 text-text-main placeholder-text-muted resize-none focus:outline-none focus:border-primary transition-colors"
            rows="3"
          />
          <p className="text-xs text-text-muted mt-2">Notes will be saved when the session completes</p>
        </div>
      )}

      {/* Statistics Dashboard */}
      {stats && (
        <div className="bg-bg-card backdrop-blur-xl border border-glass-border rounded-[24px] p-6 shadow-xl mb-6">
          <h3 className="text-lg font-bold mb-4 text-text-main flex items-center gap-2">
            📊 Statistics
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-glass rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-primary">{stats.todaySessions}</p>
              <p className="text-xs text-text-muted mt-1">Today</p>
            </div>
            <div className="bg-glass rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-accent">{stats.weekSessions}</p>
              <p className="text-xs text-text-muted mt-1">This Week</p>
            </div>
            <div className="bg-glass rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-400">{stats.totalSessions}</p>
              <p className="text-xs text-text-muted mt-1">All Time</p>
            </div>
            <div className="bg-glass rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-blue-400">{stats.totalWorkHours}h</p>
              <p className="text-xs text-text-muted mt-1">Total Hours</p>
            </div>
          </div>
        </div>
      )}

      {/* Session History */}
      <div className="bg-bg-card backdrop-blur-xl border border-glass-border rounded-[24px] p-6 shadow-xl mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
            📜 Session History
          </h3>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-sm text-primary hover:text-accent transition-colors"
          >
            {showHistory ? 'Hide' : 'Show'}
          </button>
        </div>

        {showHistory && (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {sessions.length === 0 ? (
              <p className="text-text-muted text-sm text-center py-4">No sessions yet. Complete a Pomodoro to see history!</p>
            ) : (
              sessions.map((session) => (
                <div key={session.id} className="bg-glass rounded-xl p-4 border border-glass-border">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{session.sessionType === 'work' ? '🍅' : '☕'}</span>
                        <span className="font-semibold text-text-main capitalize">{session.sessionType} Session</span>
                        {session.completed && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">✓ Completed</span>}
                      </div>
                      <p className="text-xs text-text-muted">
                        {formatRelativeTime(session.startTime)}
                      </p>
                      {session.notes && (
                        <p className="text-sm text-text-main mt-2 bg-bg-main/50 rounded p-2">{session.notes}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Stats Card */}
      <div className="bg-bg-card backdrop-blur-xl border border-glass-border rounded-[24px] p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-text-muted text-sm mb-1">Completed Pomodoros Today</p>
            <p className="text-3xl font-bold text-primary">{stats?.todaySessions || 0}</p>
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
            <span><strong>Notifications:</strong> Audio alerts and desktop notifications when transitioning between modes</span>
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
