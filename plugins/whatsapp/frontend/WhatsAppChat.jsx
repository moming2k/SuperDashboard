import React, { useState, useEffect, useRef } from 'react';

// Detect if running in devcontainer and use appropriate backend port
const isDevContainer = import.meta.env.VITE_DEVCONTAINER === 'true';
const backendPort = isDevContainer ? 18010 : 8000;
const API_BASE = `http://localhost:${backendPort}`;

export default function WhatsAppChat() {
    const [conversations, setConversations] = useState([]);
    const [messages, setMessages] = useState([]);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [newMessage, setNewMessage] = useState('');
    const [newRecipient, setNewRecipient] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [showNewChat, setShowNewChat] = useState(false);
    const [healthStatus, setHealthStatus] = useState(null);
    const [showConfig, setShowConfig] = useState(false);
    const [configInstructions, setConfigInstructions] = useState(null);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        checkHealth();
        fetchConversations();
        fetchConfigInstructions();

        // Poll for new messages every 3 seconds
        const interval = setInterval(() => {
            fetchConversations();
            if (selectedConversation) {
                fetchMessages(selectedConversation.phone_number);
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [selectedConversation]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const checkHealth = async () => {
        try {
            const res = await fetch(`${API_BASE}/plugins/whatsapp/health`);
            const data = await res.json();
            setHealthStatus(data);
        } catch (e) {
            console.error("Failed to check WhatsApp health", e);
        }
    };

    const fetchConfigInstructions = async () => {
        try {
            const res = await fetch(`${API_BASE}/plugins/whatsapp/config-instructions`);
            const data = await res.json();
            setConfigInstructions(data);
        } catch (e) {
            console.error("Failed to fetch config instructions", e);
        }
    };

    const fetchConversations = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/plugins/whatsapp/conversations`);
            const data = await res.json();
            setConversations(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error("Failed to fetch conversations", e);
            setConversations([]);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchMessages = async (phoneNumber) => {
        try {
            const res = await fetch(`${API_BASE}/plugins/whatsapp/messages?phone_number=${phoneNumber}`);
            const data = await res.json();
            setMessages(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error("Failed to fetch messages", e);
            setMessages([]);
        }
    };

    const sendMessage = async () => {
        const recipient = selectedConversation ? selectedConversation.phone_number : newRecipient;

        if (!newMessage.trim() || !recipient) {
            return;
        }

        setIsSending(true);
        try {
            const res = await fetch(`${API_BASE}/plugins/whatsapp/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: recipient,
                    body: newMessage
                })
            });

            if (!res.ok) {
                const error = await res.json();
                alert(`Failed to send message: ${error.detail}`);
                return;
            }

            setNewMessage('');
            setNewRecipient('');
            setShowNewChat(false);

            // Refresh conversations and messages
            await fetchConversations();
            if (selectedConversation) {
                await fetchMessages(selectedConversation.phone_number);
            } else if (recipient) {
                // Select the new conversation
                setTimeout(async () => {
                    await fetchConversations();
                    const conv = conversations.find(c => c.phone_number === recipient);
                    if (conv) {
                        setSelectedConversation(conv);
                        await fetchMessages(recipient);
                    }
                }, 1000);
            }
        } catch (e) {
            console.error("Failed to send message", e);
            alert('Failed to send message. Please try again.');
        } finally {
            setIsSending(false);
        }
    };

    const selectConversation = (conv) => {
        setSelectedConversation(conv);
        setShowNewChat(false);
        fetchMessages(conv.phone_number);
    };

    const formatPhoneNumber = (phone) => {
        if (phone.length > 10) {
            return `+${phone}`;
        }
        return phone;
    };

    const formatTimestamp = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffInHours = (now - date) / (1000 * 60 * 60);

        if (diffInHours < 24) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    };

    return (
        <div className="animate-fade h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <h1 className="text-3xl font-bold">WhatsApp AI Agent</h1>
                    {healthStatus?.ai_enabled && (
                        <span className="bg-purple-500/20 text-purple-400 px-3 py-1 rounded-lg text-xs font-bold">
                            🤖 AI Powered
                        </span>
                    )}
                </div>
                <div className="flex gap-4 items-center">
                    {healthStatus && (
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold ${
                            healthStatus.configured
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-amber-500/20 text-amber-400'
                        }`}>
                            <div className={`w-2 h-2 rounded-full ${
                                healthStatus.configured ? 'bg-green-400 animate-pulse' : 'bg-amber-400'
                            }`}></div>
                            {healthStatus.configured ? 'Connected' : 'Not Configured'}
                        </div>
                    )}
                    <button
                        onClick={() => setShowConfig(!showConfig)}
                        className="bg-glass border border-glass-border px-4 py-2 rounded-lg hover:bg-glass/20 transition-colors text-sm"
                    >
                        ⚙️ Setup
                    </button>
                    <button
                        onClick={() => setShowNewChat(true)}
                        className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-hover transition-colors font-semibold"
                    >
                        + New Chat
                    </button>
                    <button
                        onClick={fetchConversations}
                        disabled={isLoading}
                        className="bg-glass border border-glass-border px-4 py-2 rounded-lg hover:bg-glass/20 transition-colors disabled:opacity-50"
                    >
                        {isLoading ? '🔄' : '↻'} Refresh
                    </button>
                </div>
            </div>

            {showConfig && configInstructions && (
                <div className="mb-6 p-6 bg-glass border border-glass-border rounded-2xl">
                    <h3 className="font-bold text-lg mb-4">🛠️ Configuration Instructions</h3>

                    <div className="mb-4 p-4 bg-bg-dark/50 rounded-xl">
                        <h4 className="font-bold mb-2 text-sm">Current Status:</h4>
                        <ul className="text-sm space-y-1 text-text-muted">
                            <li>✓ Twilio: {configInstructions.current_config.twilio_configured ? '✅ Configured' : '❌ Not Configured'}</li>
                            <li>✓ WhatsApp Number: {configInstructions.current_config.whatsapp_number}</li>
                            <li>✓ AI Agent: {configInstructions.current_config.ai_enabled ? '✅ Enabled' : '❌ Disabled'}</li>
                        </ul>
                    </div>

                    <div className="space-y-2 text-sm">
                        {configInstructions.instructions.map((instruction, idx) => (
                            <div key={idx} className="text-text-muted">
                                {instruction}
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                        <p className="text-sm text-purple-400">
                            💡 <strong>Tip:</strong> When AI is enabled, incoming WhatsApp messages will automatically get responses from your AI agent!
                        </p>
                    </div>
                </div>
            )}

            {!healthStatus?.configured && (
                <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
                    <h3 className="font-bold mb-2">⚠️ Configuration Required</h3>
                    <p className="text-sm">
                        Please configure Twilio credentials in your backend/.env file. Click the "Setup" button above for instructions.
                    </p>
                </div>
            )}

            <div className="flex-1 bg-bg-card backdrop-blur-xl border border-glass-border rounded-3xl shadow-2xl overflow-hidden flex min-h-0">
                {/* Conversations List */}
                <div className="w-80 border-r border-glass-border flex flex-col">
                    <div className="p-6 border-b border-glass-border">
                        <h2 className="text-lg font-bold">Conversations</h2>
                        <p className="text-xs text-text-muted mt-1">{conversations.length} active chats</p>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {conversations.length === 0 && !isLoading && (
                            <div className="p-6 text-center text-text-muted">
                                <div className="text-4xl mb-2">💬</div>
                                <p className="text-sm">No conversations yet</p>
                                <p className="text-xs mt-1">Start a new chat to begin</p>
                            </div>
                        )}
                        {conversations.map((conv) => (
                            <div
                                key={conv.phone_number}
                                onClick={() => selectConversation(conv)}
                                className={`p-4 border-b border-glass-border/30 cursor-pointer transition-all hover:bg-glass/20 ${
                                    selectedConversation?.phone_number === conv.phone_number
                                        ? 'bg-glass/30 border-l-4 border-l-primary'
                                        : ''
                                }`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-bold text-sm">{formatPhoneNumber(conv.phone_number)}</span>
                                    <span className="text-[10px] text-text-muted">{formatTimestamp(conv.last_message_time)}</span>
                                </div>
                                <p className="text-xs text-text-muted truncate">{conv.last_message}</p>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="text-[10px] text-text-muted">{conv.message_count} messages</span>
                                    {conv.unread_count > 0 && (
                                        <span className="bg-primary text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                                            {conv.unread_count}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 flex flex-col min-w-0">
                    {showNewChat ? (
                        <div className="flex flex-col h-full">
                            <div className="p-6 border-b border-glass-border">
                                <h2 className="text-lg font-bold">New Conversation</h2>
                            </div>
                            <div className="flex-1 flex flex-col justify-center items-center p-8">
                                <div className="text-6xl mb-4">💬</div>
                                <h3 className="text-xl font-bold mb-2">Start a new conversation</h3>
                                <p className="text-text-muted mb-6">Enter a phone number to send a WhatsApp message</p>
                                <input
                                    type="text"
                                    placeholder="Phone number (e.g., 1234567890)"
                                    value={newRecipient}
                                    onChange={(e) => setNewRecipient(e.target.value.replace(/[^0-9]/g, ''))}
                                    className="bg-bg-dark/50 border border-glass-border rounded-xl p-3 text-white w-full max-w-md outline-none focus:border-primary transition-colors mb-4"
                                />
                                <button
                                    onClick={() => setShowNewChat(false)}
                                    className="text-text-muted hover:text-text-main transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                            <div className="p-6 border-t border-glass-border">
                                <div className="flex gap-3">
                                    <input
                                        type="text"
                                        placeholder="Type your message..."
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && !isSending && newRecipient && sendMessage()}
                                        disabled={!newRecipient || isSending}
                                        className="flex-1 bg-bg-dark/50 border border-glass-border rounded-xl p-3 text-white outline-none focus:border-primary transition-colors disabled:opacity-50"
                                    />
                                    <button
                                        onClick={sendMessage}
                                        disabled={!newMessage.trim() || !newRecipient || isSending}
                                        className="bg-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSending ? 'Sending...' : 'Send'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : selectedConversation ? (
                        <>
                            {/* Chat Header */}
                            <div className="p-6 border-b border-glass-border">
                                <h2 className="text-lg font-bold">{formatPhoneNumber(selectedConversation.phone_number)}</h2>
                                <p className="text-xs text-text-muted">{selectedConversation.message_count} messages</p>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                {messages.length === 0 && (
                                    <div className="flex items-center justify-center h-full">
                                        <p className="text-text-muted">No messages yet</p>
                                    </div>
                                )}
                                {messages.map((msg, index) => {
                                    const isOutgoing = msg.direction === 'outbound';
                                    return (
                                        <div
                                            key={msg.id || index}
                                            className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div
                                                className={`max-w-[70%] rounded-2xl p-4 ${
                                                    isOutgoing
                                                        ? 'bg-primary text-white rounded-br-sm'
                                                        : 'bg-glass border border-glass-border text-text-main rounded-bl-sm'
                                                }`}
                                            >
                                                <p className="text-sm break-words whitespace-pre-wrap">{msg.body}</p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span className={`text-[10px] ${isOutgoing ? 'text-white/70' : 'text-text-muted'}`}>
                                                        {formatTimestamp(msg.timestamp)}
                                                    </span>
                                                    {isOutgoing && (
                                                        <span className="text-[10px] text-white/70">
                                                            {msg.status === 'sent' && '✓'}
                                                            {msg.status === 'delivered' && '✓✓'}
                                                            {msg.status === 'read' && '✓✓'}
                                                            {msg.status === 'failed' && '✗'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Message Input */}
                            <div className="p-6 border-t border-glass-border">
                                <div className="flex gap-3">
                                    <input
                                        type="text"
                                        placeholder="Type your message..."
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && !isSending && sendMessage()}
                                        disabled={isSending}
                                        className="flex-1 bg-bg-dark/50 border border-glass-border rounded-xl p-3 text-white outline-none focus:border-primary transition-colors disabled:opacity-50"
                                    />
                                    <button
                                        onClick={sendMessage}
                                        disabled={!newMessage.trim() || isSending}
                                        className="bg-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSending ? 'Sending...' : 'Send'}
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center">
                            <div className="text-6xl mb-4">💬</div>
                            <h3 className="text-xl font-bold mb-2">WhatsApp AI Agent</h3>
                            <p className="text-text-muted mb-4">Select a conversation or start a new chat</p>
                            {healthStatus?.ai_enabled && (
                                <p className="text-sm text-purple-400">🤖 AI agent is active and ready to respond</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
