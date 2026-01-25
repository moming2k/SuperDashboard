import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';

function CalendarUpcomingWidget() {
    const [events, setEvents] = useState([]);

    useEffect(() => {
        fetchUpcomingEvents();
    }, []);

    const fetchUpcomingEvents = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/plugins/calendar/upcoming?days=7`);
            const data = await res.json();
            setEvents(data.slice(0, 5));
        } catch (error) {
            console.error('Failed to fetch upcoming events:', error);
        }
    };

    const navigateToCalendar = () => {
        window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab: 'calendar' } }));
    };

    return (
        <div className="bg-glass backdrop-blur-xl border border-glass-border rounded-2xl p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <span>📅</span>
                    Upcoming Events
                </h3>
                <button
                    onClick={navigateToCalendar}
                    className="text-xs text-primary hover:text-primary/80"
                >
                    View All →
                </button>
            </div>

            {events.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-text-muted">
                    No upcoming events
                </div>
            ) : (
                <div className="space-y-3 flex-1 overflow-y-auto">
                    {events.map((event) => (
                        <div
                            key={event.id}
                            className="p-3 rounded-lg bg-glass/50 border border-glass-border hover:bg-glass transition-colors"
                            style={{ borderLeftColor: event.color, borderLeftWidth: '4px' }}
                        >
                            <div className="font-semibold text-text-main truncate">{event.title}</div>
                            <div className="text-xs text-text-muted mt-1">
                                {format(new Date(event.start_time), 'MMM d, h:mm a')}
                            </div>
                            {event.location && (
                                <div className="text-xs text-text-muted mt-1">📍 {event.location}</div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default CalendarUpcomingWidget;
