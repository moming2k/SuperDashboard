import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import TypingIndicator from './components/TypingIndicator';
import ModelSelector from './components/ModelSelector';
import 'highlight.js/styles/github-dark.css';

const API_BASE = 'http://localhost:8000';

const componentCache = {};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400">
          <h2 className="text-xl font-bold mb-2">Plugin Error</h2>
          <p>This plugin failed to load or crashed. Please check the console for details.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const PluginComponent = ({ plugin, props }) => {
  if (!plugin || !plugin.manifest?.frontendComponent) return null;

  if (!componentCache[plugin.name]) {
    componentCache[plugin.name] = lazy(() => import(`./plugins/${plugin.name}/${plugin.manifest.frontendComponent}`));
  }

  const Component = componentCache[plugin.name];

  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="p-8 text-text-muted animate-pulse">Loading plugin: {plugin.name}...</div>}>
        <Component {...props} />
      </Suspense>
    </ErrorBoundary>
  );
};

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tasks, setTasks] = useState([]);
  const [plugins, setPlugins] = useState([]);
  const [conversation, setConversation] = useState([]);
  const [selectedModel, setSelectedModel] = useState(localStorage.getItem('selected_model') || 'gpt-4');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  useEffect(() => {
    fetchTasks();
    fetchPlugins();
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

  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_BASE}/tasks`);
      const data = await res.json();
      setTasks(data);
    } catch (e) {
      console.error("Failed to fetch tasks", e);
    }
  };

  const fetchPlugins = async () => {
    try {
      const res = await fetch(`${API_BASE}/plugins`);
      const data = await res.json();
      setPlugins(data);
    } catch (e) {
      console.error("Failed to fetch plugins", e);
    }
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

  const analyzeTasks = async () => {
    setActiveTab('agent');
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/agents/analyze-tasks`, { method: 'POST' });
      const data = await res.json();

      const assistantMessage = {
        role: 'assistant',
        content: data.response || data.error || 'No analysis available',
        timestamp: new Date().toISOString()
      };

      const updatedConversation = [...conversation, assistantMessage];
      setConversation(updatedConversation);
      saveConversation(updatedConversation);
    } catch (e) {
      console.error("Error analyzing tasks", e);
    }

    setIsLoading(false);
  };

  const addTask = async () => {
    const title = document.getElementById('newTaskTitle').value;
    const desc = document.getElementById('newTaskDesc').value;
    if (!title) return;
    await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description: desc })
    });
    fetchTasks();
    document.getElementById('newTaskTitle').value = '';
    document.getElementById('newTaskDesc').value = '';
  };

  const getPluginForView = (viewName) => {
    return plugins.find(p => p.manifest?.replaces === viewName);
  };

  const tasksPlugin = getPluginForView('tasks');
  const whatsappPlugin = plugins.find(p => p.name === 'whatsapp');

  return (
    <div className="flex h-screen bg-bg-dark font-outfit text-text-main">
      {/* Sidebar */}
      <div className="w-[260px] bg-glass backdrop-blur-xl border-r border-glass-border p-8 flex flex-col gap-8">
        <div className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-8">
          SuperDashboard
        </div>
        <nav className="flex flex-col gap-2">
          {[
            { id: 'dashboard', label: '📊 Dashboard' },
            { id: 'tasks', label: tasksPlugin ? `🏷️ ${tasksPlugin.manifest.displayName || 'Tasks'}` : '✅ Tasks' },
            { id: 'agent', label: '🤖 AI Agent' },
            { id: 'whatsapp', label: '💬 WhatsApp AI', condition: whatsappPlugin },
            { id: 'plugins', label: '🧩 Plugins' },
          ].filter(tab => tab.condition !== false).map((tab) => (
            <div
              key={tab.id}
              className={`flex items-center gap-3 p-3 px-4 rounded-xl cursor-pointer transition-all duration-300 hover:bg-glass hover:text-text-main hover:translate-x-1 ${activeTab === tab.id ? 'bg-glass text-text-main translate-x-1' : 'text-text-muted'
                }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </div>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        {activeTab === 'dashboard' && (
          <div className="animate-fade">
            <h1 className="text-3xl font-bold mb-8">Welcome back, Engineer</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-bg-card backdrop-blur-xl border border-glass-border rounded-[24px] p-8 shadow-2xl">
                <h3 className="text-xl font-semibold mb-4">Quick Stats</h3>
                <p className="text-text-muted mb-2">
                  Tasks: <span className="text-text-main font-bold">{tasks.length}</span>
                </p>
                <p className="text-text-muted">Active Plugins: <span className="text-text-main font-bold">{plugins.length}</span></p>
              </div>
              <div className="bg-bg-card backdrop-blur-xl border border-glass-border rounded-[24px] p-8 shadow-2xl">
                <h3 className="text-xl font-semibold mb-4">AI Assistant</h3>
                <p className="text-text-muted mb-6">Ready to help you offload work.</p>
                <div className="flex gap-4">
                  <button
                    className="bg-primary text-white p-3 px-6 rounded-xl font-semibold cursor-pointer transition-all duration-300 hover:bg-primary-hover hover:-translate-y-0.5 hover:shadow-[0_5px_15px_rgba(99,102,241,0.4)]"
                    onClick={() => setActiveTab('agent')}
                  >
                    Ask GPT-4
                  </button>
                  <button
                    className="bg-primary text-white p-3 px-6 rounded-xl font-semibold cursor-pointer transition-all duration-300 hover:bg-primary-hover hover:-translate-y-0.5 hover:shadow-[0_5px_15px_rgba(99,102,241,0.4)]"
                    onClick={analyzeTasks}
                  >
                    Smart Analyze
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          tasksPlugin ? (
            <PluginComponent plugin={tasksPlugin} />
          ) : (
            <div className="animate-fade">
              <h1 className="text-3xl font-bold mb-8">Task Tracker</h1>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {tasks.length === 0 && <p className="text-text-muted col-span-full">No tasks yet. Create one!</p>}
                {tasks.map((task) => (
                  <div key={task.id} className="bg-glass border border-glass-border rounded-2xl p-6 transition-transform duration-300 hover:scale-[1.02] hover:border-primary">
                    <h4 className="text-lg font-bold mb-2">{task.title}</h4>
                    <p className="text-text-muted mb-4 line-clamp-2">{task.description}</p>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${task.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                      {task.status}
                    </span>
                  </div>
                ))}
              </div>

              <div className="bg-bg-card backdrop-blur-xl border border-glass-border rounded-[24px] p-8 shadow-2xl">
                <h3 className="text-xl font-semibold mb-6">Add New Task</h3>
                <div className="flex flex-col gap-4">
                  <input
                    type="text"
                    placeholder="Task Title"
                    id="newTaskTitle"
                    className="bg-bg-dark/50 border border-glass-border rounded-xl p-3 text-white w-full outline-none focus:border-primary transition-colors"
                  />
                  <textarea
                    placeholder="Description"
                    id="newTaskDesc"
                    className="bg-bg-dark/50 border border-glass-border rounded-xl p-3 text-white w-full h-32 outline-none focus:border-primary transition-colors resize-none"
                  />
                  <button
                    className="bg-primary text-white p-3 px-6 rounded-xl font-semibold cursor-pointer transition-all duration-300 hover:bg-primary-hover hover:-translate-y-0.5 hover:shadow-[0_5px_15px_rgba(99,102,241,0.4)] self-start"
                    onClick={addTask}
                  >
                    Add Task
                  </button>
                </div>
              </div>
            </div>
          )
        )}

        {activeTab === 'agent' && (
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
        )}

        {activeTab === 'whatsapp' && whatsappPlugin && (
          <PluginComponent plugin={whatsappPlugin} />
        )}

        {activeTab === 'plugins' && (
          <div className="animate-fade">
            <h1 className="text-3xl font-bold mb-8">Plugin Registry</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {plugins.length === 0 && <p className="text-text-muted">No plugins detected in /plugins directory.</p>}
              {plugins.map(plugin => (
                <div key={plugin.name} className="bg-bg-card backdrop-blur-xl border border-glass-border rounded-[24px] p-8 shadow-2xl transition-all hover:border-primary">
                  <h3 className="text-xl font-bold mb-2">{plugin.name}</h3>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400"></div>
                    <p className="text-text-muted text-sm uppercase tracking-wider">{plugin.status}</p>
                  </div>
                  <button className="mt-6 w-full bg-glass border border-glass-border p-2 rounded-lg text-sm hover:bg-glass/20 transition-colors">
                    Configure
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
