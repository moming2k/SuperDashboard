import React, { useState, useEffect, useRef } from 'react';

const API_BASE = 'http://localhost:8000';

function InterviewAssistant() {
  // Session state
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [view, setView] = useState('upload'); // upload, session, chat

  // Upload form state
  const [cvText, setCvText] = useState('');
  const [candidateName, setCandidateName] = useState('');
  const [jobRole, setJobRole] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  // Chat state
  const [chatMessage, setChatMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  // Question filter
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [expandedQuestions, setExpandedQuestions] = useState({});

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeSession?.chat_history]);

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API_BASE}/plugins/interview-assistant/sessions`);
      const data = await res.json();
      setSessions(data);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  };

  const loadSession = async (sessionId) => {
    try {
      const res = await fetch(`${API_BASE}/plugins/interview-assistant/sessions/${sessionId}`);
      const data = await res.json();
      setActiveSession(data);
      setView('session');
      setError(null);
    } catch (err) {
      setError('Failed to load session');
    }
  };

  const deleteSession = async (sessionId) => {
    try {
      await fetch(`${API_BASE}/plugins/interview-assistant/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      if (activeSession?.id === sessionId) {
        setActiveSession(null);
        setView('upload');
      }
      fetchSessions();
    } catch (err) {
      setError('Failed to delete session');
    }
  };

  const handleUploadCV = async () => {
    if (!cvText.trim()) {
      setError('Please paste the CV/resume text');
      return;
    }
    setUploading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/plugins/interview-assistant/upload-cv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cv_text: cvText,
          candidate_name: candidateName || undefined,
          job_role: jobRole || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Upload failed');
      }

      const session = await res.json();
      setActiveSession(session);
      setView('session');
      setCvText('');
      setCandidateName('');
      setJobRole('');
      fetchSessions();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSendChat = async () => {
    if (!chatMessage.trim() || !activeSession) return;

    const msg = chatMessage;
    setChatMessage('');
    setChatLoading(true);

    // Optimistic update
    setActiveSession(prev => ({
      ...prev,
      chat_history: [
        ...prev.chat_history,
        { role: 'user', content: msg, timestamp: new Date().toISOString() },
      ],
    }));

    try {
      const res = await fetch(`${API_BASE}/plugins/interview-assistant/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: activeSession.id,
          message: msg,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Chat failed');
      }

      const data = await res.json();
      setActiveSession(prev => ({
        ...prev,
        chat_history: data.chat_history,
      }));
    } catch (err) {
      setError(err.message);
      // Remove optimistic message on error
      setActiveSession(prev => ({
        ...prev,
        chat_history: prev.chat_history.slice(0, -1),
      }));
    } finally {
      setChatLoading(false);
    }
  };

  const toggleQuestion = (index) => {
    setExpandedQuestions(prev => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const categories = activeSession?.questions
    ? ['All', ...new Set(activeSession.questions.map(q => q.category))]
    : ['All'];

  const filteredQuestions = activeSession?.questions?.filter(
    q => categoryFilter === 'All' || q.category === categoryFilter
  ) || [];

  const difficultyColor = (d) => {
    if (d === 'Easy') return 'text-green-400 bg-green-400/10 border-green-400/30';
    if (d === 'Medium') return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
    return 'text-red-400 bg-red-400/10 border-red-400/30';
  };

  const categoryIcon = (c) => {
    if (c.includes('Technical')) return '💻';
    if (c.includes('Experience')) return '📋';
    if (c.includes('Behavioral')) return '🧠';
    if (c.includes('Problem')) return '🧩';
    if (c.includes('Culture')) return '🤝';
    return '❓';
  };

  // ── Sidebar ──
  const renderSidebar = () => (
    <div className="w-72 border-r border-white/10 flex flex-col h-full">
      <div className="p-4 border-b border-white/10">
        <button
          onClick={() => { setView('upload'); setActiveSession(null); setError(null); }}
          className="w-full bg-indigo-500 hover:bg-indigo-600 text-white py-2.5 px-4 rounded-xl font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/25"
        >
          + New Interview
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {sessions.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-8">No interviews yet</p>
        )}
        {sessions.map(s => (
          <div
            key={s.id}
            onClick={() => loadSession(s.id)}
            className={`p-3 rounded-xl cursor-pointer transition-all duration-200 border group ${
              activeSession?.id === s.id
                ? 'bg-indigo-500/15 border-indigo-500/30 text-white'
                : 'bg-white/5 border-transparent hover:bg-white/10 text-slate-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{s.candidate_name}</p>
                <p className="text-xs text-slate-400 truncate">{s.job_role}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all ml-2 text-xs"
                title="Delete session"
              >
                ✕
              </button>
            </div>
            <div className="flex gap-3 mt-1.5 text-xs text-slate-500">
              <span>{s.question_count} Q</span>
              <span>{s.chat_count} msgs</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Upload View ──
  const renderUploadView = () => (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Interview Assistant</h2>
          <p className="text-slate-400">
            Paste a candidate's CV below to generate tailored interview questions with suggested answers.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl mb-6 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Candidate Name</label>
              <input
                type="text"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                placeholder="e.g. John Smith"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/25 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Target Role</label>
              <input
                type="text"
                value={jobRole}
                onChange={(e) => setJobRole(e.target.value)}
                placeholder="e.g. Senior Backend Engineer"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/25 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">CV / Resume Text</label>
            <textarea
              value={cvText}
              onChange={(e) => setCvText(e.target.value)}
              placeholder="Paste the candidate's CV or resume text here..."
              rows={16}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/25 transition-all resize-y font-mono text-sm leading-relaxed"
            />
          </div>

          <button
            onClick={handleUploadCV}
            disabled={uploading || !cvText.trim()}
            className={`w-full py-3 px-6 rounded-xl font-semibold text-white transition-all duration-300 ${
              uploading || !cvText.trim()
                ? 'bg-slate-600 cursor-not-allowed opacity-50'
                : 'bg-indigo-500 hover:bg-indigo-600 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/25 cursor-pointer'
            }`}
          >
            {uploading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Analyzing CV & Generating Questions...
              </span>
            ) : (
              'Generate Interview Questions'
            )}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Session View (Questions + Chat) ──
  const renderSessionView = () => {
    if (!activeSession) return null;

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-white/10 p-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">{activeSession.candidate_name}</h2>
            <p className="text-sm text-slate-400">{activeSession.job_role} &middot; {activeSession.questions.length} questions</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setView('session')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                view === 'session'
                  ? 'bg-indigo-500 text-white'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              Questions
            </button>
            <button
              onClick={() => setView('chat')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                view === 'chat'
                  ? 'bg-indigo-500 text-white'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              Chat Assistant
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 mx-4 mt-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {view === 'session' ? renderQuestions() : renderChat()}
      </div>
    );
  };

  // ── Questions Panel ──
  const renderQuestions = () => (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Category filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              categoryFilter === cat
                ? 'bg-indigo-500 text-white'
                : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/10'
            }`}
          >
            {cat !== 'All' && <span className="mr-1">{categoryIcon(cat)}</span>}
            {cat}
          </button>
        ))}
      </div>

      {/* Questions list */}
      <div className="space-y-3">
        {filteredQuestions.map((q, i) => {
          const globalIndex = activeSession.questions.indexOf(q);
          const isExpanded = expandedQuestions[globalIndex];
          return (
            <div
              key={globalIndex}
              className="bg-white/5 border border-white/10 rounded-xl overflow-hidden transition-all hover:border-white/20"
            >
              <div
                onClick={() => toggleQuestion(globalIndex)}
                className="p-4 cursor-pointer flex items-start gap-3"
              >
                <span className="text-lg mt-0.5 shrink-0">{categoryIcon(q.category)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs text-slate-500 font-medium">{q.category}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${difficultyColor(q.difficulty)}`}>
                      {q.difficulty}
                    </span>
                  </div>
                  <p className="text-white font-medium text-sm leading-relaxed">{q.question}</p>
                </div>
                <span className={`text-slate-500 transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
                  ▾
                </span>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 pt-0 ml-9">
                  <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3">
                    <p className="text-xs font-medium text-indigo-400 mb-1.5">Suggested Answer</p>
                    <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{q.suggested_answer}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Chat Panel ──
  const renderChat = () => (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {activeSession.chat_history.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">💬</p>
            <p className="text-slate-400 text-sm">
              Ask me anything about this candidate. I can help with follow-up questions,
              evaluating responses, or identifying strengths and gaps.
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {[
                'What are the key strengths in this CV?',
                'Any red flags I should probe?',
                'Suggest a system design question for this candidate',
                'How does their experience match the role?',
              ].map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => { setChatMessage(suggestion); }}
                  className="text-xs bg-white/5 border border-white/10 text-slate-400 px-3 py-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-all"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeSession.chat_history.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] rounded-xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-indigo-500/20 border border-indigo-500/30 text-white'
                : 'bg-white/5 border border-white/10 text-slate-300'
            }`}>
              {msg.role === 'assistant' && (
                <p className="text-xs font-medium text-indigo-400 mb-1">Interview Assistant</p>
              )}
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {chatLoading && (
          <div className="flex justify-start">
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Chat input */}
      <div className="border-t border-white/10 p-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
            placeholder="Ask about the candidate, request follow-up questions..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/25 transition-all text-sm"
            disabled={chatLoading}
          />
          <button
            onClick={handleSendChat}
            disabled={chatLoading || !chatMessage.trim()}
            className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 ${
              chatLoading || !chatMessage.trim()
                ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                : 'bg-indigo-500 text-white hover:bg-indigo-600 cursor-pointer hover:-translate-y-0.5'
            }`}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );

  // ── Main Layout ──
  return (
    <div className="flex h-full bg-transparent text-white">
      {renderSidebar()}
      {activeSession && (view === 'session' || view === 'chat')
        ? renderSessionView()
        : renderUploadView()
      }
    </div>
  );
}

export default InterviewAssistant;
