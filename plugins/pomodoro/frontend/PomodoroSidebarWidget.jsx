import React, { useState, useEffect } from 'react';
import config, { API_BASE } from '../../config';

const PomodoroSidebarWidget = () => {
    const [timerState, setTimerState] = useState(null);
    const [currentTime, setCurrentTime] = useState(0);

    useEffect(() => {
        const fetchState = async () => {
            try {
                const res = await fetch(`${API_BASE}/plugins/pomodoro/state`);
                const data = await res.json();
                setTimerState(data);
            } catch (e) {
                console.error('Failed to fetch Pomodoro timer state', e);
            }
        };

        // Fetch immediately
        fetchState();

        // Fetch state from backend every 5 seconds (to stay in sync with auto-save)
        const fetchInterval = setInterval(fetchState, 5000);

        return () => clearInterval(fetchInterval);
    }, []);

    // Update countdown every second
    useEffect(() => {
        if (!timerState || !timerState.isRunning) {
            return;
        }

        // Calculate initial time based on lastUpdated
        const calculateCurrentTime = () => {
            if (!timerState.lastUpdated) {
                return timerState.timeLeft;
            }
            const lastUpdate = new Date(timerState.lastUpdated);
            const now = new Date();
            const elapsedSeconds = Math.floor((now - lastUpdate) / 1000);
            return Math.max(0, timerState.timeLeft - elapsedSeconds);
        };

        setCurrentTime(calculateCurrentTime());

        // Update countdown every second
        const countdownInterval = setInterval(() => {
            setCurrentTime(prev => Math.max(0, prev - 1));
        }, 1000);

        return () => clearInterval(countdownInterval);
    }, [timerState]);

    // Don't show widget if timer is not running
    if (!timerState || !timerState.isRunning) {
        return null;
    }

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const modeDisplay = timerState.mode === 'work' ? 'Work' : 'Break';
    const modeEmoji = timerState.mode === 'work' ? '🍅' : '☕';

    return (
        <div className="text-xs text-text-muted ml-8 mt-1 font-mono">
            {modeEmoji} {modeDisplay} {formatTime(currentTime)}
        </div>
    );
};

export default PomodoroSidebarWidget;
