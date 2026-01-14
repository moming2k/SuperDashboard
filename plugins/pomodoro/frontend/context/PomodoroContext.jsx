import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const PomodoroContext = createContext(null);

// Constants
const WORK_TIME = 1500; // 25 minutes
const BREAK_TIME = 300; // 5 minutes

export const PomodoroProvider = ({ children }) => {
    // State
    const [timeLeft, setTimeLeft] = useState(WORK_TIME);
    const [mode, setMode] = useState('work');
    const [isRunning, setIsRunning] = useState(false);
    const [completedPomodoros, setCompletedPomodoros] = useState(0);
    const [isLoaded, setIsLoaded] = useState(false);

    // Refs
    const channelRef = useRef(null);
    const syncIntervalRef = useRef(null);
    const timerIntervalRef = useRef(null);
    const lastSyncRef = useRef(Date.now());

    // Format time as MM:SS
    const formatTime = useCallback((seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, []);

    // Get mode display
    const getModeDisplay = useCallback(() => {
        switch (mode) {
            case 'work':
                return { label: 'Work', emoji: '🍅', color: 'text-red-400' };
            case 'break':
                return { label: 'Break', emoji: '☕', color: 'text-green-400' };
            case 'idle':
                return { label: 'Idle', emoji: '⏸️', color: 'text-gray-400' };
            default:
                return { label: 'Unknown', emoji: '❓', color: 'text-gray-400' };
        }
    }, [mode]);

    // Save state to backend
    const saveToBackend = useCallback(async (stateOverride = {}) => {
        try {
            const state = {
                timeLeft: stateOverride.timeLeft ?? timeLeft,
                mode: stateOverride.mode ?? mode,
                isRunning: stateOverride.isRunning ?? isRunning,
                completedPomodoros: stateOverride.completedPomodoros ?? completedPomodoros
            };

            await fetch(`${API_BASE_URL}/plugins/pomodoro/state`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(state)
            });

            lastSyncRef.current = Date.now();
        } catch (error) {
            console.error('Failed to save timer state:', error);
        }
    }, [timeLeft, mode, isRunning, completedPomodoros]);

    // Load state from backend
    const loadFromBackend = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/plugins/pomodoro/state`);
            const data = await response.json();

            if (data && data.id) {
                setTimeLeft(data.timeLeft || WORK_TIME);
                setMode(data.mode || 'work');
                setIsRunning(data.isRunning || false);
                setCompletedPomodoros(data.completedPomodoros || 0);
            }
            setIsLoaded(true);
        } catch (error) {
            console.error('Failed to load timer state:', error);
            setIsLoaded(true);
        }
    }, []);

    // Broadcast state to other tabs
    const broadcastState = useCallback((updates = {}) => {
        if (channelRef.current) {
            channelRef.current.postMessage({
                type: 'STATE_UPDATE',
                data: {
                    timeLeft: updates.timeLeft ?? timeLeft,
                    mode: updates.mode ?? mode,
                    isRunning: updates.isRunning ?? isRunning,
                    completedPomodoros: updates.completedPomodoros ?? completedPomodoros,
                    timestamp: Date.now()
                }
            });
        }
    }, [timeLeft, mode, isRunning, completedPomodoros]);

    // Handle timer completion
    const handleTimerComplete = useCallback(() => {
        setIsRunning(false);

        if (mode === 'work') {
            // Transition to break
            setMode('break');
            setTimeLeft(BREAK_TIME);
            setCompletedPomodoros(prev => prev + 1);

            // Save and broadcast
            const newState = {
                mode: 'break',
                timeLeft: BREAK_TIME,
                isRunning: false,
                completedPomodoros: completedPomodoros + 1
            };
            saveToBackend(newState);
            broadcastState(newState);

            // Trigger notification
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('🍅 Work Session Complete!', {
                    body: 'Great job! Time for a 5-minute break.',
                    icon: '/favicon.ico'
                });
            }
        } else if (mode === 'break') {
            // Transition to idle
            setMode('idle');
            setTimeLeft(WORK_TIME);

            // Save and broadcast
            const newState = {
                mode: 'idle',
                timeLeft: WORK_TIME,
                isRunning: false
            };
            saveToBackend(newState);
            broadcastState(newState);

            // Trigger notification
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('☕ Break Time Over!', {
                    body: 'Ready to start another Pomodoro?',
                    icon: '/favicon.ico'
                });
            }
        }
    }, [mode, completedPomodoros, saveToBackend, broadcastState]);

    // Actions
    const start = useCallback(() => {
        if (mode === 'idle') {
            setMode('work');
            setTimeLeft(WORK_TIME);
        }
        setIsRunning(true);

        const newState = {
            mode: mode === 'idle' ? 'work' : mode,
            timeLeft: mode === 'idle' ? WORK_TIME : timeLeft,
            isRunning: true
        };
        saveToBackend(newState);
        broadcastState(newState);
    }, [mode, timeLeft, saveToBackend, broadcastState]);

    const pause = useCallback(() => {
        setIsRunning(false);
        saveToBackend({ isRunning: false });
        broadcastState({ isRunning: false });
    }, [saveToBackend, broadcastState]);

    const reset = useCallback(async () => {
        try {
            await fetch(`${API_BASE_URL}/plugins/pomodoro/state/reset`, {
                method: 'POST'
            });

            setIsRunning(false);
            setMode('work');
            setTimeLeft(WORK_TIME);

            broadcastState({
                isRunning: false,
                mode: 'work',
                timeLeft: WORK_TIME
            });
        } catch (error) {
            console.error('Failed to reset timer:', error);
        }
    }, [broadcastState]);

    const skipBreak = useCallback(() => {
        setMode('work');
        setTimeLeft(WORK_TIME);
        setIsRunning(false);

        const newState = {
            mode: 'work',
            timeLeft: WORK_TIME,
            isRunning: false
        };
        saveToBackend(newState);
        broadcastState(newState);
    }, [saveToBackend, broadcastState]);

    // Initialize: Load from backend and setup BroadcastChannel
    useEffect(() => {
        loadFromBackend();

        // Setup BroadcastChannel for cross-tab communication
        channelRef.current = new BroadcastChannel('pomodoro-timer');

        channelRef.current.onmessage = (event) => {
            const { type, data } = event.data;

            if (type === 'STATE_UPDATE') {
                // Only update if the message is newer than our last sync
                if (data.timestamp > lastSyncRef.current) {
                    setTimeLeft(data.timeLeft);
                    setMode(data.mode);
                    setIsRunning(data.isRunning);
                    if (data.completedPomodoros !== undefined) {
                        setCompletedPomodoros(data.completedPomodoros);
                    }
                    lastSyncRef.current = data.timestamp;
                }
            }
        };

        return () => {
            channelRef.current?.close();
        };
    }, [loadFromBackend]);

    // Local countdown timer (runs every second)
    useEffect(() => {
        if (isRunning && timeLeft > 0) {
            timerIntervalRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        handleTimerComplete();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }

        return () => {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        };
    }, [isRunning, timeLeft, handleTimerComplete]);

    // Periodic backend sync (every 10 seconds while running)
    useEffect(() => {
        if (isRunning) {
            syncIntervalRef.current = setInterval(() => {
                saveToBackend();
            }, 10000);
        }

        return () => {
            if (syncIntervalRef.current) {
                clearInterval(syncIntervalRef.current);
            }
        };
    }, [isRunning, saveToBackend]);

    // Save on page unload
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (isRunning) {
                saveToBackend();
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isRunning, saveToBackend]);

    const value = {
        // State
        timeLeft,
        mode,
        isRunning,
        completedPomodoros,
        isLoaded,

        // Actions
        start,
        pause,
        reset,
        skipBreak,

        // Utilities
        formatTime,
        getModeDisplay,

        // Constants
        WORK_TIME,
        BREAK_TIME
    };

    return (
        <PomodoroContext.Provider value={value}>
            {children}
        </PomodoroContext.Provider>
    );
};

// Custom hook to use the context
export const usePomodoroContext = () => {
    const context = useContext(PomodoroContext);
    if (!context) {
        throw new Error('usePomodoroContext must be used within a PomodoroProvider');
    }
    return context;
};

export default PomodoroContext;
