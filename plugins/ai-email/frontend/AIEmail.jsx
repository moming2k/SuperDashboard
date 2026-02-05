import React, { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE } from '../../config';

const PLUGIN_API = `${API_BASE}/plugins/ai-email`;

// ==================== Priority Badge ====================
function PriorityBadge({ priority }) {
  const colors = {
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
    medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    low: 'bg-green-500/20 text-green-400 border-green-500/30',
  };
  if (!priority) return null;
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${colors[priority] || colors.medium}`}>
      {priority}
    </span>
  );
}

// ==================== Action Badge ====================
function ActionBadge({ action }) {
  const config = {
    reply: { label: 'Reply Needed', color: 'bg-blue-500/20 text-blue-400' },
    follow_up: { label: 'Follow Up', color: 'bg-purple-500/20 text-purple-400' },
    delegate: { label: 'Delegate', color: 'bg-orange-500/20 text-orange-400' },
    archive: { label: 'Archive', color: 'bg-gray-500/20 text-gray-400' },
    no_action: { label: 'No Action', color: 'bg-green-500/20 text-green-400' },
  };
  const c = config[action] || { label: action, color: 'bg-gray-500/20 text-gray-400' };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${c.color}`}>
      {c.label}
    </span>
  );
}

// ==================== Slash Command Presets ====================
const SLASH_COMMANDS = [
  { command: 'shorter', label: 'Make shorter', description: 'Condense the reply to be more concise', icon: '✂️' },
  { command: 'longer', label: 'Make longer', description: 'Expand with more detail and context', icon: '📝' },
  { command: 'formal', label: 'More formal', description: 'Adjust tone to be more professional and formal', icon: '👔' },
  { command: 'friendly', label: 'More friendly', description: 'Adjust tone to be warmer and more approachable', icon: '😊' },
  { command: 'fix', label: 'Fix grammar', description: 'Fix grammar, spelling, and punctuation', icon: '🔧' },
  { command: 'bullet', label: 'Add bullet points', description: 'Restructure key points as a bullet list', icon: '📋' },
  { command: 'urgent', label: 'Add urgency', description: 'Emphasize time-sensitivity and urgency', icon: '⚡' },
  { command: 'soften', label: 'Soften tone', description: 'Make the message less direct or assertive', icon: '🕊️' },
];

// ==================== Slash Command Popup ====================
function SlashCommandPopup({ query, commands, selectedIndex, onSelect, position }) {
  const listRef = useRef(null);

  const filtered = query
    ? commands.filter(c =>
        c.command.includes(query.toLowerCase()) ||
        c.label.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      const item = listRef.current.children[selectedIndex];
      if (item) {
        item.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (filtered.length === 0 && query) {
    return (
      <div
        className="absolute z-50 bg-bg-dark border border-glass-border rounded-xl shadow-2xl overflow-hidden w-80"
        style={{ bottom: position.bottom, left: position.left }}
      >
        <div className="p-3 border-b border-glass-border/50">
          <p className="text-[10px] text-text-muted uppercase tracking-wider font-bold">AI Refine</p>
        </div>
        <div className="p-3 text-center">
          <p className="text-xs text-text-muted mb-2">No matching command</p>
          <p className="text-[10px] text-text-muted">Press <kbd className="bg-glass px-1.5 py-0.5 rounded text-text-main">Enter</kbd> to send as custom instruction</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="absolute z-50 bg-bg-dark border border-glass-border rounded-xl shadow-2xl overflow-hidden w-80"
      style={{ bottom: position.bottom, left: position.left }}
    >
      <div className="p-3 border-b border-glass-border/50">
        <p className="text-[10px] text-text-muted uppercase tracking-wider font-bold">AI Refine — type or pick a command</p>
      </div>
      <div ref={listRef} className="max-h-[240px] overflow-y-auto">
        {filtered.map((cmd, i) => (
          <div
            key={cmd.command}
            onClick={() => onSelect(cmd)}
            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
              i === selectedIndex
                ? 'bg-primary/20 text-text-main'
                : 'hover:bg-glass/30 text-text-muted hover:text-text-main'
            }`}
          >
            <span className="text-base w-6 text-center flex-shrink-0">{cmd.icon}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">/{cmd.command}</p>
              <p className="text-[10px] text-text-muted truncate">{cmd.description}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="p-2 border-t border-glass-border/50 bg-glass/10">
        <p className="text-[10px] text-text-muted text-center">
          <kbd className="bg-glass px-1 py-0.5 rounded">↑↓</kbd> navigate
          <span className="mx-2">·</span>
          <kbd className="bg-glass px-1 py-0.5 rounded">Enter</kbd> select
          <span className="mx-2">·</span>
          <kbd className="bg-glass px-1 py-0.5 rounded">Esc</kbd> close
        </p>
      </div>
    </div>
  );
}

// ==================== Reply Editor ====================
function ReplyEditor({ emailId, replies, onReplyGenerated }) {
  const [tone, setTone] = useState('professional');
  const [additionalContext, setAdditionalContext] = useState('');
  const [generating, setGenerating] = useState(false);
  const [editingReply, setEditingReply] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  // Slash command state
  const [slashActive, setSlashActive] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);
  const [refining, setRefining] = useState(false);
  const textareaRef = useRef(null);

  const getFilteredCommands = () => {
    if (!slashQuery) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter(c =>
      c.command.includes(slashQuery.toLowerCase()) ||
      c.label.toLowerCase().includes(slashQuery.toLowerCase())
    );
  };

  const executeRefine = async (instruction, replyId) => {
    setRefining(true);
    setSlashActive(false);
    setSlashQuery('');
    setSlashSelectedIndex(0);
    try {
      const res = await fetch(`${PLUGIN_API}/emails/${emailId}/replies/${replyId}/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction,
          current_content: editContent,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setEditContent(data.draft_content);
        onReplyGenerated(data);
      }
    } catch (e) {
      console.error('Failed to refine reply', e);
    } finally {
      setRefining(false);
    }
  };

  const handleSlashSelect = (cmd) => {
    executeRefine(cmd.description, editingReply);
  };

  const handleEditKeyDown = (e) => {
    if (slashActive) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const filtered = getFilteredCommands();
        setSlashSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const filtered = getFilteredCommands();
        if (filtered.length > 0 && slashSelectedIndex < filtered.length) {
          handleSlashSelect(filtered[slashSelectedIndex]);
        } else if (slashQuery) {
          // Custom instruction
          executeRefine(slashQuery, editingReply);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setSlashActive(false);
        setSlashQuery('');
        setSlashSelectedIndex(0);
        // Remove the slash text from content
        const textarea = textareaRef.current;
        if (textarea) {
          const pos = textarea.selectionStart;
          const before = editContent.substring(0, pos);
          const slashStart = before.lastIndexOf('/');
          if (slashStart >= 0) {
            setEditContent(
              editContent.substring(0, slashStart) + editContent.substring(pos)
            );
          }
        }
      } else if (e.key === 'Backspace') {
        // If backspacing past the slash, close popup
        const textarea = textareaRef.current;
        if (textarea) {
          const pos = textarea.selectionStart;
          const before = editContent.substring(0, pos);
          const slashStart = before.lastIndexOf('/');
          if (pos - 1 <= slashStart) {
            setSlashActive(false);
            setSlashQuery('');
            setSlashSelectedIndex(0);
          }
        }
      }
    }
  };

  const handleEditChange = (e) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    setEditContent(value);

    // Detect slash command trigger
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastNewline = textBeforeCursor.lastIndexOf('\n');
    const lineStart = lastNewline + 1;
    const currentLine = textBeforeCursor.substring(lineStart);

    // Check if line starts with / or if / was just typed
    const slashMatch = currentLine.match(/\/(\S*)$/);

    if (slashMatch) {
      setSlashActive(true);
      setSlashQuery(slashMatch[1] || '');
      setSlashSelectedIndex(0);
    } else if (slashActive) {
      setSlashActive(false);
      setSlashQuery('');
      setSlashSelectedIndex(0);
    }
  };

  const generateReply = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${PLUGIN_API}/emails/${emailId}/suggest-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tone,
          additional_context: additionalContext || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onReplyGenerated(data);
      }
    } catch (e) {
      console.error('Failed to generate reply', e);
    } finally {
      setGenerating(false);
    }
  };

  const startEditing = (reply) => {
    setEditingReply(reply.id);
    setEditContent(reply.draft_content);
    setSlashActive(false);
    setSlashQuery('');
  };

  const saveEdit = async (replyId) => {
    setSaving(true);
    try {
      const res = await fetch(`${PLUGIN_API}/emails/${emailId}/replies/${replyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft_content: editContent }),
      });
      if (res.ok) {
        onReplyGenerated(await res.json());
        setEditingReply(null);
        setSlashActive(false);
      }
    } catch (e) {
      console.error('Failed to save reply', e);
    } finally {
      setSaving(false);
    }
  };

  const markFinal = async (replyId) => {
    try {
      const reply = replies.find(r => r.id === replyId);
      const res = await fetch(`${PLUGIN_API}/emails/${emailId}/replies/${replyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft_content: reply.draft_content,
          is_final: true,
        }),
      });
      if (res.ok) {
        onReplyGenerated(await res.json());
      }
    } catch (e) {
      console.error('Failed to mark final', e);
    }
  };

  return (
    <div className="space-y-4">
      <h4 className="text-text-muted uppercase tracking-widest text-[10px] font-bold">
        Reply Drafts (Read-Only - Not Sent)
      </h4>

      {/* Generate New Reply */}
      <div className="bg-glass/30 p-4 rounded-2xl border border-glass-border/50 space-y-3">
        <div className="flex gap-3 items-center">
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="bg-bg-dark/50 border border-glass-border rounded-lg px-3 py-2 text-sm text-text-main outline-none focus:border-primary"
          >
            <option value="professional">Professional</option>
            <option value="friendly">Friendly</option>
            <option value="brief">Brief</option>
            <option value="formal">Formal</option>
            <option value="casual">Casual</option>
          </select>
          <button
            onClick={generateReply}
            disabled={generating}
            className="bg-primary text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-300 hover:bg-primary/80 disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate Reply Draft'}
          </button>
        </div>
        <textarea
          value={additionalContext}
          onChange={(e) => setAdditionalContext(e.target.value)}
          placeholder="Additional context for the AI (optional)..."
          className="w-full bg-bg-dark/50 border border-glass-border rounded-lg p-3 text-sm text-text-main outline-none focus:border-primary resize-none h-16"
        />
      </div>

      {/* Reply Drafts List */}
      {replies.map((reply) => (
        <div
          key={reply.id}
          className={`p-4 rounded-2xl border ${
            reply.is_final
              ? 'bg-green-500/5 border-green-500/30'
              : 'bg-bg-card/40 border-glass-border/20'
          }`}
        >
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-primary">
                v{reply.version}
              </span>
              <span className="text-[10px] text-text-muted capitalize">
                {reply.tone} tone
              </span>
              {reply.is_final && (
                <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-bold">
                  APPROVED
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {editingReply !== reply.id && (
                <>
                  <button
                    onClick={() => startEditing(reply)}
                    className="text-xs bg-glass px-3 py-1 rounded-lg hover:bg-glass/50 transition-colors text-text-muted hover:text-text-main"
                  >
                    Edit
                  </button>
                  {!reply.is_final && (
                    <button
                      onClick={() => markFinal(reply.id)}
                      className="text-xs bg-green-500/20 text-green-400 px-3 py-1 rounded-lg hover:bg-green-500/30 transition-colors"
                    >
                      Approve
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {editingReply === reply.id ? (
            <div className="space-y-3">
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={editContent}
                  onChange={handleEditChange}
                  onKeyDown={handleEditKeyDown}
                  disabled={refining}
                  className={`w-full bg-bg-dark/50 border rounded-lg p-4 text-sm text-text-main outline-none resize-y min-h-[150px] transition-colors ${
                    refining
                      ? 'border-accent/50 opacity-70'
                      : slashActive
                        ? 'border-accent'
                        : 'border-glass-border focus:border-primary'
                  }`}
                />
                {refining && (
                  <div className="absolute inset-0 flex items-center justify-center bg-bg-dark/40 rounded-lg">
                    <div className="flex items-center gap-2 bg-bg-dark/90 px-4 py-2 rounded-lg border border-accent/30">
                      <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-accent font-semibold">Refining with AI...</span>
                    </div>
                  </div>
                )}
                {slashActive && !refining && (
                  <SlashCommandPopup
                    query={slashQuery}
                    commands={SLASH_COMMANDS}
                    selectedIndex={slashSelectedIndex}
                    onSelect={handleSlashSelect}
                    position={{ bottom: '100%', left: '0px' }}
                  />
                )}
              </div>
              {!refining && (
                <div className="flex items-center gap-2 justify-between">
                  <p className="text-[10px] text-text-muted">
                    Type <kbd className="bg-glass px-1.5 py-0.5 rounded text-accent font-bold">/</kbd> for AI refinement commands
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditingReply(null); setSlashActive(false); }}
                      className="text-xs bg-glass px-3 py-1.5 rounded-lg hover:bg-glass/50 transition-colors text-text-muted"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => saveEdit(reply.id)}
                      disabled={saving}
                      className="text-xs bg-primary text-white px-4 py-1.5 rounded-lg font-semibold hover:bg-primary/80 transition-colors disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <pre className="text-sm text-text-main/90 whitespace-pre-wrap font-sans leading-relaxed">
              {reply.draft_content}
            </pre>
          )}
        </div>
      ))}

      {replies.length === 0 && (
        <p className="text-xs text-text-muted italic text-center py-4">
          No reply drafts yet. Generate one above.
        </p>
      )}

      <p className="text-[10px] text-text-muted italic text-center">
        All drafts are for reference only. This plugin never sends emails.
      </p>
    </div>
  );
}

// ==================== Attachment Viewer ====================
function AttachmentViewer({ attachments }) {
  const [expanded, setExpanded] = useState(null);

  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-text-muted uppercase tracking-widest text-[10px] font-bold">
        Attachments ({attachments.length})
      </h4>
      {attachments.map((att) => (
        <div
          key={att.id}
          className="bg-bg-card/40 border border-glass-border/20 rounded-2xl overflow-hidden"
        >
          <div
            className="flex justify-between items-center p-4 cursor-pointer hover:bg-glass/20 transition-colors"
            onClick={() => setExpanded(expanded === att.id ? null : att.id)}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">
                {att.content_type?.startsWith('image/') ? '🖼' :
                 att.content_type === 'application/pdf' ? '📄' :
                 att.content_type?.includes('spreadsheet') || att.filename?.endsWith('.csv') ? '📊' :
                 '📎'}
              </span>
              <div>
                <p className="text-sm font-semibold text-text-main">{att.filename}</p>
                <p className="text-[10px] text-text-muted">
                  {att.content_type} {att.size ? `- ${(att.size / 1024).toFixed(1)} KB` : ''}
                </p>
              </div>
            </div>
            <span className="text-text-muted text-sm transition-transform duration-200"
                  style={{ transform: expanded === att.id ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              ▼
            </span>
          </div>
          {expanded === att.id && att.markdown_content && (
            <div className="p-4 border-t border-glass-border/20 bg-bg-dark/30">
              <pre className="text-sm text-text-main/90 whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto max-h-[400px] overflow-y-auto">
                {att.markdown_content}
              </pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ==================== Email Detail Modal ====================
function EmailDetailModal({ emailId, onClose, onRefresh }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState('content');

  useEffect(() => {
    fetchDetail();
  }, [emailId]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${PLUGIN_API}/emails/${emailId}`);
      if (res.ok) {
        setDetail(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch email detail', e);
    } finally {
      setLoading(false);
    }
  };

  const analyzeEmail = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch(`${PLUGIN_API}/emails/${emailId}/analyze`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchDetail();
        onRefresh();
      }
    } catch (e) {
      console.error('Failed to analyze email', e);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleReplyGenerated = async () => {
    await fetchDetail();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50">
        <div className="text-text-muted animate-pulse">Loading email...</div>
      </div>
    );
  }

  if (!detail) return null;

  const detailTabs = [
    { id: 'content', label: 'Content' },
    { id: 'analysis', label: 'AI Analysis' },
    { id: 'reply', label: 'Reply Draft' },
  ];
  if (detail.attachments?.length > 0) {
    detailTabs.push({ id: 'attachments', label: `Attachments (${detail.attachments.length})` });
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-bg-dark border border-glass-border w-full max-w-5xl max-h-[90vh] rounded-[32px] shadow-2xl overflow-hidden flex flex-col animate-fade">
        {/* Header */}
        <div className="p-6 border-b border-glass-border bg-bg-card/50 flex-shrink-0">
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0 mr-4">
              <div className="flex items-center gap-2 mb-1">
                {detail.priority && <PriorityBadge priority={detail.priority} />}
                {detail.suggested_action && <ActionBadge action={detail.suggested_action} />}
                {detail.has_attachments && <span className="text-sm" title="Has attachments">📎</span>}
              </div>
              <h2 className="text-xl font-bold truncate">{detail.subject || '(No Subject)'}</h2>
              <p className="text-sm text-text-muted mt-1">
                From: <span className="text-text-main">{detail.sender}</span>
              </p>
              {detail.recipients?.length > 0 && (
                <p className="text-xs text-text-muted mt-0.5">
                  To: {detail.recipients.join(', ')}
                </p>
              )}
              {detail.cc?.length > 0 && (
                <p className="text-xs text-text-muted mt-0.5">
                  CC: {detail.cc.join(', ')}
                </p>
              )}
              <p className="text-xs text-text-muted mt-0.5">
                {detail.date ? new Date(detail.date).toLocaleString() : 'Unknown date'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={analyzeEmail}
                disabled={analyzing}
                className="bg-accent/20 text-accent px-4 py-2 rounded-lg text-sm font-semibold hover:bg-accent/30 transition-colors disabled:opacity-50 border border-accent/30"
              >
                {analyzing ? 'Analyzing...' : detail.summary ? 'Re-analyze' : 'AI Analyze'}
              </button>
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-glass hover:bg-glass/20 transition-all text-text-muted hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* Detail Tabs */}
        <div className="flex border-b border-glass-border bg-bg-card/30 flex-shrink-0">
          {detailTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveDetailTab(tab.id)}
              className={`px-5 py-3 text-sm font-semibold transition-colors relative ${
                activeDetailTab === tab.id
                  ? 'text-primary'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              {tab.label}
              {activeDetailTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          ))}
        </div>

        {/* Detail Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeDetailTab === 'content' && (
            <div className="space-y-4">
              {detail.summary && (
                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
                  <h4 className="text-text-muted uppercase tracking-widest text-[10px] font-bold mb-2">AI Summary</h4>
                  <p className="text-sm text-text-main leading-relaxed">{detail.summary}</p>
                </div>
              )}
              <div className="bg-glass/20 rounded-2xl p-6 border border-glass-border/30">
                <pre className="text-sm text-text-main/90 whitespace-pre-wrap font-sans leading-relaxed">
                  {detail.body_text || '(No text content)'}
                </pre>
              </div>
            </div>
          )}

          {activeDetailTab === 'analysis' && (
            <div className="space-y-4">
              {detail.summary ? (
                <>
                  <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5">
                    <h4 className="text-text-muted uppercase tracking-widest text-[10px] font-bold mb-2">Summary</h4>
                    <p className="text-sm text-text-main leading-relaxed">{detail.summary}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-glass/20 rounded-2xl p-4 border border-glass-border/30 text-center">
                      <h4 className="text-text-muted uppercase tracking-widest text-[10px] font-bold mb-2">Priority</h4>
                      <PriorityBadge priority={detail.priority} />
                    </div>
                    <div className="bg-glass/20 rounded-2xl p-4 border border-glass-border/30 text-center">
                      <h4 className="text-text-muted uppercase tracking-widest text-[10px] font-bold mb-2">Suggested Action</h4>
                      <ActionBadge action={detail.suggested_action} />
                    </div>
                    <div className="bg-glass/20 rounded-2xl p-4 border border-glass-border/30 text-center">
                      <h4 className="text-text-muted uppercase tracking-widest text-[10px] font-bold mb-2">Needs Reply</h4>
                      <span className={`text-lg font-bold ${detail.needs_reply ? 'text-red-400' : 'text-green-400'}`}>
                        {detail.needs_reply ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                  {detail.action_details && (
                    <div className="bg-glass/20 rounded-2xl p-5 border border-glass-border/30">
                      <h4 className="text-text-muted uppercase tracking-widest text-[10px] font-bold mb-2">Action Details</h4>
                      <p className="text-sm text-text-main leading-relaxed">{detail.action_details}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-4xl mb-4">🤖</p>
                  <p className="text-text-muted mb-4">No AI analysis yet</p>
                  <button
                    onClick={analyzeEmail}
                    disabled={analyzing}
                    className="bg-accent text-white px-6 py-3 rounded-xl font-semibold transition-all hover:bg-accent/80 disabled:opacity-50"
                  >
                    {analyzing ? 'Analyzing...' : 'Analyze with AI'}
                  </button>
                </div>
              )}
            </div>
          )}

          {activeDetailTab === 'reply' && (
            <ReplyEditor
              emailId={emailId}
              replies={detail.suggested_replies || []}
              onReplyGenerated={handleReplyGenerated}
            />
          )}

          {activeDetailTab === 'attachments' && (
            <AttachmentViewer attachments={detail.attachments || []} />
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== Main Component ====================
export default function AIEmail() {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [selectedEmailId, setSelectedEmailId] = useState(null);
  const [status, setStatus] = useState(null);
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [filter, setFilter] = useState('all'); // all, needs_reply, high_priority, unread

  useEffect(() => {
    fetchEmails();
    fetchStatus();
  }, []);

  const fetchEmails = async () => {
    try {
      const res = await fetch(`${PLUGIN_API}/emails?limit=100`);
      if (res.ok) {
        const data = await res.json();
        setEmails(data.emails || []);
      }
    } catch (e) {
      console.error('Failed to fetch emails', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${PLUGIN_API}/status`);
      if (res.ok) {
        setStatus(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch status', e);
    }
  };

  const fetchFromIMAP = async () => {
    setFetching(true);
    try {
      const res = await fetch(`${PLUGIN_API}/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: 'INBOX', limit: 50 }),
      });
      if (res.ok) {
        const data = await res.json();
        await fetchEmails();
        await fetchStatus();
        return data;
      }
    } catch (e) {
      console.error('Failed to fetch from IMAP', e);
    } finally {
      setFetching(false);
    }
  };

  const analyzeAllEmails = async () => {
    setAnalyzingAll(true);
    try {
      await fetch(`${PLUGIN_API}/emails/analyze-all`, { method: 'POST' });
      await fetchEmails();
      await fetchStatus();
    } catch (e) {
      console.error('Failed to analyze all', e);
    } finally {
      setAnalyzingAll(false);
    }
  };

  const filteredEmails = emails.filter((e) => {
    if (filter === 'needs_reply') return e.needs_reply;
    if (filter === 'high_priority') return e.priority === 'high';
    if (filter === 'unread') return !e.is_read;
    return true;
  });

  if (loading) {
    return (
      <div className="animate-fade p-8">
        <h1 className="text-3xl font-bold mb-4">AI Email Assistant</h1>
        <p className="text-text-muted animate-pulse">Loading emails...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold">AI Email Assistant</h1>
          <p className="text-text-muted text-sm mt-1">Read-only email analysis with AI-powered insights</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={analyzeAllEmails}
            disabled={analyzingAll || emails.length === 0}
            className="bg-accent/20 text-accent px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-accent/30 transition-all border border-accent/30 disabled:opacity-50"
          >
            {analyzingAll ? 'Analyzing...' : 'AI Analyze All'}
          </button>
          <button
            onClick={fetchFromIMAP}
            disabled={fetching}
            className="bg-primary text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all hover:bg-primary/80 disabled:opacity-50"
          >
            {fetching ? 'Fetching...' : 'Fetch Emails'}
          </button>
        </div>
      </div>

      {/* Status Bar */}
      {status && (
        <div className="flex gap-4 mb-6 flex-wrap">
          <div className="bg-glass/30 border border-glass-border/50 rounded-xl px-4 py-2 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${status.imap_configured ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-xs text-text-muted">IMAP {status.imap_configured ? 'Connected' : 'Not Configured'}</span>
          </div>
          <div className="bg-glass/30 border border-glass-border/50 rounded-xl px-4 py-2 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${status.ai_configured ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-xs text-text-muted">AI {status.ai_configured ? 'Ready' : 'Not Configured'}</span>
          </div>
          <div className="bg-glass/30 border border-glass-border/50 rounded-xl px-4 py-2">
            <span className="text-xs text-text-muted">{status.total_emails} emails</span>
          </div>
          <div className="bg-glass/30 border border-glass-border/50 rounded-xl px-4 py-2">
            <span className="text-xs text-text-muted">{status.analyzed_emails} analyzed</span>
          </div>
          <div className="bg-glass/30 border border-glass-border/50 rounded-xl px-4 py-2">
            <span className="text-xs text-text-muted">{status.unread_emails} unread</span>
          </div>
          {status.needs_reply > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2">
              <span className="text-xs text-red-400 font-semibold">{status.needs_reply} need reply</span>
            </div>
          )}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { id: 'all', label: 'All' },
          { id: 'unread', label: 'Unread' },
          { id: 'needs_reply', label: 'Needs Reply' },
          { id: 'high_priority', label: 'High Priority' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              filter === f.id
                ? 'bg-primary text-white'
                : 'bg-glass/30 text-text-muted hover:text-text-main hover:bg-glass/50 border border-glass-border/50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Email List */}
      {filteredEmails.length === 0 ? (
        <div className="text-center py-20 bg-glass/10 rounded-3xl border border-dashed border-glass-border">
          <p className="text-4xl mb-4">📧</p>
          <p className="text-text-muted">
            {emails.length === 0
              ? 'No emails fetched yet. Click "Fetch Emails" to get started.'
              : 'No emails match the selected filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEmails.map((e) => (
            <div
              key={e.id}
              onClick={() => setSelectedEmailId(e.id)}
              className={`bg-bg-card backdrop-blur-xl border rounded-2xl p-5 transition-all duration-300 hover:scale-[1.01] hover:border-primary cursor-pointer shadow-lg group ${
                e.is_read ? 'border-glass-border' : 'border-primary/30 bg-primary/5'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Unread Indicator */}
                <div className="pt-1.5">
                  {!e.is_read && (
                    <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                  )}
                  {e.is_read && <div className="w-2.5 h-2.5" />}
                </div>

                {/* Email Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-sm ${e.is_read ? 'text-text-muted' : 'font-bold text-text-main'}`}>
                      {e.sender}
                    </span>
                    <span className="text-xs text-text-muted">
                      {e.date ? new Date(e.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <h3 className={`text-base truncate ${e.is_read ? 'text-text-main' : 'font-bold text-text-main'}`}>
                    {e.subject || '(No Subject)'}
                    {e.has_attachments && <span className="ml-2 text-sm" title="Has attachments">📎</span>}
                  </h3>
                  {e.summary && (
                    <p className="text-xs text-text-muted mt-1 line-clamp-1">{e.summary}</p>
                  )}
                </div>

                {/* Badges */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {e.priority && <PriorityBadge priority={e.priority} />}
                  {e.suggested_action && <ActionBadge action={e.suggested_action} />}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Email Detail Modal */}
      {selectedEmailId && (
        <EmailDetailModal
          emailId={selectedEmailId}
          onClose={() => setSelectedEmailId(null)}
          onRefresh={fetchEmails}
        />
      )}
    </div>
  );
}
