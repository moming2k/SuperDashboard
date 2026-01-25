import React, { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';

function CalendarCompactWidget() {
    const [eventCount, setEventCount] = useState(0);

    useEffect(() => {
        fetchTodayEvents();
    }, []);

    const fetchTodayEvents = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/plugins/calendar/today`);
            const data = await res.json();
            setEventCount(data.length);
        } catch (error) {
            console.error('Failed to fetch today events:', error);
        }
    };

    return (
        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 backdrop-blur-xl border border-blue-500/30 rounded-2xl p-6 h-full flex flex-col justify-center items-center">
            <div className="text-5xl mb-2">📅</div>
            <div className="text-4xl font-bold text-text-main mb-1">{eventCount}</div>
            <div className="text-sm text-text-muted">
                {eventCount === 1 ? 'Event Today' : 'Events Today'}
            </div>
        </div>
    );
}

export default CalendarCompactWidget;
