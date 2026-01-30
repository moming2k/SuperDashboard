import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../../config';

// Simple syntax highlighting using HTML
const SyntaxHighlight = ({ code, language }) => {
  return (
    <pre className="bg-bg-dark rounded-xl p-4 overflow-x-auto text-sm">
      <code className={`language-${language}`}>
        {code}
      </code>
    </pre>
  );
};

function SnippetManager() {
  const [snippets, setSnippets] = useState([]);
  const [tags, setTags] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('library');
  const [selectedSnippet, setSelectedSnippet] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versions, setVersions] = useState([]);
  const [editingSnippet, setEditingSnippet] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    visibility: '',
    language: '',
    tag: '',
    search: '',
    favorite: null,
    sort_by: 'updated_at'
  });

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    code: '',
    language: 'python',
    visibility: 'personal',
    tags: [],
    favorite: false
  });

  const [tagInput, setTagInput] = useState('');

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Ctrl/Cmd + K: Focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('snippet-search')?.focus();
      }
      // Ctrl/Cmd + B: New snippet
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        resetForm();
        setShowCreateForm(true);
        setActiveTab('library');
      }
      // Escape: Close modals
      if (e.key === 'Escape') {
        setShowCreateForm(false);
        setShowVersionHistory(false);
        setSelectedSnippet(null);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  useEffect(() => {
    fetchSnippets();
    fetchTags();
    fetchLanguages();
    fetchStats();
  }, [filters]);

  const fetchSnippets = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (filters.visibility) queryParams.append('visibility', filters.visibility);
      if (filters.language) queryParams.append('language', filters.language);
      if (filters.tag) queryParams.append('tag', filters.tag);
      if (filters.search) queryParams.append('search', filters.search);
      if (filters.favorite !== null) queryParams.append('favorite', filters.favorite);
      queryParams.append('sort_by', filters.sort_by);

      const res = await fetch(`${API_BASE}/plugins/snippet-manager/snippets?${queryParams}`);
      const data = await res.json();
      setSnippets(data);
    } catch (error) {
      console.error('Failed to fetch snippets:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTags = async () => {
    try {
      const res = await fetch(`${API_BASE}/plugins/snippet-manager/tags`);
      const data = await res.json();
      setTags(data);
    } catch (error) {
      console.error('Failed to fetch tags:', error);
    }
  };

  const fetchLanguages = async () => {
    try {
      const res = await fetch(`${API_BASE}/plugins/snippet-manager/languages`);
      const data = await res.json();
      setLanguages(data);
    } catch (error) {
      console.error('Failed to fetch languages:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/plugins/snippet-manager/stats`);
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchVersionHistory = async (snippetId) => {
    try {
      const res = await fetch(`${API_BASE}/plugins/snippet-manager/snippets/${snippetId}/versions`);
      const data = await res.json();
      setVersions(data);
      setShowVersionHistory(true);
    } catch (error) {
      console.error('Failed to fetch versions:', error);
    }
  };

  const createSnippet = async () => {
    // Validate required fields
    if (!formData.title.trim()) {
      alert('Please enter a title for your snippet');
      return;
    }
    if (!formData.code.trim()) {
      alert('Please enter code for your snippet');
      return;
    }

    try {
      await fetch(`${API_BASE}/plugins/snippet-manager/snippets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      setShowCreateForm(false);
      resetForm();
      fetchSnippets();
      fetchTags();
      fetchStats();
    } catch (error) {
      console.error('Failed to create snippet:', error);
    }
  };

  const updateSnippet = async (snippetId, updates) => {
    try {
      await fetch(`${API_BASE}/plugins/snippet-manager/snippets/${snippetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      fetchSnippets();
      setSelectedSnippet(null);
    } catch (error) {
      console.error('Failed to update snippet:', error);
    }
  };

  const deleteSnippet = async (snippetId) => {
    if (!confirm('Are you sure you want to delete this snippet?')) return;

    try {
      await fetch(`${API_BASE}/plugins/snippet-manager/snippets/${snippetId}`, {
        method: 'DELETE'
      });
      fetchSnippets();
      fetchTags();
      fetchStats();
      setSelectedSnippet(null);
    } catch (error) {
      console.error('Failed to delete snippet:', error);
    }
  };

  const toggleFavorite = async (snippetId) => {
    try {
      await fetch(`${API_BASE}/plugins/snippet-manager/snippets/${snippetId}/favorite`, {
        method: 'POST'
      });
      fetchSnippets();
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const incrementUseCount = async (snippetId) => {
    try {
      await fetch(`${API_BASE}/plugins/snippet-manager/snippets/${snippetId}/use`, {
        method: 'POST'
      });
      fetchSnippets();
    } catch (error) {
      console.error('Failed to increment use count:', error);
    }
  };

  const copyToClipboard = async (code, snippetId, e) => {
    if (e) {
      e.stopPropagation();
    }
    try {
      await navigator.clipboard.writeText(code);
      await incrementUseCount(snippetId);
      setCopyFeedback(snippetId);
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const openEditForm = (snippet) => {
    setFormData({
      title: snippet.title,
      description: snippet.description || '',
      code: snippet.code,
      language: snippet.language,
      visibility: snippet.visibility,
      tags: snippet.tags || [],
      favorite: snippet.favorite
    });
    setEditingSnippet(snippet);
    setShowCreateForm(true);
    setSelectedSnippet(null);
  };

  const saveSnippet = async () => {
    try {
      if (editingSnippet) {
        await updateSnippet(editingSnippet.id, formData);
      } else {
        await fetch(`${API_BASE}/plugins/snippet-manager/snippets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      }
      setShowCreateForm(false);
      setEditingSnippet(null);
      resetForm();
      fetchSnippets();
      fetchTags();
      fetchStats();
    } catch (error) {
      console.error('Failed to save snippet:', error);
    }
  };

  const restoreVersion = async (snippetId, versionNumber) => {
    try {
      await fetch(`${API_BASE}/plugins/snippet-manager/snippets/${snippetId}/versions/${versionNumber}/restore`, {
        method: 'POST'
      });
      setShowVersionHistory(false);
      fetchSnippets();
    } catch (error) {
      console.error('Failed to restore version:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      code: '',
      language: 'python',
      visibility: 'personal',
      tags: [],
      favorite: false
    });
    setTagInput('');
    setEditingSnippet(null);
  };

  const addTag = () => {
    if (tagInput && !formData.tags.includes(tagInput)) {
      setFormData({ ...formData, tags: [...formData.tags, tagInput] });
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove) => {
    setFormData({ ...formData, tags: formData.tags.filter(t => t !== tagToRemove) });
  };

  const getLanguageIcon = (language) => {
    const icons = {
      python: '🐍',
      javascript: '📜',
      typescript: '📘',
      java: '☕',
      go: '🔵',
      rust: '🦀',
      sql: '🗄️',
      bash: '💻',
      docker: '🐳',
      html: '🌐',
      css: '🎨',
      json: '📋',
      yaml: '📄',
      markdown: '📝'
    };
    return icons[language] || '📄';
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            📋 Snippet Manager
          </h1>
          <p className="text-text-muted">
            Store and share code snippets with your team
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              resetForm();
              setShowCreateForm(true);
            }}
            className="bg-primary text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-hover transition-all"
          >
            + New Snippet
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-glass backdrop-blur-xl border border-glass-border rounded-2xl p-4">
          <div className="text-text-muted text-sm mb-1">Total Snippets</div>
          <div className="text-3xl font-bold">{stats.total_snippets || 0}</div>
        </div>
        <div className="bg-glass backdrop-blur-xl border border-glass-border rounded-2xl p-4">
          <div className="text-text-muted text-sm mb-1">Team Snippets</div>
          <div className="text-3xl font-bold">{stats.team_snippets || 0}</div>
        </div>
        <div className="bg-glass backdrop-blur-xl border border-glass-border rounded-2xl p-4">
          <div className="text-text-muted text-sm mb-1">Favorites</div>
          <div className="text-3xl font-bold">{stats.favorite_snippets || 0}</div>
        </div>
        <div className="bg-glass backdrop-blur-xl border border-glass-border rounded-2xl p-4">
          <div className="text-text-muted text-sm mb-1">Total Tags</div>
          <div className="text-3xl font-bold">{stats.total_tags || 0}</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-glass backdrop-blur-xl border border-glass-border rounded-2xl p-6 mb-6">
        <div className="grid grid-cols-5 gap-4 mb-4">
          <input
            id="snippet-search"
            type="text"
            placeholder="Search snippets... (Ctrl+K)"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="col-span-2 bg-bg-dark border border-glass-border rounded-xl px-4 py-2 text-text-main"
          />
          <select
            value={filters.language}
            onChange={(e) => setFilters({ ...filters, language: e.target.value })}
            className="bg-bg-dark border border-glass-border rounded-xl px-3 py-2 text-text-main"
          >
            <option value="">All Languages</option>
            {languages.map(lang => (
              <option key={lang.value} value={lang.value}>{lang.label}</option>
            ))}
          </select>
          <select
            value={filters.tag}
            onChange={(e) => setFilters({ ...filters, tag: e.target.value })}
            className="bg-bg-dark border border-glass-border rounded-xl px-3 py-2 text-text-main"
          >
            <option value="">All Tags</option>
            {tags.map(tag => (
              <option key={tag.name} value={tag.name}>{tag.name} ({tag.count})</option>
            ))}
          </select>
          <select
            value={filters.sort_by}
            onChange={(e) => setFilters({ ...filters, sort_by: e.target.value })}
            className="bg-bg-dark border border-glass-border rounded-xl px-3 py-2 text-text-main"
          >
            <option value="updated_at">Recently Updated</option>
            <option value="created_at">Recently Created</option>
            <option value="title">Title A-Z</option>
            <option value="use_count">Most Used</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilters({ ...filters, favorite: filters.favorite === true ? null : true })}
            className={`px-4 py-2 rounded-xl transition-all ${filters.favorite === true
              ? 'bg-primary text-white'
              : 'bg-bg-dark border border-glass-border text-text-main hover:border-primary'
              }`}
          >
            ⭐ Favorites
          </button>
          <button
            onClick={() => setFilters({ ...filters, visibility: filters.visibility === 'team' ? '' : 'team' })}
            className={`px-4 py-2 rounded-xl transition-all ${filters.visibility === 'team'
              ? 'bg-primary text-white'
              : 'bg-bg-dark border border-glass-border text-text-main hover:border-primary'
              }`}
          >
            👥 Team
          </button>
          <button
            onClick={() => setFilters({ ...filters, visibility: filters.visibility === 'personal' ? '' : 'personal' })}
            className={`px-4 py-2 rounded-xl transition-all ${filters.visibility === 'personal'
              ? 'bg-primary text-white'
              : 'bg-bg-dark border border-glass-border text-text-main hover:border-primary'
              }`}
          >
            👤 Personal
          </button>
        </div>
      </div>

      {/* Snippets Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : snippets.length === 0 ? (
        <div className="bg-glass backdrop-blur-xl border border-glass-border rounded-2xl p-12 text-center">
          <p className="text-text-muted text-lg mb-4">No snippets found</p>
          <button
            onClick={() => {
              resetForm();
              setShowCreateForm(true);
            }}
            className="bg-primary text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-hover transition-all"
          >
            Create Your First Snippet
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          {snippets.map((snippet) => (
            <div
              key={snippet.id}
              className="bg-glass backdrop-blur-xl border border-glass-border rounded-2xl p-6 hover:border-primary transition-all cursor-pointer"
              onClick={() => setSelectedSnippet(snippet)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{getLanguageIcon(snippet.language)}</span>
                  <div>
                    <h3 className="text-lg font-semibold">{snippet.title || '(Untitled)'}</h3>
                    <span className="text-xs text-text-main">{snippet.language}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => copyToClipboard(snippet.code, snippet.id, e)}
                    className={`p-2 rounded-lg transition-all ${
                      copyFeedback === snippet.id
                        ? 'bg-green-500 text-white'
                        : 'bg-bg-dark hover:bg-primary hover:text-white'
                    }`}
                    title="Copy to clipboard"
                  >
                    {copyFeedback === snippet.id ? '✓' : '📋'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditForm(snippet);
                    }}
                    className="p-2 rounded-lg bg-bg-dark hover:bg-primary hover:text-white transition-all"
                    title="Edit snippet"
                  >
                    ✏️
                  </button>
                  <div className="flex gap-1">
                    {snippet.favorite && <span className="text-lg">⭐</span>}
                    {snippet.visibility === 'team' && <span className="text-lg">👥</span>}
                  </div>
                </div>
              </div>

              {snippet.description && (
                <p className="text-text-muted text-sm mb-3">{snippet.description}</p>
              )}

              <SyntaxHighlight code={snippet.code.substring(0, 200) + (snippet.code.length > 200 ? '...' : '')} language={snippet.language} />

              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {snippet.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-1 bg-primary bg-opacity-20 text-primary rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between mt-3 text-xs text-text-muted">
                <span>Used {snippet.use_count} times</span>
                <span>{new Date(snippet.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-bg-card border border-glass-border rounded-2xl p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">
              {editingSnippet ? 'Edit Snippet' : 'Create New Snippet'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-main mb-2">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-bg-dark border border-glass-border rounded-xl px-4 py-2 text-text-main"
                  placeholder="Snippet title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-main mb-2">Description (optional)</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-bg-dark border border-glass-border rounded-xl px-4 py-2 text-text-main"
                  placeholder="What does this snippet do?"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-main mb-2">Language</label>
                  <select
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                    className="w-full bg-bg-dark border border-glass-border rounded-xl px-4 py-2 text-text-main"
                  >
                    {languages.map(lang => (
                      <option key={lang.value} value={lang.value}>{lang.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-main mb-2">Visibility</label>
                  <select
                    value={formData.visibility}
                    onChange={(e) => setFormData({ ...formData, visibility: e.target.value })}
                    className="w-full bg-bg-dark border border-glass-border rounded-xl px-4 py-2 text-text-main"
                  >
                    <option value="personal">Personal</option>
                    <option value="team">Team</option>
                    <option value="public">Public</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-main mb-2">Code</label>
                <textarea
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full bg-bg-dark border border-glass-border rounded-xl px-4 py-2 text-text-main font-mono text-sm"
                  rows={12}
                  placeholder="Paste your code here..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-main mb-2">Tags</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    className="flex-1 bg-bg-dark border border-glass-border rounded-xl px-4 py-2 text-text-main"
                    placeholder="Add tag..."
                  />
                  <button
                    onClick={addTag}
                    className="bg-primary text-white px-4 py-2 rounded-xl hover:bg-primary-hover transition-all"
                  >
                    Add
                  </button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {formData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-primary bg-opacity-20 text-primary rounded-full text-sm flex items-center gap-2"
                    >
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="text-red-500 hover:text-red-400"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.favorite}
                  onChange={(e) => setFormData({ ...formData, favorite: e.target.checked })}
                  className="w-4 h-4"
                />
                <label className="text-sm text-text-main">Mark as favorite</label>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={saveSnippet}
                className="bg-primary text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-hover transition-all"
              >
                {editingSnippet ? 'Save Changes' : 'Create Snippet'}
              </button>
              <button
                onClick={() => { setShowCreateForm(false); resetForm(); }}
                className="bg-glass border border-glass-border text-text-main px-6 py-3 rounded-xl hover:border-red-500 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Snippet Detail Modal */}
      {selectedSnippet && !showVersionHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-bg-card border border-glass-border rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">{selectedSnippet.title || '(Untitled Snippet)'}</h2>
                {selectedSnippet.description && (
                  <p className="text-text-muted">{selectedSnippet.description}</p>
                )}
              </div>
              <button
                onClick={() => setSelectedSnippet(null)}
                className="text-2xl text-text-muted hover:text-red-500"
              >
                ×
              </button>
            </div>

            <div className="flex items-center gap-4 mb-4">
              <span className="text-2xl">{getLanguageIcon(selectedSnippet.language)}</span>
              <span className="px-3 py-1 bg-primary text-white rounded-full text-sm">
                {selectedSnippet.language}
              </span>
              <span className="px-3 py-1 bg-glass border border-glass-border rounded-full text-sm">
                {selectedSnippet.visibility}
              </span>
              {selectedSnippet.favorite && <span className="text-xl">⭐</span>}
            </div>

            <div className="mb-4">
              <SyntaxHighlight code={selectedSnippet.code} language={selectedSnippet.language} />
            </div>

            <div className="flex gap-2 flex-wrap mb-4">
              {selectedSnippet.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-primary bg-opacity-20 text-primary rounded-full text-sm"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="text-sm text-text-muted mb-6">
              <div>Created: {new Date(selectedSnippet.created_at).toLocaleString()}</div>
              <div>Updated: {new Date(selectedSnippet.updated_at).toLocaleString()}</div>
              <div>Used: {selectedSnippet.use_count} times</div>
              {selectedSnippet.versions.length > 0 && (
                <div>Versions: {selectedSnippet.versions.length}</div>
              )}
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => copyToClipboard(selectedSnippet.code, selectedSnippet.id)}
                className="bg-primary text-white px-4 py-2 rounded-xl hover:bg-primary-hover transition-all"
              >
                📋 Copy Code
              </button>
              <button
                onClick={() => openEditForm(selectedSnippet)}
                className="bg-glass border border-glass-border text-text-main px-4 py-2 rounded-xl hover:border-primary transition-all"
              >
                ✏️ Edit
              </button>
              <button
                onClick={() => toggleFavorite(selectedSnippet.id)}
                className="bg-glass border border-glass-border text-text-main px-4 py-2 rounded-xl hover:border-primary transition-all"
              >
                {selectedSnippet.favorite ? '★ Unfavorite' : '☆ Favorite'}
              </button>
              {selectedSnippet.versions.length > 0 && (
                <button
                  onClick={() => fetchVersionHistory(selectedSnippet.id)}
                  className="bg-glass border border-glass-border text-text-main px-4 py-2 rounded-xl hover:border-primary transition-all"
                >
                  📜 View History ({selectedSnippet.versions.length})
                </button>
              )}
              <button
                onClick={() => deleteSnippet(selectedSnippet.id)}
                className="bg-red-500 text-white px-4 py-2 rounded-xl hover:bg-red-600 transition-all"
              >
                🗑️ Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {showVersionHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-bg-card border border-glass-border rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-6">
              <h2 className="text-2xl font-bold">Version History</h2>
              <button
                onClick={() => setShowVersionHistory(false)}
                className="text-2xl text-text-muted hover:text-red-500"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {versions.map((version) => (
                <div
                  key={version.version}
                  className="bg-glass border border-glass-border rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="font-semibold">Version {version.version}</span>
                      <span className="text-text-muted text-sm ml-3">
                        {new Date(version.created_at).toLocaleString()}
                      </span>
                    </div>
                    <button
                      onClick={() => restoreVersion(selectedSnippet.id, version.version)}
                      className="bg-primary text-white px-3 py-1 rounded-lg text-sm hover:bg-primary-hover transition-all"
                    >
                      Restore
                    </button>
                  </div>
                  {version.description && (
                    <p className="text-text-muted text-sm mb-2">{version.description}</p>
                  )}
                  <SyntaxHighlight code={version.code} language={selectedSnippet.language} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Help */}
      <div className="fixed bottom-4 right-4 bg-glass backdrop-blur-xl border border-glass-border rounded-xl p-3 text-xs text-text-muted">
        <div>⌘/Ctrl + K: Search</div>
        <div>⌘/Ctrl + B: New Snippet</div>
        <div>Esc: Close</div>
      </div>
    </div>
  );
}

export default SnippetManager;
