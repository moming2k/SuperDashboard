import React, { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const WhatsAppCompactWidget = () => {
  const [messageCount, setMessageCount] = useState(0);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/plugins/whatsapp/messages`);
        const data = await response.json();
        setMessageCount(data.length);
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      }
    };

    fetchMessages();
  }, []);

  return (
    <div className="h-full flex flex-col items-center justify-center p-4">
      <div className="text-5xl mb-2">💬</div>
      <div className="text-4xl font-bold text-green-400 mb-2">{messageCount}</div>
      <div className="text-sm text-text-muted">
        {messageCount === 1 ? 'Message' : 'Messages'}
      </div>
    </div>
  );
};

export default WhatsAppCompactWidget;
