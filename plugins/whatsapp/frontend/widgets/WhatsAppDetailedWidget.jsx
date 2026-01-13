import React, { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const WhatsAppDetailedWidget = () => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingTo, setSendingTo] = useState('');

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/plugins/whatsapp/messages`);
        const data = await response.json();
        setMessages(data.slice(0, 10));
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      }
    };

    fetchMessages();
  }, []);

  const sendMessage = async () => {
    if (!newMessage.trim() || !sendingTo.trim()) return;

    try {
      await fetch(`${API_BASE_URL}/plugins/whatsapp/messages/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: sendingTo,
          message: newMessage
        })
      });
      setNewMessage('');
      setSendingTo('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      <h3 className="text-lg font-bold mb-3 text-text-main flex items-center gap-2">
        <span>💬</span>
        <span>WhatsApp AI Agent</span>
      </h3>

      <div className="flex-1 overflow-y-auto space-y-2 mb-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted text-sm">
            <div className="text-4xl mb-2">💬</div>
            <p>No messages yet</p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="bg-glass rounded-lg p-3">
              <div className="flex items-start justify-between mb-1">
                <span className="font-semibold text-sm text-text-main">{message.from_number}</span>
                <span className="text-xs text-text-muted">
                  {new Date(message.timestamp).toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-text-muted">{message.body}</p>
            </div>
          ))
        )}
      </div>

      <div className="bg-glass rounded-lg p-3">
        <input
          type="text"
          value={sendingTo}
          onChange={(e) => setSendingTo(e.target.value)}
          placeholder="To: whatsapp:+1234567890"
          className="w-full bg-bg-card border border-glass-border rounded-lg px-3 py-2 text-sm text-text-main mb-2 focus:outline-none focus:border-primary"
        />
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="w-full bg-bg-card border border-glass-border rounded-lg px-3 py-2 text-sm text-text-main mb-2 focus:outline-none focus:border-primary"
        />
        <button
          onClick={sendMessage}
          disabled={!newMessage.trim() || !sendingTo.trim()}
          className="w-full bg-green-500 text-white py-2 rounded-lg font-semibold text-sm hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          Send Message
        </button>
      </div>

      <button
        onClick={() => window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab: 'whatsapp' } }))}
        className="mt-3 w-full bg-primary text-white py-2 rounded-lg font-semibold text-sm hover:bg-primary/80 transition-all"
      >
        Open WhatsApp Chat
      </button>
    </div>
  );
};

export default WhatsAppDetailedWidget;
