import React, { useState, useRef, useEffect } from 'react';

const ChatInput = ({ onSend, isLoading }) => {
    const [message, setMessage] = useState('');
    const textareaRef = useRef(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [message]);

    const handleSend = () => {
        if (message.trim() && !isLoading) {
            onSend(message);
            setMessage('');
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex gap-4 items-end">
            <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask AI anything... (Shift+Enter for new line)"
                disabled={isLoading}
                className="bg-bg-dark/50 border border-glass-border rounded-xl p-3 px-4 text-white w-full outline-none focus:border-primary transition-colors resize-none min-h-[48px] max-h-[200px] disabled:opacity-50"
                rows={1}
            />
            <button
                onClick={handleSend}
                disabled={isLoading || !message.trim()}
                className="bg-primary text-white p-3 px-8 rounded-xl font-semibold cursor-pointer transition-all duration-300 hover:bg-primary-hover hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 whitespace-nowrap h-[48px]"
            >
                {isLoading ? (
                    <span className="flex items-center gap-2">
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Thinking
                    </span>
                ) : (
                    'Send'
                )}
            </button>
        </div>
    );
};

export default ChatInput;
