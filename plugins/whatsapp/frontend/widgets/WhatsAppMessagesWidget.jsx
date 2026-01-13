import React, { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const WhatsAppMessagesWidget = () => {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/plugins/whatsapp/messages`);
        const data = await response.json();
        setMessages(data.slice(0, 5));
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      }
    };

    fetchMessages();
  }, []);

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      <h3 className="text-lg font-bold mb-3 text-text-main flex items-center gap-2">
        <span>💬</span>
        <span>WhatsApp</span>
      </h3>
      <div className="flex-1 overflow-y-auto space-y-2">
        {messages.length === 0 ? (
          <div className="text-text-muted text-sm text-center py-4">
            No messages yet
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="bg-glass rounded-lg p-3">
              <div className="flex items-start justify-between mb-1">
                <span className="font-semibold text-sm text-text-main">{message.from_number}</span>
                <span className="text-xs text-text-muted">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-xs text-text-muted line-clamp-2">{message.body}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default WhatsAppMessagesWidget;
