import React, { useState, useEffect, useMemo } from 'react';
import { format, startOfWeek, addDays, isSameDay, isToday } from 'date-fns';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';

function CalendarDetailedWidget() {
    const [events, setEvents] = useState([]);
    const weekStart = useMemo(() => startOfWeek(new Date()), []);

    useEffect(() => {
        fetchWeekEvents();
    }, []);

    const fetchWeekEvents = async () => {
        try {
            const weekEnd = addDays(weekStart, 7);
            const res = await fetch(
                `${API_BASE_URL}/plugins/calendar/events?start_date=${weekStart.toISOString()}&end_date=${weekEnd.toISOString()}`
            );
            const data = await res.json();
            setEvents(data);
        } catch (error) {
            console.error('Failed to fetch week events:', error);
        }
    };

    const navigateToCalendar = () => {
        window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab: 'calendar' } }));
    };

    const renderWeekDays = () => {
        const days = [];
        for (let i = 0; i < 7; i++) {
            const day = addDays(weekStart, i);
            const dayEvents = events.filter(event =>
                isSameDay(new Date(event.start_time), day)
            );

            days.push(
                <div
                    key={i}
                    className={`p-2 rounded-lg text-center cursor-pointer transition-all
                     ${isToday(day) ? 'bg-primary/20 border border-primary' : 'hover:bg-glass/50'}`}
                    onClick={navigateToCalendar}
                >
                    <div className="text-xs text-text-muted mb-1">
                        {format(day, 'EEE')}
                    </div>
                    <div className={`text-lg font-semibold ${isToday(day) ? 'text-primary' : ''}`}>
                        {format(day, 'd')}
                    </div>
                    {dayEvents.length > 0 && (
                        <div className="flex justify-center gap-1 mt-1">
                            {dayEvents.slice(0, 3).map((event, idx) => (
                                <div
                                    key={idx}
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: event.color }}
                                />
                            ))}
                        </div>
                    )}
                </div>
            );
        }
        return days;
    };

    return (
        <div className="bg-glass backdrop-blur-xl border border-glass-border rounded-2xl p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <span>📅</span>
                    This Week
                </h3>
                <button
                    onClick={navigateToCalendar}
                    className="text-xs text-primary hover:text-primary/80"
                >
                    Open Calendar →
                </button>
            </div>

            <div className="grid grid-cols-7 gap-2 mb-4">
                {renderWeekDays()}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
                <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                    Upcoming This Week
                </div>
                {events.slice(0, 5).map((event) => (
                    <div
                        key={event.id}
                        className="p-2 rounded-lg bg-glass/50 text-sm"
                        style={{ borderLeft: `3px solid ${event.color}` }}
                    >
                        <div className="font-semibold truncate">{event.title}</div>
                        <div className="text-xs text-text-muted">
                            {format(new Date(event.start_time), 'EEE, h:mm a')}
                        </div>
                    </div>
                ))}
                {events.length === 0 && (
                    <div className="text-text-muted text-sm text-center py-4">
                        No events this week
                    </div>
                )}
            </div>
        </div>
    );
}

export default CalendarDetailedWidget;
