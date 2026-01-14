import React, { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const NotificationCompactWidget = () => {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/plugins/notification-center/notifications`);
        const data = await response.json();
        const unread = data.filter(n => !n.read).length;
        setUnreadCount(unread);
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full flex flex-col items-center justify-center p-4">
      <div className="relative">
        <div className="text-5xl">🔔</div>
        {unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </div>
      <div className="text-4xl font-bold text-primary mt-2">{unreadCount}</div>
      <div className="text-sm text-text-muted">
        {unreadCount === 1 ? 'Unread' : 'Unread'}
      </div>
    </div>
  );
};

export default NotificationCompactWidget;
