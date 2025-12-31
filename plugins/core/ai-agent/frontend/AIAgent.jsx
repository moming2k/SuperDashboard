import React, { useState, useEffect, useRef } from 'react';
import ChatMessage from '../../components/ChatMessage';
import ChatInput from '../../components/ChatInput';
import TypingIndicator from '../../components/TypingIndicator';
import ModelSelector from '../../components/ModelSelector';

const API_BASE = 'http://localhost:8000';

function AIAgent() {
  const [conversation, setConversation] = useState([]);
  const [selectedModel, setSelectedModel] = useState(localStorage.getItem('selected_model') || 'gpt-4');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  useEffect(() => {
    loadConversation();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [conversation]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversation = () => {
    try {
      const saved = localStorage.getItem('ai_conversation');
      if (saved) {
        setConversation(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load conversation', e);
    }
  };

  const saveConversation = (messages) => {
    try {
      localStorage.setItem('ai_conversation', JSON.stringify(messages));
    } catch (e) {
      console.error('Failed to save conversation', e);
    }
  };

  const clearConversation = () => {
    setConversation([]);
    localStorage.removeItem('ai_conversation');
  };

  const sendMessage = async (content) => {
    const userMessage = {
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    };

    const updatedConversation = [...conversation, userMessage];
    setConversation(updatedConversation);
    saveConversation(updatedConversation);
    setIsLoading(true);

    try {
      // Prepare messages for API (only role and content)
      const messages = updatedConversation.map(({ role, content }) => ({ role, content }));

      const res = await fetch(`${API_BASE}/agents/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, model: selectedModel })
      });

      const data = await res.json();

      const assistantMessage = {
        role: 'assistant',
        content: data.response || data.error || 'No response from AI',
        timestamp: new Date().toISOString()
      };

      const finalConversation = [...updatedConversation, assistantMessage];
      setConversation(finalConversation);
      saveConversation(finalConversation);
    } catch (e) {
      const errorMessage = {
        role: 'assistant',
        content: 'Error communicating with AI agent. Please try again.',
        timestamp: new Date().toISOString()
      };
      const finalConversation = [...updatedConversation, errorMessage];
      setConversation(finalConversation);
      saveConversation(finalConversation);
    }

    setIsLoading(false);
  };

  const handleModelChange = (model) => {
    setSelectedModel(model);
    localStorage.setItem('selected_model', model);
  };

  return (
    <div className="animate-fade flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">AI Virtual Assistant</h1>
        <div className="flex items-center gap-4">
          <ModelSelector
            selectedModel={selectedModel}
            onModelChange={handleModelChange}
          />
          {conversation.length > 0 && (
            <button
              onClick={clearConversation}
              className="bg-glass border border-glass-border text-text-muted hover:text-text-main px-4 py-2 rounded-xl text-sm transition-colors"
            >
              Clear Chat
            </button>
          )}
        </div>
      </div>

      <div className="bg-bg-card backdrop-blur-xl border border-glass-border rounded-[24px] p-8 shadow-2xl flex flex-col flex-1 gap-6 min-h-0">
        {/* Messages Container */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto flex flex-col gap-6 pr-2 min-h-0"
        >
          {conversation.length === 0 && !isLoading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="text-6xl mb-4">🤖</div>
                <h3 className="text-xl font-semibold mb-2">AI Virtual Assistant</h3>
                <p className="text-text-muted">
                  Ask me anything or use "Smart Analyze" from the dashboard to get insights on your tasks.
                </p>
              </div>
            </div>
          )}

          {conversation.map((message, index) => (
            <ChatMessage
              key={index}
              message={message}
              isUser={message.role === 'user'}
            />
          ))}

          {isLoading && <TypingIndicator />}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Container */}
        <ChatInput onSend={sendMessage} isLoading={isLoading} />
      </div>
    </div>
  );
}

export default AIAgent;
