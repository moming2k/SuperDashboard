import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday } from 'date-fns';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';

function Calendar() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState([]);
    const [selectedDate, setSelectedDate] = useState(null);
    const [showEventModal, setShowEventModal] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        start_time: '',
        end_time: '',
        location: '',
        color: '#3B82F6',
        all_day: false,
        reminder_minutes: 15,
    });

    useEffect(() => {
        fetchEvents();
    }, [currentDate]);

    const fetchEvents = async () => {
        try {
            const monthStart = startOfMonth(currentDate);
            const monthEnd = endOfMonth(currentDate);

            const res = await fetch(
                `${API_BASE_URL}/plugins/calendar/events?start_date=${monthStart.toISOString()}&end_date=${monthEnd.toISOString()}`
            );
            const data = await res.json();
            setEvents(data);
        } catch (error) {
            console.error('Failed to fetch events:', error);
        }
    };

    const handleCreateEvent = async () => {
        try {
            const eventData = {
                ...formData,
                start_time: new Date(formData.start_time).toISOString(),
                end_time: new Date(formData.end_time).toISOString(),
            };

            const url = selectedEvent
                ? `${API_BASE_URL}/plugins/calendar/events/${selectedEvent.id}`
                : `${API_BASE_URL}/plugins/calendar/events`;

            const method = selectedEvent ? 'PUT' : 'POST';

            await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(eventData),
            });

            fetchEvents();
            closeModal();
        } catch (error) {
            console.error('Failed to save event:', error);
        }
    };

    const handleDeleteEvent = async (eventId) => {
        if (!confirm('Delete this event?')) return;

        try {
            await fetch(`${API_BASE_URL}/plugins/calendar/events/${eventId}`, {
                method: 'DELETE',
            });
            fetchEvents();
        } catch (error) {
            console.error('Failed to delete event:', error);
        }
    };

    const openCreateModal = (date) => {
        setSelectedDate(date);
        setSelectedEvent(null);
        setFormData({
            title: '',
            description: '',
            start_time: format(date, "yyyy-MM-dd'T'09:00"),
            end_time: format(date, "yyyy-MM-dd'T'10:00"),
            location: '',
            color: '#3B82F6',
            all_day: false,
            reminder_minutes: 15,
        });
        setShowEventModal(true);
    };

    const openEditModal = (event) => {
        setSelectedEvent(event);
        setFormData({
            title: event.title,
            description: event.description || '',
            start_time: event.start_time.slice(0, 16),
            end_time: event.end_time.slice(0, 16),
            location: event.location || '',
            color: event.color,
            all_day: event.all_day,
            reminder_minutes: event.reminder_minutes,
        });
        setShowEventModal(true);
    };

    const closeModal = () => {
        setShowEventModal(false);
        setSelectedDate(null);
        setSelectedEvent(null);
    };

    const renderCalendar = () => {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);

        const rows = [];
        let days = [];
        let day = startDate;

        while (day <= endDate) {
            for (let i = 0; i < 7; i++) {
                const formattedDate = format(day, 'd');
                const cloneDay = day;
                const dayEvents = events.filter(event =>
                    isSameDay(new Date(event.start_time), day)
                );

                days.push(
                    <div
                        key={day}
                        className={`min-h-[100px] border border-glass-border p-2 cursor-pointer
                       transition-all hover:bg-glass/50
                       ${!isSameMonth(day, monthStart) ? 'bg-glass/20 text-text-muted' : ''}
                       ${isToday(day) ? 'bg-primary/10 border-primary' : ''}`}
                        onClick={() => openCreateModal(cloneDay)}
                    >
                        <span className={`text-sm font-semibold ${isToday(day) ? 'text-primary' : ''}`}>
                            {formattedDate}
                        </span>
                        <div className="mt-1 space-y-1">
                            {dayEvents.slice(0, 3).map(event => (
                                <div
                                    key={event.id}
                                    className="text-xs p-1 rounded truncate cursor-pointer hover:opacity-80"
                                    style={{ backgroundColor: event.color + '40', color: event.color }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        openEditModal(event);
                                    }}
                                >
                                    {event.title}
                                </div>
                            ))}
                            {dayEvents.length > 3 && (
                                <div className="text-xs text-text-muted">
                                    +{dayEvents.length - 3} more
                                </div>
                            )}
                        </div>
                    </div>
                );
                day = addDays(day, 1);
            }
            rows.push(
                <div key={day} className="grid grid-cols-7 gap-px">
                    {days}
                </div>
            );
            days = [];
        }
        return <div className="space-y-px">{rows}</div>;
    };

    return (
        <div className="p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-3xl font-bold">
                        📅 Calendar
                    </h1>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                            className="p-2 rounded-lg bg-glass hover:bg-glass/50 transition-colors"
                        >
                            ←
                        </button>
                        <h2 className="text-xl font-semibold min-w-[200px] text-center">
                            {format(currentDate, 'MMMM yyyy')}
                        </h2>
                        <button
                            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                            className="p-2 rounded-lg bg-glass hover:bg-glass/50 transition-colors"
                        >
                            →
                        </button>
                        <button
                            onClick={() => setCurrentDate(new Date())}
                            className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/80 transition-colors"
                        >
                            Today
                        </button>
                    </div>
                </div>

                {/* Weekday headers */}
                <div className="grid grid-cols-7 gap-px mb-px">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="p-2 text-center font-semibold text-text-muted bg-glass">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar grid */}
                {renderCalendar()}
            </div>

            {/* Event Modal */}
            {showEventModal && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
                    onClick={closeModal}
                >
                    <div
                        className="bg-bg-card backdrop-blur-xl border border-glass-border rounded-2xl p-6 max-w-lg w-full mx-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold">
                                {selectedEvent ? 'Edit Event' : 'New Event'}
                            </h2>
                            <button onClick={closeModal} className="text-text-muted hover:text-text-main">
                                ✕
                            </button>
                        </div>

                        <div className="space-y-4">
                            <input
                                type="text"
                                placeholder="Event title"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="w-full p-3 rounded-lg bg-glass border border-glass-border focus:border-primary outline-none"
                            />

                            <textarea
                                placeholder="Description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full p-3 rounded-lg bg-glass border border-glass-border focus:border-primary outline-none resize-none"
                                rows="3"
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-text-muted mb-2">Start</label>
                                    <input
                                        type="datetime-local"
                                        value={formData.start_time}
                                        onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                                        className="w-full p-2 rounded-lg bg-glass border border-glass-border focus:border-primary outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-text-muted mb-2">End</label>
                                    <input
                                        type="datetime-local"
                                        value={formData.end_time}
                                        onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                                        className="w-full p-2 rounded-lg bg-glass border border-glass-border focus:border-primary outline-none"
                                    />
                                </div>
                            </div>

                            <input
                                type="text"
                                placeholder="Location (optional)"
                                value={formData.location}
                                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                className="w-full p-3 rounded-lg bg-glass border border-glass-border focus:border-primary outline-none"
                            />

                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.all_day}
                                        onChange={(e) => setFormData({ ...formData, all_day: e.target.checked })}
                                        className="w-4 h-4 rounded accent-primary"
                                    />
                                    <span className="text-sm">All day</span>
                                </label>

                                <label className="flex items-center gap-2">
                                    <span className="text-sm text-text-muted">Color:</span>
                                    <input
                                        type="color"
                                        value={formData.color}
                                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                        className="w-10 h-10 rounded cursor-pointer"
                                    />
                                </label>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={handleCreateEvent}
                                    className="flex-1 bg-primary text-white p-3 rounded-lg font-semibold hover:bg-primary/80 transition-colors"
                                >
                                    {selectedEvent ? 'Update Event' : 'Create Event'}
                                </button>

                                {selectedEvent && (
                                    <button
                                        onClick={() => {
                                            handleDeleteEvent(selectedEvent.id);
                                            closeModal();
                                        }}
                                        className="px-6 py-3 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                                    >
                                        Delete
                                    </button>
                                )}

                                <button
                                    onClick={closeModal}
                                    className="px-6 py-3 rounded-lg bg-glass border border-glass-border text-text-muted hover:text-text-main transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Calendar;
