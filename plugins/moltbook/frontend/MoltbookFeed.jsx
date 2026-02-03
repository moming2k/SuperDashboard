import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = 'http://localhost:8000';

function MoltbookFeed() {
  // State management
  const [posts, setPosts] = useState([]);
  const [profile, setProfile] = useState(null);
  const [submolts, setSubmolts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [configured, setConfigured] = useState(false);

  // UI State
  const [activeView, setActiveView] = useState('feed'); // feed, search, profile, post, agent
  const [selectedPost, setSelectedPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [sortOrder, setSortOrder] = useState('hot');
  const [selectedSubmolt, setSelectedSubmolt] = useState(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchType, setSearchType] = useState('all');

  // Post creation state
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [newPost, setNewPost] = useState({ submolt: '', title: '', content: '' });

  // Comment state
  const [newComment, setNewComment] = useState('');

  // Autonomous Agent state
  const [agentState, setAgentState] = useState(null);
  const [agentActivity, setAgentActivity] = useState([]);
  const [agentLoading, setAgentLoading] = useState(false);

  // Check configuration on mount
  useEffect(() => {
    checkConfig();
  }, []);

  // Load data when configured
  useEffect(() => {
    if (configured) {
      loadFeed();
      loadProfile();
      loadSubmolts();
    }
  }, [configured, sortOrder, selectedSubmolt]);

  // Initial agent state load when configured
  useEffect(() => {
    if (configured) {
      loadAgentState();
    }
  }, [configured]);
  // Periodic agent state refresh
  useEffect(() => {
    if (configured && activeView === 'agent') {
      const interval = setInterval(() => {
        loadAgentState();
        loadAgentActivity();
      }, 10000); // Refresh every 10 seconds when on agent view
      return () => clearInterval(interval);
    }
  }, [configured, activeView]);

  const checkConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/plugins/moltbook/config`);
      const data = await res.json();
      setConfigured(data.configured);
      if (!data.configured) {
        setError('Moltbook API key not configured. Add MOLTBOOK_API_KEY to your .env file.');
        setLoading(false);
      }
    } catch (err) {
      setError('Failed to check Moltbook configuration');
      setLoading(false);
    }
  };

  const loadFeed = async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = selectedSubmolt
        ? `/plugins/moltbook/posts?submolt=${selectedSubmolt}&sort=${sortOrder}`
        : `/plugins/moltbook/feed?sort=${sortOrder}`;
      const res = await fetch(`${API_BASE}${endpoint}`);
      if (!res.ok) throw new Error('Failed to load feed');
      const data = await res.json();
      setPosts(data.data || data.posts || data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/plugins/moltbook/me`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data.data || data);
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  };

  const loadSubmolts = async () => {
    try {
      const res = await fetch(`${API_BASE}/plugins/moltbook/submolts`);
      if (res.ok) {
        const data = await res.json();
        setSubmolts(data.data || data.submolts || data || []);
      }
    } catch (err) {
      console.error('Failed to load submolts:', err);
    }
  };

  const loadComments = async (postId) => {
    try {
      // Comments are included in the post data, not a separate endpoint
      const res = await fetch(`${API_BASE}/plugins/moltbook/posts/${postId}`);
      if (res.ok) {
        const data = await res.json();
        // Extract comments from the post response
        const postData = data.data || data.post || data;
        setComments(postData.comments || []);
      }
    } catch (err) {
      console.error('Failed to load comments:', err);
    }
  };

  const handleVote = async (postId, voteType) => {
    try {
      const res = await fetch(`${API_BASE}/plugins/moltbook/posts/${postId}/${voteType}`, {
        method: 'POST'
      });
      if (res.ok) {
        loadFeed(); // Refresh to show updated vote count
      }
    } catch (err) {
      console.error('Failed to vote:', err);
    }
  };

  const handleCommentVote = async (commentId) => {
    try {
      const res = await fetch(`${API_BASE}/plugins/moltbook/comments/${commentId}/upvote`, {
        method: 'POST'
      });
      if (res.ok && selectedPost) {
        loadComments(selectedPost.id);
      }
    } catch (err) {
      console.error('Failed to vote on comment:', err);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPost.submolt || !newPost.title) return;

    try {
      const res = await fetch(`${API_BASE}/plugins/moltbook/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPost)
      });

      if (res.ok) {
        setNewPost({ submolt: '', title: '', content: '' });
        setShowCreatePost(false);
        loadFeed();
      } else {
        const data = await res.json();
        alert(data.detail || 'Failed to create post');
      }
    } catch (err) {
      alert('Failed to create post: ' + err.message);
    }
  };

  const handleCreateComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !selectedPost) return;

    try {
      const res = await fetch(`${API_BASE}/plugins/moltbook/posts/${selectedPost.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment })
      });

      if (res.ok) {
        setNewComment('');
        loadComments(selectedPost.id);
      } else {
        const data = await res.json();
        alert(data.detail || 'Failed to create comment');
      }
    } catch (err) {
      alert('Failed to create comment: ' + err.message);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/plugins/moltbook/search?q=${encodeURIComponent(searchQuery)}&type=${searchType}`
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.data || data.results || data || []);
        setActiveView('search');
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // Autonomous Agent Functions
  const loadAgentState = async () => {
    try {
      const res = await fetch(`${API_BASE}/plugins/moltbook/agent/state`);
      if (res.ok) {
        const data = await res.json();
        setAgentState(data);
      }
    } catch (err) {
      console.error('Failed to load agent state:', err);
    }
  };

  const loadAgentActivity = async () => {
    try {
      const res = await fetch(`${API_BASE}/plugins/moltbook/agent/activity?limit=20`);
      if (res.ok) {
        const data = await res.json();
        setAgentActivity(data.activities || []);
      }
    } catch (err) {
      console.error('Failed to load agent activity:', err);
    }
  };

  const startAgent = async () => {
    setAgentLoading(true);
    try {
      const res = await fetch(`${API_BASE}/plugins/moltbook/agent/start`, { method: 'POST' });
      if (res.ok) {
        await loadAgentState();
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to start agent');
      }
    } catch (err) {
      alert('Failed to start agent: ' + err.message);
    } finally {
      setAgentLoading(false);
    }
  };

  const stopAgent = async () => {
    setAgentLoading(true);
    try {
      const res = await fetch(`${API_BASE}/plugins/moltbook/agent/stop`, { method: 'POST' });
      if (res.ok) {
        await loadAgentState();
      }
    } catch (err) {
      alert('Failed to stop agent: ' + err.message);
    } finally {
      setAgentLoading(false);
    }
  };

  const triggerHeartbeat = async () => {
    setAgentLoading(true);
    try {
      const res = await fetch(`${API_BASE}/plugins/moltbook/agent/heartbeat`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        await loadAgentState();
        await loadAgentActivity();
        if (data.actions && data.actions.length > 0) {
          alert(`Heartbeat completed!\nActions: ${data.actions.join(', ')}`);
        } else {
          alert('Heartbeat completed. No actions taken.');
        }
      }
    } catch (err) {
      alert('Heartbeat failed: ' + err.message);
    } finally {
      setAgentLoading(false);
    }
  };

  const updateAgentSettings = async (settings) => {
    try {
      const res = await fetch(`${API_BASE}/plugins/moltbook/agent/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        await loadAgentState();
      }
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  };

  const generateAIPost = async (submolt, topic) => {
    setAgentLoading(true);
    try {
      const res = await fetch(`${API_BASE}/plugins/moltbook/agent/generate-post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submolt, topic })
      });
      if (res.ok) {
        await loadAgentActivity();
        await loadFeed();
        alert('AI post created successfully!');
      } else {
        const data = await res.json();
        alert(data.detail || 'Failed to create AI post');
      }
    } catch (err) {
      alert('Failed to create AI post: ' + err.message);
    } finally {
      setAgentLoading(false);
    }
  };

  const openPost = (post) => {
    setSelectedPost(post);
    setActiveView('post');
    loadComments(post.id);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Render not configured state
  if (!configured && !loading) {
    return (
      <div className="p-8">
        <div className="bg-bg-card backdrop-blur-xl border border-glass-border rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-text-main mb-4">Moltbook Not Configured</h2>
          <p className="text-text-muted mb-6">
            To use Moltbook, add your API key to the backend .env file:
          </p>
          <code className="bg-bg-dark p-4 rounded-lg block text-left text-sm text-text-muted">
            MOLTBOOK_API_KEY=your-api-key-here
          </code>
          <p className="text-text-muted mt-6 text-sm">
            Don't have an API key? Register your agent at{' '}
            <a href="https://moltbook.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              moltbook.com
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-text-main">Moltbook</h1>
          <span className="text-text-muted text-sm">The Agent Internet</span>
        </div>

        {profile && (
          <div className="flex items-center gap-3 bg-glass backdrop-blur-xl border border-glass-border rounded-xl px-4 py-2">
            <span className="text-text-main font-medium">{profile.name || 'Agent'}</span>
            <span className="text-accent font-bold">{profile.karma || 0} karma</span>
          </div>
        )}
      </div>

      {/* Navigation & Controls */}
      <div className="flex flex-wrap gap-4 mb-6">
        {/* View tabs */}
        <div className="flex gap-2 bg-glass backdrop-blur-xl border border-glass-border rounded-xl p-1">
          <button
            onClick={() => { setActiveView('feed'); setSelectedPost(null); }}
            className={`px-4 py-2 rounded-lg transition-all ${activeView === 'feed' ? 'bg-primary text-white' : 'text-text-muted hover:text-text-main'
              }`}
          >
            Feed
          </button>
          <button
            onClick={() => setActiveView('profile')}
            className={`px-4 py-2 rounded-lg transition-all ${activeView === 'profile' ? 'bg-primary text-white' : 'text-text-muted hover:text-text-main'
              }`}
          >
            Profile
          </button>
          <button
            onClick={() => { setActiveView('agent'); loadAgentState(); loadAgentActivity(); }}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${activeView === 'agent' ? 'bg-primary text-white' : 'text-text-muted hover:text-text-main'
              }`}
          >
            Agent
            {agentState?.running && (
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            )}
          </button>
        </div>

        {/* Sort dropdown */}
        {activeView === 'feed' && (
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="bg-glass backdrop-blur-xl border border-glass-border rounded-xl px-4 py-2 text-text-main cursor-pointer"
          >
            <option value="hot">Hot</option>
            <option value="new">New</option>
            <option value="top">Top</option>
            <option value="rising">Rising</option>
          </select>
        )}

        {/* Submolt filter */}
        {activeView === 'feed' && submolts.length > 0 && (
          <select
            value={selectedSubmolt || ''}
            onChange={(e) => setSelectedSubmolt(e.target.value || null)}
            className="bg-glass backdrop-blur-xl border border-glass-border rounded-xl px-4 py-2 text-text-main cursor-pointer"
          >
            <option value="">All Submolts</option>
            {submolts.map((s) => (
              <option key={s.name} value={s.name}>
                {s.display_name || s.name}
              </option>
            ))}
          </select>
        )}

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Moltbook..."
            className="flex-1 bg-glass backdrop-blur-xl border border-glass-border rounded-xl px-4 py-2 text-text-main placeholder-text-muted"
          />
          <button
            type="submit"
            className="bg-primary text-white px-4 py-2 rounded-xl hover:bg-primary-hover transition-all"
          >
            Search
          </button>
        </form>

        {/* Create Post Button */}
        {activeView === 'feed' && (
          <button
            onClick={() => setShowCreatePost(true)}
            className="bg-accent text-white px-4 py-2 rounded-xl hover:opacity-90 transition-all font-medium"
          >
            + New Post
          </button>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-6 text-red-300">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {/* Create Post Modal */}
      {showCreatePost && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-bg-card border border-glass-border rounded-2xl p-6 w-full max-w-lg mx-4">
            <h2 className="text-xl font-bold text-text-main mb-4">Create Post</h2>
            <form onSubmit={handleCreatePost} className="space-y-4">
              <div>
                <label className="block text-text-muted text-sm mb-1">Submolt</label>
                <select
                  value={newPost.submolt}
                  onChange={(e) => setNewPost({ ...newPost, submolt: e.target.value })}
                  className="w-full bg-glass border border-glass-border rounded-xl px-4 py-2 text-text-main"
                  required
                >
                  <option value="">Select a submolt...</option>
                  {submolts.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.display_name || s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-text-muted text-sm mb-1">Title</label>
                <input
                  type="text"
                  value={newPost.title}
                  onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                  className="w-full bg-glass border border-glass-border rounded-xl px-4 py-2 text-text-main"
                  placeholder="Post title"
                  required
                />
              </div>
              <div>
                <label className="block text-text-muted text-sm mb-1">Content</label>
                <textarea
                  value={newPost.content}
                  onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                  className="w-full bg-glass border border-glass-border rounded-xl px-4 py-2 text-text-main min-h-[120px]"
                  placeholder="Write your post content..."
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreatePost(false)}
                  className="px-4 py-2 text-text-muted hover:text-text-main transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-primary text-white px-6 py-2 rounded-xl hover:bg-primary-hover transition-all"
                >
                  Post
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {!loading && (
        <>
          {/* Feed View */}
          {activeView === 'feed' && (
            <div className="space-y-4">
              {posts.length === 0 ? (
                <div className="text-center py-12 text-text-muted">
                  No posts found. Be the first to post!
                </div>
              ) : (
                posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onVote={handleVote}
                    onClick={() => openPost(post)}
                    formatTime={formatTime}
                  />
                ))
              )}
            </div>
          )}

          {/* Post Detail View */}
          {activeView === 'post' && selectedPost && (
            <div className="space-y-4">
              <button
                onClick={() => { setActiveView('feed'); setSelectedPost(null); }}
                className="text-text-muted hover:text-text-main transition-all flex items-center gap-2"
              >
                ← Back to feed
              </button>

              <PostCard
                post={selectedPost}
                onVote={handleVote}
                formatTime={formatTime}
                expanded
              />

              {/* Comment form */}
              <form onSubmit={handleCreateComment} className="bg-glass backdrop-blur-xl border border-glass-border rounded-xl p-4">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  className="w-full bg-transparent border-none outline-none text-text-main placeholder-text-muted min-h-[80px] resize-none"
                />
                <div className="flex justify-end mt-2">
                  <button
                    type="submit"
                    disabled={!newComment.trim()}
                    className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-hover transition-all disabled:opacity-50"
                  >
                    Comment
                  </button>
                </div>
              </form>

              {/* Comments list */}
              <div className="space-y-3">
                <h3 className="text-text-main font-medium">Comments ({comments.length})</h3>
                {comments.map((comment) => (
                  <CommentCard
                    key={comment.id}
                    comment={comment}
                    onVote={handleCommentVote}
                    formatTime={formatTime}
                  />
                ))}
                {comments.length === 0 && (
                  <p className="text-text-muted text-center py-4">No comments yet</p>
                )}
              </div>
            </div>
          )}

          {/* Search Results View */}
          {activeView === 'search' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-text-main">
                  Search Results for "{searchQuery}"
                </h2>
                <button
                  onClick={() => setActiveView('feed')}
                  className="text-text-muted hover:text-text-main transition-all"
                >
                  ← Back to feed
                </button>
              </div>
              <div className="flex gap-2 mb-4">
                {['all', 'posts', 'comments'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setSearchType(type)}
                    className={`px-3 py-1 rounded-lg text-sm transition-all ${searchType === type
                      ? 'bg-primary text-white'
                      : 'bg-glass text-text-muted hover:text-text-main'
                      }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
              {searchResults.length === 0 ? (
                <p className="text-text-muted text-center py-8">No results found</p>
              ) : (
                searchResults.map((result, idx) => (
                  <div
                    key={result.id || idx}
                    className="bg-glass backdrop-blur-xl border border-glass-border rounded-xl p-4 hover:border-primary/50 transition-all cursor-pointer"
                    onClick={() => result.post_id ? null : openPost(result)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-text-main font-medium">{result.title || result.content?.slice(0, 100)}</h3>
                        {result.content && result.title && (
                          <p className="text-text-muted text-sm mt-1 line-clamp-2">{result.content}</p>
                        )}
                      </div>
                      {result.similarity && (
                        <span className="text-accent text-sm">
                          {Math.round(result.similarity * 100)}% match
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Profile View */}
          {activeView === 'profile' && profile && (
            <div className="bg-bg-card backdrop-blur-xl border border-glass-border rounded-2xl p-8">
              <div className="flex items-start gap-6">
                <div className="w-20 h-20 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-3xl">
                  {profile.avatar ? (
                    <img src={profile.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    '🤖'
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-text-main">{profile.name || 'Agent'}</h2>
                  <p className="text-text-muted mt-1">{profile.description || 'No description'}</p>
                  <div className="flex gap-6 mt-4">
                    <div>
                      <span className="text-2xl font-bold text-accent">{profile.karma || 0}</span>
                      <span className="text-text-muted ml-2">Karma</span>
                    </div>
                    <div>
                      <span className="text-2xl font-bold text-text-main">{profile.post_count || 0}</span>
                      <span className="text-text-muted ml-2">Posts</span>
                    </div>
                    <div>
                      <span className="text-2xl font-bold text-text-main">{profile.comment_count || 0}</span>
                      <span className="text-text-muted ml-2">Comments</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Agent View */}
          {activeView === 'agent' && (
            <div className="space-y-6">
              {/* Agent Control Panel */}
              <div className="bg-bg-card backdrop-blur-xl border border-glass-border rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-text-main">Autonomous Agent</h2>
                    <p className="text-text-muted text-sm mt-1">
                      Let your agent automatically engage with Moltbook
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${agentState?.running
                      ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                      : 'bg-gray-500/20 text-gray-400 border border-gray-500/50'
                      }`}>
                      {agentState?.running ? 'Running' : 'Stopped'}
                    </span>
                  </div>
                </div>

                {/* Requirements check */}
                {agentState && (!agentState.openai_configured || !agentState.moltbook_configured) && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6">
                    <p className="text-yellow-400 text-sm">
                      {!agentState.moltbook_configured && 'Moltbook API key not configured. '}
                      {!agentState.openai_configured && 'OpenAI API key not configured (required for AI-generated content).'}
                    </p>
                  </div>
                )}

                {/* Control buttons */}
                <div className="flex flex-wrap gap-3 mb-6">
                  {agentState?.running ? (
                    <button
                      onClick={stopAgent}
                      disabled={agentLoading}
                      className="bg-red-500 text-white px-6 py-2 rounded-xl hover:bg-red-600 transition-all disabled:opacity-50"
                    >
                      Stop Agent
                    </button>
                  ) : (
                    <button
                      onClick={startAgent}
                      disabled={agentLoading || !agentState?.openai_configured}
                      className="bg-green-500 text-white px-6 py-2 rounded-xl hover:bg-green-600 transition-all disabled:opacity-50"
                    >
                      Start Agent
                    </button>
                  )}
                  <button
                    onClick={triggerHeartbeat}
                    disabled={agentLoading || !agentState?.openai_configured}
                    className="bg-primary text-white px-6 py-2 rounded-xl hover:bg-primary-hover transition-all disabled:opacity-50"
                  >
                    Run Heartbeat Now
                  </button>
                </div>

                {/* Stats */}
                {agentState && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-glass rounded-xl p-4">
                      <div className="text-2xl font-bold text-text-main">{agentState.posts_today || 0}</div>
                      <div className="text-text-muted text-sm">Posts Today</div>
                    </div>
                    <div className="bg-glass rounded-xl p-4">
                      <div className="text-2xl font-bold text-text-main">{agentState.comments_today || 0}</div>
                      <div className="text-text-muted text-sm">Comments Today</div>
                    </div>
                    <div className="bg-glass rounded-xl p-4">
                      <div className="text-text-main text-sm">Last Heartbeat</div>
                      <div className="text-text-muted text-xs mt-1">
                        {agentState.last_heartbeat ? formatTime(agentState.last_heartbeat) : 'Never'}
                      </div>
                    </div>
                    <div className="bg-glass rounded-xl p-4">
                      <div className="text-text-main text-sm">Last Post</div>
                      <div className="text-text-muted text-xs mt-1">
                        {agentState.last_post ? formatTime(agentState.last_post) : 'Never'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Settings */}
                {agentState && (
                  <div className="border-t border-glass-border pt-6">
                    <h3 className="text-lg font-medium text-text-main mb-4">Agent Settings</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-text-main">Auto Vote</div>
                          <div className="text-text-muted text-sm">Automatically upvote interesting posts</div>
                        </div>
                        <button
                          onClick={() => updateAgentSettings({ auto_vote: !agentState.auto_vote })}
                          className={`w-12 h-6 rounded-full transition-all ${agentState.auto_vote ? 'bg-green-500' : 'bg-gray-600'
                            }`}
                        >
                          <div className={`w-5 h-5 rounded-full bg-white transition-all transform ${agentState.auto_vote ? 'translate-x-6' : 'translate-x-0.5'
                            }`}></div>
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-text-main">Auto Comment</div>
                          <div className="text-text-muted text-sm">Generate and post AI comments</div>
                        </div>
                        <button
                          onClick={() => updateAgentSettings({ auto_comment: !agentState.auto_comment })}
                          className={`w-12 h-6 rounded-full transition-all ${agentState.auto_comment ? 'bg-green-500' : 'bg-gray-600'
                            }`}
                        >
                          <div className={`w-5 h-5 rounded-full bg-white transition-all transform ${agentState.auto_comment ? 'translate-x-6' : 'translate-x-0.5'
                            }`}></div>
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-text-main">Auto Post</div>
                          <div className="text-text-muted text-sm">Periodically create AI-generated posts</div>
                        </div>
                        <button
                          onClick={() => updateAgentSettings({ auto_post: !agentState.auto_post })}
                          className={`w-12 h-6 rounded-full transition-all ${agentState.auto_post ? 'bg-green-500' : 'bg-gray-600'
                            }`}
                        >
                          <div className={`w-5 h-5 rounded-full bg-white transition-all transform ${agentState.auto_post ? 'translate-x-6' : 'translate-x-0.5'
                            }`}></div>
                        </button>
                      </div>
                      <div>
                        <div className="text-text-main mb-2">Heartbeat Interval</div>
                        <select
                          value={agentState.heartbeat_interval_hours}
                          onChange={(e) => updateAgentSettings({ heartbeat_interval_hours: parseInt(e.target.value) })}
                          className="bg-glass border border-glass-border rounded-xl px-4 py-2 text-text-main"
                        >
                          <option value="1">Every 1 hour</option>
                          <option value="2">Every 2 hours</option>
                          <option value="4">Every 4 hours</option>
                          <option value="6">Every 6 hours</option>
                          <option value="12">Every 12 hours</option>
                          <option value="24">Every 24 hours</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick AI Actions */}
              <div className="bg-bg-card backdrop-blur-xl border border-glass-border rounded-2xl p-6">
                <h3 className="text-lg font-medium text-text-main mb-4">Quick AI Actions</h3>
                <div className="flex flex-wrap gap-3">
                  {submolts.slice(0, 5).map((s) => (
                    <button
                      key={s.name}
                      onClick={() => generateAIPost(s.name, undefined)}
                      disabled={agentLoading || !agentState?.openai_configured}
                      className="bg-glass border border-glass-border px-4 py-2 rounded-xl text-text-main hover:border-primary/50 transition-all disabled:opacity-50"
                    >
                      Post to {s.display_name || s.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Activity Log */}
              <div className="bg-bg-card backdrop-blur-xl border border-glass-border rounded-2xl p-6">
                <h3 className="text-lg font-medium text-text-main mb-4">Activity Log</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {agentActivity.length === 0 ? (
                    <p className="text-text-muted text-center py-4">No activity yet</p>
                  ) : (
                    agentActivity.map((activity, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 p-3 bg-glass/50 rounded-lg"
                      >
                        <span className="text-lg">
                          {activity.action === 'heartbeat_started' && '💓'}
                          {activity.action === 'heartbeat_complete' && '✅'}
                          {activity.action === 'heartbeat_error' && '❌'}
                          {activity.action === 'upvoted' && '👍'}
                          {activity.action === 'commented' && '💬'}
                          {activity.action === 'posted' && '📝'}
                          {activity.action === 'agent_started' && '🚀'}
                          {activity.action === 'agent_stopped' && '🛑'}
                          {activity.action === 'settings_updated' && '⚙️'}
                          {!['heartbeat_started', 'heartbeat_complete', 'heartbeat_error', 'upvoted', 'commented', 'posted', 'agent_started', 'agent_stopped', 'settings_updated'].includes(activity.action) && '📋'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-text-main text-sm font-medium">
                            {activity.action.replace(/_/g, ' ')}
                          </div>
                          <div className="text-text-muted text-xs truncate">
                            {activity.details}
                          </div>
                        </div>
                        <div className="text-text-muted text-xs">
                          {formatTime(activity.timestamp)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Post Card Component
function PostCard({ post, onVote, onClick, formatTime, expanded = false }) {
  return (
    <div
      className={`bg-glass backdrop-blur-xl border border-glass-border rounded-xl p-4 transition-all ${!expanded ? 'hover:border-primary/50 cursor-pointer' : ''
        }`}
      onClick={!expanded ? onClick : undefined}
    >
      <div className="flex gap-4">
        {/* Vote buttons */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onVote(post.id, 'upvote'); }}
            className="text-text-muted hover:text-accent transition-all text-xl"
          >
            ▲
          </button>
          <span className="text-text-main font-bold">{post.score || post.upvotes || 0}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onVote(post.id, 'downvote'); }}
            className="text-text-muted hover:text-red-400 transition-all text-xl"
          >
            ▼
          </button>
        </div>

        {/* Post content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm text-text-muted mb-1">
            <span className="text-primary font-medium">
              {typeof post.submolt === 'object' ? (post.submolt?.display_name || post.submolt?.name || 'general') : (post.submolt || 'general')}
            </span>
            <span>•</span>
            <span>Posted by {typeof post.author === 'object' ? (post.author?.name || 'anonymous') : (post.author || 'anonymous')}</span>
            <span>•</span>
            <span>{formatTime(post.created_at)}</span>
          </div>

          <h3 className="text-lg font-medium text-text-main mb-2">{post.title}</h3>

          {(expanded || post.content?.length < 200) && post.content && (
            <p className="text-text-muted whitespace-pre-wrap">{post.content}</p>
          )}

          {!expanded && post.content?.length >= 200 && (
            <p className="text-text-muted line-clamp-3">{post.content}</p>
          )}

          {post.url && (
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline text-sm mt-2 inline-block"
              onClick={(e) => e.stopPropagation()}
            >
              {post.url}
            </a>
          )}

          <div className="flex items-center gap-4 mt-3 text-sm text-text-muted">
            <span className="flex items-center gap-1">
              💬 {post.comment_count || 0} comments
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Comment Card Component
function CommentCard({ comment, onVote, formatTime }) {
  return (
    <div className="bg-glass/50 backdrop-blur-xl border border-glass-border/50 rounded-lg p-3 ml-4">
      <div className="flex gap-3">
        <div className="flex flex-col items-center">
          <button
            onClick={() => onVote(comment.id)}
            className="text-text-muted hover:text-accent transition-all"
          >
            ▲
          </button>
          <span className="text-text-main text-sm">{comment.score || comment.upvotes || 0}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
            <span className="font-medium text-text-main">{typeof comment.author === 'object' ? (comment.author?.name || 'anonymous') : (comment.author || 'anonymous')}</span>
            <span>•</span>
            <span>{formatTime(comment.created_at)}</span>
          </div>
          <p className="text-text-muted text-sm whitespace-pre-wrap">{comment.content}</p>
        </div>
      </div>
    </div>
  );
}

export default MoltbookFeed;
