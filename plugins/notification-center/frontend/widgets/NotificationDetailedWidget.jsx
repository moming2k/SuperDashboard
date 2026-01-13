import React, { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const NotificationDetailedWidget = () => {
  const [notifications, setNotifications] = useState([]);
  const [selectedNotification, setSelectedNotification] = useState(null);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/plugins/notification-center/notifications`);
        const data = await response.json();
        setNotifications(data.slice(0, 10));
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, []);

  const markAsRead = async (id) => {
    try {
      await fetch(`${API_BASE_URL}/plugins/notification-center/notifications/${id}/read`, {
        method: 'PUT'
      });
      setNotifications(notifications.map(n =>
        n.id === id ? { ...n, read: true } : n
      ));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-red-400 bg-red-500/20';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20';
      case 'low': return 'text-blue-400 bg-blue-500/20';
      default: return 'text-text-muted bg-glass';
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
          <span>🔔</span>
          <span>Notifications</span>
        </h3>
        {unreadCount > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            {unreadCount}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {notifications.length === 0 ? (
          <div className="text-text-muted text-sm text-center py-4">
            No notifications yet
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => {
                setSelectedNotification(notification);
                if (!notification.read) markAsRead(notification.id);
              }}
              className={`bg-glass rounded-lg p-3 cursor-pointer hover:bg-glass/80 transition-all ${
                !notification.read ? 'border border-primary/50' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-1">
                <span className="font-semibold text-sm text-text-main flex-1">{notification.title}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${getPriorityColor(notification.priority)}`}>
                  {notification.priority}
                </span>
              </div>
              <p className="text-xs text-text-muted line-clamp-2">{notification.description}</p>
              <div className="mt-2 text-xs text-text-muted">
                {new Date(notification.createdAt).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationDetailedWidget;
