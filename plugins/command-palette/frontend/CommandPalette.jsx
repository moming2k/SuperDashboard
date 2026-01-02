import React, { useState, useEffect, useRef } from 'react';

// Detect if running in devcontainer
const isDevContainer = import.meta.env.VITE_DEVCONTAINER === 'true';
const backendPort = isDevContainer ? 18010 : 8000;
const API_BASE = `http://localhost:${backendPort}`;

function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [commands, setCommands] = useState([]);
  const [filteredCommands, setFilteredCommands] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [output, setOutput] = useState(null);
  const [inputMode, setInputMode] = useState(null); // 'commit', 'branch', 'jira', 'docs'
  const [inputValue, setInputValue] = useState('');
  const [jiraForm, setJiraForm] = useState({
    project: '',
    summary: '',
    description: '',
    issue_type: 'Task'
  });

  const searchInputRef = useRef(null);
  const inputDialogRef = useRef(null);

  // Fetch available commands
  useEffect(() => {
    const fetchCommands = async () => {
      try {
        const res = await fetch(`${API_BASE}/plugins/command-palette/commands`);
        const data = await res.json();
        setCommands(data.commands || []);
        setFilteredCommands(data.commands || []);
      } catch (e) {
        console.error('Failed to fetch commands', e);
      }
    };

    fetchCommands();
  }, []);

  // Keyboard shortcut listener (Cmd+Shift+P or Ctrl+Shift+P)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd+Shift+P (Mac) or Ctrl+Shift+P (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setIsOpen(true);
        setOutput(null);
        setInputMode(null);
        setSearchQuery('');
        setSelectedIndex(0);
      }

      // ESC to close
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setOutput(null);
        setInputMode(null);
        setSearchQuery('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Focus input dialog when opened
  useEffect(() => {
    if (inputMode && inputDialogRef.current) {
      setTimeout(() => inputDialogRef.current?.focus(), 100);
    }
  }, [inputMode]);

  // Filter commands based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredCommands(commands);
      setSelectedIndex(0);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = commands.filter(cmd =>
      cmd.label.toLowerCase().includes(query) ||
      cmd.description.toLowerCase().includes(query) ||
      cmd.category.toLowerCase().includes(query)
    );

    setFilteredCommands(filtered);
    setSelectedIndex(0);
  }, [searchQuery, commands]);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (inputMode) return; // Don't handle navigation when in input mode

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filteredCommands.length > 0) {
      e.preventDefault();
      executeCommand(filteredCommands[selectedIndex]);
    }
  };

  // Execute a command
  const executeCommand = async (command) => {
    // Commands that need user input
    if (command.id === 'git.commit') {
      setInputMode('commit');
      setInputValue('');
      return;
    } else if (command.id === 'git.checkout') {
      setInputMode('branch');
      setInputValue('');
      return;
    } else if (command.id === 'jira.create') {
      setInputMode('jira');
      setJiraForm({ project: '', summary: '', description: '', issue_type: 'Task' });
      return;
    } else if (command.id === 'docs.search') {
      setInputMode('docs');
      setInputValue('');
      return;
    }

    setIsLoading(true);
    setOutput(null);

    try {
      let response;
      let endpoint;

      // Map command IDs to API endpoints
      switch (command.id) {
        case 'git.status':
          endpoint = '/plugins/command-palette/git/status';
          break;
        case 'git.log':
          endpoint = '/plugins/command-palette/git/log';
          break;
        case 'git.branches':
          endpoint = '/plugins/command-palette/git/branches';
          break;
        case 'git.pull':
          endpoint = '/plugins/command-palette/git/pull';
          break;
        case 'git.push':
          endpoint = '/plugins/command-palette/git/push';
          break;
        case 'build.frontend':
          endpoint = '/plugins/command-palette/build/frontend';
          break;
        case 'build.install-frontend':
          endpoint = '/plugins/command-palette/build/install-frontend';
          break;
        case 'build.install-backend':
          endpoint = '/plugins/command-palette/build/install-backend';
          break;
        case 'test.frontend':
          endpoint = '/plugins/command-palette/test/frontend';
          break;
        case 'test.backend':
          endpoint = '/plugins/command-palette/test/backend';
          break;
        case 'lint.frontend':
          endpoint = '/plugins/command-palette/lint/frontend';
          break;
        default:
          setOutput({ success: false, output: '', error: 'Unknown command' });
          setIsLoading(false);
          return;
      }

      // Execute GET or POST based on endpoint
      const method = endpoint.includes('/git/status') || endpoint.includes('/git/log') || endpoint.includes('/git/branches') ? 'GET' : 'POST';

      response = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers: method === 'POST' ? { 'Content-Type': 'application/json' } : {}
      });

      const data = await response.json();
      setOutput(data);
    } catch (e) {
      setOutput({ success: false, output: '', error: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Execute command with user input
  const executeWithInput = async () => {
    if (inputMode === 'commit') {
      if (!inputValue.trim()) return;

      setIsLoading(true);
      setInputMode(null);

      try {
        const response = await fetch(
          `${API_BASE}/plugins/command-palette/git/commit?message=${encodeURIComponent(inputValue)}`,
          { method: 'POST' }
        );
        const data = await response.json();
        setOutput(data);
      } catch (e) {
        setOutput({ success: false, output: '', error: e.message });
      } finally {
        setIsLoading(false);
      }
    } else if (inputMode === 'branch') {
      if (!inputValue.trim()) return;

      setIsLoading(true);
      setInputMode(null);

      try {
        const response = await fetch(
          `${API_BASE}/plugins/command-palette/git/checkout?branch=${encodeURIComponent(inputValue)}&create=false`,
          { method: 'POST' }
        );
        const data = await response.json();
        setOutput(data);
      } catch (e) {
        setOutput({ success: false, output: '', error: e.message });
      } finally {
        setIsLoading(false);
      }
    } else if (inputMode === 'jira') {
      if (!jiraForm.project.trim() || !jiraForm.summary.trim()) return;

      setIsLoading(true);
      setInputMode(null);

      try {
        const response = await fetch(
          `${API_BASE}/plugins/command-palette/jira/create-ticket`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(jiraForm)
          }
        );
        const data = await response.json();
        setOutput(data);
      } catch (e) {
        setOutput({ success: false, output: '', error: e.message });
      } finally {
        setIsLoading(false);
      }
    } else if (inputMode === 'docs') {
      if (!inputValue.trim()) return;

      setIsLoading(true);
      setInputMode(null);

      try {
        const response = await fetch(
          `${API_BASE}/plugins/command-palette/docs/search?query=${encodeURIComponent(inputValue)}`
        );
        const data = await response.json();
        setOutput(data);
      } catch (e) {
        setOutput({ success: false, output: '', error: e.message });
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 pt-20" onClick={() => setIsOpen(false)}>
      <div className="bg-bg-card backdrop-blur-xl border border-glass-border rounded-[24px] shadow-2xl max-w-3xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-glass-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Command Palette</h2>
            <button onClick={() => setIsOpen(false)} className="text-text-muted hover:text-text-main transition-colors">
              ✕
            </button>
          </div>

          {/* Search Input */}
          {!inputMode && (
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type to search commands... (↑↓ to navigate, Enter to execute)"
              className="w-full bg-glass border border-glass-border rounded-xl p-3 text-text-main focus:outline-none focus:border-primary transition-colors"
            />
          )}

          {/* Input Dialog for commands that need parameters */}
          {inputMode === 'commit' && (
            <div className="space-y-3">
              <input
                ref={inputDialogRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && executeWithInput()}
                placeholder="Enter commit message..."
                className="w-full bg-glass border border-glass-border rounded-xl p-3 text-text-main focus:outline-none focus:border-primary transition-colors"
              />
              <div className="flex gap-2">
                <button
                  onClick={executeWithInput}
                  className="flex-1 bg-primary text-white p-2 px-4 rounded-xl font-semibold hover:bg-primary/80 transition-all"
                >
                  Commit
                </button>
                <button
                  onClick={() => setInputMode(null)}
                  className="p-2 px-4 rounded-xl bg-glass border border-glass-border hover:border-primary transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {inputMode === 'branch' && (
            <div className="space-y-3">
              <input
                ref={inputDialogRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && executeWithInput()}
                placeholder="Enter branch name..."
                className="w-full bg-glass border border-glass-border rounded-xl p-3 text-text-main focus:outline-none focus:border-primary transition-colors"
              />
              <div className="flex gap-2">
                <button
                  onClick={executeWithInput}
                  className="flex-1 bg-primary text-white p-2 px-4 rounded-xl font-semibold hover:bg-primary/80 transition-all"
                >
                  Checkout
                </button>
                <button
                  onClick={() => setInputMode(null)}
                  className="p-2 px-4 rounded-xl bg-glass border border-glass-border hover:border-primary transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {inputMode === 'jira' && (
            <div className="space-y-3">
              <input
                ref={inputDialogRef}
                type="text"
                value={jiraForm.project}
                onChange={(e) => setJiraForm({ ...jiraForm, project: e.target.value })}
                placeholder="Project key (e.g., PROJ)"
                className="w-full bg-glass border border-glass-border rounded-xl p-3 text-text-main focus:outline-none focus:border-primary transition-colors"
              />
              <input
                type="text"
                value={jiraForm.summary}
                onChange={(e) => setJiraForm({ ...jiraForm, summary: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && executeWithInput()}
                placeholder="Summary"
                className="w-full bg-glass border border-glass-border rounded-xl p-3 text-text-main focus:outline-none focus:border-primary transition-colors"
              />
              <textarea
                value={jiraForm.description}
                onChange={(e) => setJiraForm({ ...jiraForm, description: e.target.value })}
                placeholder="Description (optional)"
                className="w-full bg-glass border border-glass-border rounded-xl p-3 text-text-main focus:outline-none focus:border-primary transition-colors h-24"
              />
              <select
                value={jiraForm.issue_type}
                onChange={(e) => setJiraForm({ ...jiraForm, issue_type: e.target.value })}
                className="w-full bg-glass border border-glass-border rounded-xl p-3 text-text-main focus:outline-none focus:border-primary transition-colors"
              >
                <option value="Task">Task</option>
                <option value="Bug">Bug</option>
                <option value="Story">Story</option>
              </select>
              <div className="flex gap-2">
                <button
                  onClick={executeWithInput}
                  className="flex-1 bg-primary text-white p-2 px-4 rounded-xl font-semibold hover:bg-primary/80 transition-all"
                >
                  Create Ticket
                </button>
                <button
                  onClick={() => setInputMode(null)}
                  className="p-2 px-4 rounded-xl bg-glass border border-glass-border hover:border-primary transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {inputMode === 'docs' && (
            <div className="space-y-3">
              <input
                ref={inputDialogRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && executeWithInput()}
                placeholder="Search documentation..."
                className="w-full bg-glass border border-glass-border rounded-xl p-3 text-text-main focus:outline-none focus:border-primary transition-colors"
              />
              <div className="flex gap-2">
                <button
                  onClick={executeWithInput}
                  className="flex-1 bg-primary text-white p-2 px-4 rounded-xl font-semibold hover:bg-primary/80 transition-all"
                >
                  Search
                </button>
                <button
                  onClick={() => setInputMode(null)}
                  className="p-2 px-4 rounded-xl bg-glass border border-glass-border hover:border-primary transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Command List */}
        {!inputMode && !output && !isLoading && (
          <div className="max-h-96 overflow-y-auto">
            {filteredCommands.length === 0 ? (
              <div className="p-8 text-center text-text-muted">
                No commands found for "{searchQuery}"
              </div>
            ) : (
              filteredCommands.map((cmd, index) => (
                <div
                  key={cmd.id}
                  className={`p-4 px-6 border-b border-glass-border cursor-pointer transition-all ${
                    index === selectedIndex
                      ? 'bg-glass border-l-4 border-l-primary'
                      : 'hover:bg-glass/50'
                  }`}
                  onClick={() => executeCommand(cmd)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{cmd.icon}</span>
                    <div className="flex-1">
                      <div className="font-semibold text-text-main">{cmd.label}</div>
                      <div className="text-sm text-text-muted">{cmd.description}</div>
                    </div>
                    <div className="text-xs text-text-muted bg-glass px-2 py-1 rounded">
                      {cmd.category}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="p-8 text-center">
            <div className="animate-pulse text-text-muted">Executing command...</div>
          </div>
        )}

        {/* Output Display */}
        {output && !isLoading && (
          <div className="p-6 max-h-96 overflow-y-auto">
            {output.success ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-400">
                  <span className="text-xl">✓</span>
                  <span className="font-semibold">Success</span>
                </div>

                {/* Special handling for doc search results */}
                {output.results ? (
                  <div className="space-y-4">
                    <div className="text-text-muted text-sm">
                      Found {output.results.length} file(s) matching "{output.query}"
                    </div>
                    {output.results.map((result, idx) => (
                      <div key={idx} className="bg-glass border border-glass-border rounded-xl p-4">
                        <div className="font-semibold text-primary mb-2">{result.file}</div>
                        {result.matches.map((match, midx) => (
                          <div key={midx} className="text-sm text-text-muted mb-1">
                            <span className="text-text-main">Line {match.line}:</span> {match.content}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : output.url ? (
                  // Jira ticket created
                  <div className="space-y-2">
                    <div className="text-text-main">
                      Created ticket: <span className="font-semibold text-primary">{output.key}</span>
                    </div>
                    <a
                      href={output.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {output.url}
                    </a>
                  </div>
                ) : output.output ? (
                  <pre className="bg-glass border border-glass-border rounded-xl p-4 text-sm text-text-main overflow-x-auto font-mono whitespace-pre-wrap">
                    {output.output}
                  </pre>
                ) : (
                  <div className="text-text-muted">Command executed successfully</div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-red-400">
                  <span className="text-xl">✕</span>
                  <span className="font-semibold">Error</span>
                </div>
                {output.error && (
                  <pre className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-400 overflow-x-auto font-mono whitespace-pre-wrap">
                    {output.error}
                  </pre>
                )}
                {output.output && (
                  <pre className="bg-glass border border-glass-border rounded-xl p-4 text-sm text-text-muted overflow-x-auto font-mono whitespace-pre-wrap">
                    {output.output}
                  </pre>
                )}
              </div>
            )}

            <div className="mt-4">
              <button
                onClick={() => {
                  setOutput(null);
                  setSearchQuery('');
                  setSelectedIndex(0);
                }}
                className="w-full bg-glass border border-glass-border p-2 rounded-xl hover:border-primary transition-all"
              >
                Run Another Command
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CommandPalette;
