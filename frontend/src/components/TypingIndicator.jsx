import React from 'react';

const TypingIndicator = () => {
    return (
        <div className="flex gap-4 animate-fade">
            {/* Avatar */}
            <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg bg-gradient-to-br from-accent to-primary text-white">
                🤖
            </div>

            {/* Typing Animation */}
            <div className="bg-glass border border-glass-border p-4 px-6 rounded-2xl rounded-tl-sm">
                <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
            </div>
        </div>
    );
};

export default TypingIndicator;
