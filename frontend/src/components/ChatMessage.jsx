import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

const ChatMessage = ({ message, isUser }) => {
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
    };

    return (
        <div className={`flex gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-fade`}>
            {/* Avatar */}
            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg ${isUser
                    ? 'bg-primary text-white'
                    : 'bg-gradient-to-br from-accent to-primary text-white'
                }`}>
                {isUser ? '👤' : '🤖'}
            </div>

            {/* Message Content */}
            <div className={`flex flex-col gap-2 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
                <div className={`relative group ${isUser
                        ? 'bg-primary text-white'
                        : 'bg-glass border border-glass-border text-text-main'
                    } p-4 px-6 rounded-2xl ${isUser ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}>
                    {isUser ? (
                        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                    ) : (
                        <div className="markdown-prose">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                rehypePlugins={[rehypeHighlight]}
                                components={{
                                    code: ({ node, inline, className, children, ...props }) => {
                                        const match = /language-(\w+)/.exec(className || '');
                                        return !inline ? (
                                            <div className="relative group/code">
                                                <button
                                                    onClick={() => copyToClipboard(String(children).replace(/\n$/, ''))}
                                                    className="absolute right-2 top-2 opacity-0 group-hover/code:opacity-100 transition-opacity bg-glass border border-glass-border text-text-muted hover:text-text-main px-3 py-1 rounded-lg text-xs"
                                                >
                                                    Copy
                                                </button>
                                                <code className={className} {...props}>
                                                    {children}
                                                </code>
                                            </div>
                                        ) : (
                                            <code className="codespan" {...props}>
                                                {children}
                                            </code>
                                        );
                                    },
                                }}
                            >
                                {message.content}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>

                {/* Timestamp */}
                <span className="text-xs text-text-muted px-2">
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>
        </div>
    );
};

export default ChatMessage;
