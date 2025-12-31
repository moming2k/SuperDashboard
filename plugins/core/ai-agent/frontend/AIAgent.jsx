import React, { useState, useEffect, useRef } from 'react';
import ChatMessage from '../../components/ChatMessage';
import ChatInput from '../../components/ChatInput';
import TypingIndicator from '../../components/TypingIndicator';
import ModelSelector from '../../components/ModelSelector';
import MCPSettings from '../../components/MCPSettings';

const API_BASE = 'http://localhost:8000';

function AIAgent() {
  const [conversation, setConversation] = useState([]);
  const [selectedModel, setSelectedModel] = useState(localStorage.getItem('selected_model') || 'gpt-4');
  const [isLoading, setIsLoading] = useState(false);
  const [mcpEnabled, setMcpEnabled] = useState(localStorage.getItem('mcp_enabled') === 'true');
  const [showMCPSettings, setShowMCPSettings] = useState(false);
  const [mcpStatus, setMcpStatus] = useState(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

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

  const loadMCPStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/mcp/status`);
      const data = await res.json();
      setMcpStatus(data);
    } catch (e) {
      console.error('Failed to load MCP status', e);
    }
  };

  const handleMCPToggle = async () => {
    const newValue = !mcpEnabled;
    setMcpEnabled(newValue);
    localStorage.setItem('mcp_enabled', newValue.toString());

    try {
      await fetch(`${API_BASE}/mcp/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newValue })
      });
      await loadMCPStatus();
    } catch (e) {
      console.error('Failed to toggle MCP', e);
    }
  };

  useEffect(() => {
    loadConversation();
    loadMCPStatus();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [conversation]);

  return (
    <div className="animate-fade flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">AI Virtual Assistant</h1>
        <div className="flex items-center gap-4">
          {/* MCP Toggle */}
          <div className="flex items-center gap-2 bg-glass border border-glass-border px-4 py-2 rounded-xl">
            <span className="text-sm text-text-muted">MCP</span>
            <button
              onClick={handleMCPToggle}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                mcpEnabled ? 'bg-primary' : 'bg-glass-border'
              }`}
            >
              <div
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  mcpEnabled ? 'translate-x-6' : ''
                }`}
              />
            </button>
            {mcpEnabled && mcpStatus?.servers?.length > 0 && (
              <span className="text-xs text-green-400">
                {mcpStatus.servers.length} server{mcpStatus.servers.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* MCP Settings Button */}
          <button
            onClick={() => setShowMCPSettings(true)}
            className="bg-glass border border-glass-border text-text-muted hover:text-text-main hover:border-primary px-4 py-2 rounded-xl text-sm transition-colors flex items-center gap-2"
            title="Configure MCP Servers"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            MCP Setup
          </button>

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

      {/* MCP Settings Modal */}
      <MCPSettings
        isOpen={showMCPSettings}
        onClose={() => {
          setShowMCPSettings(false);
          loadMCPStatus(); // Reload status after settings are closed
        }}
      />
    </div>
  );
}

export default AIAgent;
