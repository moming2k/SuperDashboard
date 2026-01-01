import React, { useState, useEffect } from 'react';

// Detect if running in devcontainer and use appropriate backend port
const isDevContainer = import.meta.env.VITE_DEVCONTAINER === 'true';
const backendPort = isDevContainer ? 18010 : 8000;
const API_BASE = `http://localhost:${backendPort}`;

export default function RSSReader() {
    const [feeds, setFeeds] = useState([]);
    const [articles, setArticles] = useState([]);
    const [selectedArticle, setSelectedArticle] = useState(null);
    const [suggestedQA, setSuggestedQA] = useState([]);
    const [newFeedUrl, setNewFeedUrl] = useState('');
    const [showAddFeed, setShowAddFeed] = useState(false);
    const [question, setQuestion] = useState('');
    const [qaHistory, setQAHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingQA, setIsLoadingQA] = useState(false);
    const [isAsking, setIsAsking] = useState(false);
    const [stats, setStats] = useState(null);
    const [selectedFeed, setSelectedFeed] = useState(null);
    const [feedToDelete, setFeedToDelete] = useState(null);

    useEffect(() => {
        fetchFeeds();
        fetchArticles();
        fetchStats();

        // Poll for new articles every 60 seconds
        const interval = setInterval(() => {
            fetchArticles();
        }, 60000);

        return () => clearInterval(interval);
    }, [selectedFeed]);

    const fetchFeeds = async () => {
        try {
            const res = await fetch(`${API_BASE}/plugins/rss-reader/feeds`);
            if (!res.ok) {
                console.error("Failed to fetch feeds:", res.status);
                setFeeds([]);
                return;
            }
            const data = await res.json();
            setFeeds(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error("Failed to fetch feeds", e);
            setFeeds([]);
        }
    };

    const fetchArticles = async () => {
        try {
            const url = selectedFeed
                ? `${API_BASE}/plugins/rss-reader/articles?feed_id=${selectedFeed}&limit=50`
                : `${API_BASE}/plugins/rss-reader/articles?limit=50`;
            const res = await fetch(url);
            if (!res.ok) {
                console.error("Failed to fetch articles:", res.status);
                setArticles([]);
                return;
            }
            const data = await res.json();
            setArticles(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error("Failed to fetch articles", e);
            setArticles([]);
        }
    };

    const fetchStats = async () => {
        try {
            const res = await fetch(`${API_BASE}/plugins/rss-reader/stats`);
            if (!res.ok) {
                console.error("Failed to fetch stats:", res.status);
                return;
            }
            const data = await res.json();
            setStats(data);
        } catch (e) {
            console.error("Failed to fetch stats", e);
        }
    };

    const addFeed = async () => {
        if (!newFeedUrl.trim()) return;

        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/plugins/rss-reader/feeds`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: newFeedUrl })
            });

            if (!res.ok) {
                const error = await res.json();
                alert(`Failed to add feed: ${error.detail}`);
                return;
            }

            setNewFeedUrl('');
            setShowAddFeed(false);
            await fetchFeeds();
            await fetchArticles();
            await fetchStats();
        } catch (e) {
            console.error("Failed to add feed", e);
            alert('Failed to add feed. Please check the URL and try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const deleteFeed = async (feedId) => {
        try {
            const res = await fetch(`${API_BASE}/plugins/rss-reader/feeds/${feedId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                await fetchFeeds();
                await fetchArticles();
                await fetchStats();
                if (selectedFeed === feedId) {
                    setSelectedFeed(null);
                }
                setFeedToDelete(null);
            }
        } catch (e) {
            console.error("Failed to delete feed", e);
        }
    };

    const refreshFeed = async (feedId) => {
        try {
            const res = await fetch(`${API_BASE}/plugins/rss-reader/feeds/${feedId}/refresh`, {
                method: 'POST'
            });

            if (res.ok) {
                const data = await res.json();
                alert(`Refreshed! Found ${data.new_articles} new articles.`);
                await fetchFeeds();
                await fetchArticles();
                await fetchStats();
            }
        } catch (e) {
            console.error("Failed to refresh feed", e);
        }
    };

    const selectArticle = async (article) => {
        setSelectedArticle(article);
        setQAHistory([]);
        setSuggestedQA([]);

        // Load suggested Q&A
        setIsLoadingQA(true);
        try {
            const res = await fetch(`${API_BASE}/plugins/rss-reader/articles/${article.id}/qa`);
            const data = await res.json();
            setSuggestedQA(data);
        } catch (e) {
            console.error("Failed to fetch Q&A", e);
        } finally {
            setIsLoadingQA(false);
        }
    };

    const askQuestion = async () => {
        if (!question.trim() || !selectedArticle) return;

        setIsAsking(true);
        try {
            const res = await fetch(`${API_BASE}/plugins/rss-reader/articles/${selectedArticle.id}/question`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: question })
            });

            if (res.ok) {
                const data = await res.json();
                setQAHistory([...qaHistory, data]);
                setQuestion('');
            }
        } catch (e) {
            console.error("Failed to ask question", e);
            alert('Failed to get answer. Please try again.');
        } finally {
            setIsAsking(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'Unknown date';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="animate-fade h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold">RSS Reader</h1>
                    {stats && (
                        <p className="text-text-muted text-sm mt-1">
                            {stats.total_feeds} feeds · {stats.total_articles} articles
                        </p>
                    )}
                </div>
                <button
                    onClick={() => setShowAddFeed(true)}
                    className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-hover transition-colors font-semibold"
                >
                    + Add Feed
                </button>
            </div>

            {/* Add Feed Modal */}
            {showAddFeed && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowAddFeed(false)}>
                    <div className="bg-bg-card backdrop-blur-xl border border-glass-border rounded-2xl p-8 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-2xl font-bold mb-4">Add RSS Feed</h2>
                        <input
                            type="text"
                            placeholder="Enter RSS feed URL (e.g., https://example.com/rss)"
                            value={newFeedUrl}
                            onChange={(e) => setNewFeedUrl(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && !isLoading && addFeed()}
                            className="w-full bg-bg-dark/50 border border-glass-border rounded-xl p-3 text-white outline-none focus:border-primary transition-colors mb-4"
                            autoFocus
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={addFeed}
                                disabled={isLoading || !newFeedUrl.trim()}
                                className="flex-1 bg-primary text-white p-3 rounded-xl font-bold hover:bg-primary-hover transition-colors disabled:opacity-50"
                            >
                                {isLoading ? 'Adding...' : 'Add Feed'}
                            </button>
                            <button
                                onClick={() => setShowAddFeed(false)}
                                className="p-3 px-6 rounded-xl font-semibold bg-glass border border-glass-border text-text-muted hover:text-text-main transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {feedToDelete && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setFeedToDelete(null)}>
                    <div className="bg-bg-card backdrop-blur-xl border border-glass-border rounded-2xl p-8 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-2xl font-bold mb-4">Delete Feed?</h2>
                        <p className="text-text-muted mb-6">
                            Are you sure you want to delete <span className="text-white font-bold">{feedToDelete.title}</span> and all its articles? This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    deleteFeed(feedToDelete.id);
                                }}
                                className="flex-1 bg-red-500 text-white p-3 rounded-xl font-bold hover:bg-red-600 transition-colors"
                            >
                                Delete
                            </button>
                            <button
                                onClick={() => setFeedToDelete(null)}
                                className="flex-1 p-3 rounded-xl font-semibold bg-glass border border-glass-border text-text-muted hover:text-text-main transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
                {/* Feeds Sidebar */}
                <div className="col-span-3 bg-bg-card backdrop-blur-xl border border-glass-border rounded-2xl p-6 overflow-y-auto">
                    <h2 className="text-lg font-bold mb-4">Feeds</h2>
                    <div
                        onClick={() => setSelectedFeed(null)}
                        className={`p-3 rounded-xl cursor-pointer mb-2 transition-all ${!selectedFeed ? 'bg-glass border border-primary' : 'hover:bg-glass/50'
                            }`}
                    >
                        <div className="font-bold text-sm">All Articles</div>
                        <div className="text-xs text-text-muted">{stats?.total_articles || 0} articles</div>
                    </div>
                    {feeds.map((feed) => (
                        <div
                            key={feed.id}
                            className={`p-3 rounded-xl mb-2 transition-all ${selectedFeed === feed.id ? 'bg-glass border border-primary' : 'hover:bg-glass/50'
                                }`}
                        >
                            <div
                                onClick={() => setSelectedFeed(feed.id)}
                                className="cursor-pointer"
                            >
                                <div className="font-bold text-sm truncate">{feed.title}</div>
                                <div className="text-xs text-text-muted">{feed.article_count} articles</div>
                            </div>
                            <div className="flex gap-1 mt-2">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        refreshFeed(feed.id);
                                    }}
                                    className="flex-1 text-xs bg-primary/20 text-primary px-2 py-1 rounded hover:bg-primary/30 transition-colors"
                                >
                                    ↻ Refresh
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setFeedToDelete(feed);
                                    }}
                                    className="flex-1 text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded hover:bg-red-500/30 transition-colors"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                    {feeds.length === 0 && (
                        <div className="text-center text-text-muted text-sm py-8">
                            <div className="text-4xl mb-2">📰</div>
                            <p>No feeds yet</p>
                            <p className="text-xs mt-1">Add your first RSS feed to get started</p>
                        </div>
                    )}
                </div>

                {/* Articles List */}
                {!selectedArticle ? (
                    <div className="col-span-9 bg-bg-card backdrop-blur-xl border border-glass-border rounded-2xl p-6 overflow-y-auto">
                        <h2 className="text-lg font-bold mb-4">
                            {selectedFeed ? feeds.find(f => f.id === selectedFeed)?.title : 'All Articles'}
                        </h2>
                        <div className="space-y-3">
                            {articles.length === 0 && (
                                <div className="text-center text-text-muted py-12">
                                    <div className="text-6xl mb-4">📄</div>
                                    <p>No articles yet</p>
                                    <p className="text-sm mt-2">Add RSS feeds to see articles here</p>
                                </div>
                            )}
                            {articles.map((article) => (
                                <div
                                    key={article.id}
                                    onClick={() => selectArticle(article)}
                                    className="bg-glass border border-glass-border rounded-xl p-4 cursor-pointer hover:border-primary transition-all"
                                >
                                    <h3 className="font-bold text-lg mb-2">{article.title}</h3>
                                    {article.description && (
                                        <p className="text-text-muted text-sm mb-2 line-clamp-2">{article.description}</p>
                                    )}
                                    <div className="flex items-center gap-4 text-xs text-text-muted">
                                        <span>📅 {formatDate(article.published)}</span>
                                        {article.author && <span>✍️ {article.author}</span>}
                                        <a
                                            href={article.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary hover:underline"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            🔗 Read Original
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    /* Article Reader with Q&A */
                    <div className="col-span-9 bg-bg-card backdrop-blur-xl border border-glass-border rounded-2xl overflow-hidden flex flex-col">
                        {/* Article Header */}
                        <div className="p-6 border-b border-glass-border">
                            <button
                                onClick={() => setSelectedArticle(null)}
                                className="text-primary hover:underline mb-4 text-sm"
                            >
                                ← Back to Articles
                            </button>
                            <h2 className="text-2xl font-bold mb-2">{selectedArticle.title}</h2>
                            <div className="flex items-center gap-4 text-sm text-text-muted">
                                <span>📅 {formatDate(selectedArticle.published)}</span>
                                {selectedArticle.author && <span>✍️ {selectedArticle.author}</span>}
                                <a
                                    href={selectedArticle.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                >
                                    🔗 Read Original
                                </a>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Article Content */}
                            <div className="prose prose-invert max-w-none">
                                {(selectedArticle.content || selectedArticle.description) ? (
                                    <div
                                        dangerouslySetInnerHTML={{ __html: selectedArticle.content || selectedArticle.description }}
                                        className="text-text-main leading-relaxed"
                                    />
                                ) : (
                                    <p className="text-text-muted">No content available for this article.</p>
                                )}
                            </div>

                            {/* Suggested Q&A */}
                            <div className="bg-glass border border-glass-border rounded-xl p-6">
                                <h3 className="text-xl font-bold mb-4">💡 Suggested Questions & Answers</h3>
                                {isLoadingQA && (
                                    <div className="text-center text-text-muted py-8">
                                        <div className="animate-pulse">Generating insights...</div>
                                    </div>
                                )}
                                {!isLoadingQA && suggestedQA.length === 0 && (
                                    <div className="text-text-muted text-sm">No Q&A available</div>
                                )}
                                <div className="space-y-4">
                                    {suggestedQA.map((qa, idx) => (
                                        <div key={idx} className="bg-bg-dark/30 rounded-lg p-4">
                                            <div className="font-bold text-primary mb-2">Q: {qa.question}</div>
                                            <div className="text-text-muted text-sm">A: {qa.answer}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Follow-up Questions */}
                            <div className="bg-glass border border-glass-border rounded-xl p-6">
                                <h3 className="text-xl font-bold mb-4">🤔 Ask a Follow-up Question</h3>

                                {/* Q&A History */}
                                {qaHistory.length > 0 && (
                                    <div className="space-y-3 mb-4">
                                        {qaHistory.map((qa, idx) => (
                                            <div key={idx} className="space-y-2">
                                                <div className="bg-primary/20 border border-primary/30 rounded-lg p-3">
                                                    <div className="font-bold text-sm">You asked:</div>
                                                    <div className="text-sm">{qa.question}</div>
                                                </div>
                                                <div className="bg-bg-dark/30 rounded-lg p-3">
                                                    <div className="font-bold text-sm text-accent mb-1">AI answered:</div>
                                                    <div className="text-sm text-text-muted">{qa.answer}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Question Input */}
                                <div className="flex gap-3">
                                    <input
                                        type="text"
                                        placeholder="Ask anything about this article..."
                                        value={question}
                                        onChange={(e) => setQuestion(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && !isAsking && askQuestion()}
                                        disabled={isAsking}
                                        className="flex-1 bg-bg-dark/50 border border-glass-border rounded-xl p-3 text-white outline-none focus:border-primary transition-colors disabled:opacity-50"
                                    />
                                    <button
                                        onClick={askQuestion}
                                        disabled={!question.trim() || isAsking}
                                        className="bg-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-primary-hover transition-colors disabled:opacity-50"
                                    >
                                        {isAsking ? 'Asking...' : 'Ask'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
