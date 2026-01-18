import React, { useState, useEffect, useRef } from 'react';

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
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [lastSelectedIndex, setLastSelectedIndex] = useState(null); // Track position in list for keyboard nav
    const [qaLanguage, setQaLanguage] = useState('Traditional Chinese');
    const [filterMode, setFilterMode] = useState('unread'); // 'unread', 'read', 'all', 'starred'
    const [toast, setToast] = useState(null); // For notifications
    const loadMoreRef = useRef(null);
    const articleListRef = useRef(null);
    const articleContentRef = useRef(null);

    // Show toast notification
    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    // Load article from URL hash on mount
    useEffect(() => {
        const hash = window.location.hash;
        const articleMatch = hash.match(/#rss-reader\/article\/([^/]+)/);
        if (articleMatch) {
            const articleId = articleMatch[1];
            loadArticleById(articleId);
        }
    }, []);

    // Handle browser back/forward navigation
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash;
            const articleMatch = hash.match(/#rss-reader\/article\/([^/]+)/);
            if (articleMatch) {
                const articleId = articleMatch[1];
                loadArticleById(articleId);
            } else if (hash === '#rss-reader') {
                setSelectedArticle(null);
            }
        };

        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyPress = (e) => {
            // Ignore if user is typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if (selectedArticle) {
                // In reading mode
                if (e.key === 'Escape') {
                    e.preventDefault();
                    setSelectedArticle(null);
                    window.location.hash = 'rss-reader';
                } else if (e.key === 'j') {
                    e.preventDefault();
                    navigateToPrevArticle();
                } else if (e.key === 'k') {
                    e.preventDefault();
                    navigateToNextArticle();
                } else if (e.key === 's') {
                    e.preventDefault();
                    toggleStar(selectedArticle.id);
                } else if (e.key === 'm') {
                    e.preventDefault();
                    toggleRead(selectedArticle.id);
                } else if (e.key === 'u') {
                    e.preventDefault();
                    // Scroll up by one viewport height
                    if (articleContentRef.current) {
                        articleContentRef.current.scrollBy({
                            top: -window.innerHeight * 0.8,
                            behavior: 'smooth'
                        });
                    }
                }
            } else {
                // In list mode - navigate through article list
                if (e.key === 'j') {
                    e.preventDefault();
                    // Move to previous article in list
                    if (articles.length > 0) {
                        // Find current selected or start from beginning
                        const currentIndex = lastSelectedIndex !== null ? lastSelectedIndex : -1;
                        const prevIndex = currentIndex - 1;
                        if (prevIndex >= 0) {
                            const article = articles[prevIndex];
                            selectArticle(article);
                            setLastSelectedIndex(prevIndex);
                        }
                    }
                } else if (e.key === 'k') {
                    e.preventDefault();
                    // Move to next article in list
                    if (articles.length > 0) {
                        const currentIndex = lastSelectedIndex !== null ? lastSelectedIndex : -1;
                        const nextIndex = currentIndex + 1;
                        if (nextIndex < articles.length) {
                            const article = articles[nextIndex];
                            selectArticle(article);
                            setLastSelectedIndex(nextIndex);
                        }
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [selectedArticle, articles]);

    useEffect(() => {
        fetchFeeds();
        fetchArticles(true); // Reset on mount
        fetchStats();

        // Poll for new articles every 60 seconds
        const interval = setInterval(() => {
            fetchArticlesQuietly(); // Fetch without resetting to check for new articles
        }, 60000);

        return () => clearInterval(interval);
    }, [selectedFeed, filterMode]);

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

    const fetchArticles = async (reset = false) => {
        const currentOffset = reset ? 0 : offset;

        if (!reset && !hasMore) return;
        if (!reset && isLoadingMore) return;

        if (!reset) setIsLoadingMore(true);

        try {
            let url = `${API_BASE}/plugins/rss-reader/articles?limit=50&offset=${currentOffset}`;
            if (selectedFeed) {
                url += `&feed_id=${selectedFeed}`;
            }
            if (filterMode && filterMode !== 'all') {
                url += `&filter_read=${filterMode}`;
            }

            const res = await fetch(url);
            if (!res.ok) {
                console.error("Failed to fetch articles:", res.status);
                if (reset) setArticles([]);
                return;
            }
            const data = await res.json();

            if (reset) {
                setArticles(data.articles || []);
                setOffset(data.articles?.length || 0);
            } else {
                // Deduplicate articles by ID to prevent React key conflicts
                setArticles(prev => {
                    const existingIds = new Set(prev.map(a => a.id));
                    const newArticles = (data.articles || []).filter(a => !existingIds.has(a.id));
                    return [...prev, ...newArticles];
                });
                setOffset(prev => prev + (data.articles?.length || 0));
            }

            setHasMore(data.has_more || false);
        } catch (e) {
            console.error("Failed to fetch articles", e);
            if (reset) setArticles([]);
        } finally {
            if (!reset) setIsLoadingMore(false);
        }
    };

    // Fetch articles quietly in the background to check for new articles
    const fetchArticlesQuietly = async () => {
        try {
            let url = `${API_BASE}/plugins/rss-reader/articles?limit=50&offset=0`;
            if (selectedFeed) {
                url += `&feed_id=${selectedFeed}`;
            }
            if (filterMode && filterMode !== 'all') {
                url += `&filter_read=${filterMode}`;
            }

            const res = await fetch(url);
            if (!res.ok) return;

            const data = await res.json();
            const newArticles = data.articles || [];

            // Check if there are new articles
            if (newArticles.length > 0 && articles.length > 0) {
                const latestNewArticleId = newArticles[0].id;
                const latestCurrentArticleId = articles[0].id;

                if (latestNewArticleId !== latestCurrentArticleId) {
                    // New articles detected, refresh the list
                    setArticles(newArticles);
                    setOffset(newArticles.length);
                    setHasMore(data.has_more || false);
                    await fetchStats();
                    showToast('New articles available!', 'info');
                }
            }
        } catch (e) {
            console.error("Failed to fetch articles quietly", e);
        }
    };

    // Intersection Observer for infinite scroll
    useEffect(() => {
        if (!loadMoreRef.current) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
                    fetchArticles(false);
                }
            },
            { threshold: 0.1 }
        );

        observer.observe(loadMoreRef.current);

        return () => observer.disconnect();
    }, [hasMore, isLoadingMore, offset, selectedFeed, filterMode]);

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
            await fetchArticles(true);
            await fetchStats();
            showToast('Feed added successfully!');
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
                await fetchArticles(true);
                await fetchStats();
                if (selectedFeed === feedId) {
                    setSelectedFeed(null);
                }
                setFeedToDelete(null);
                showToast('Feed deleted successfully!');
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
                showToast(`Refreshed! Found ${data.new_articles} new articles.`);
                await fetchFeeds();
                await fetchArticles(true);
                await fetchStats();
            }
        } catch (e) {
            console.error("Failed to refresh feed", e);
        }
    };

    const toggleRead = async (articleId) => {
        try {
            const res = await fetch(`${API_BASE}/plugins/rss-reader/articles/${articleId}/read`, {
                method: 'POST'
            });

            if (res.ok) {
                const data = await res.json();
                // Update local state
                setArticles(prev => prev.map(a =>
                    a.id === articleId ? { ...a, is_read: data.is_read, read_at: data.read_at } : a
                ));
                if (selectedArticle?.id === articleId) {
                    setSelectedArticle(prev => ({ ...prev, is_read: data.is_read, read_at: data.read_at }));
                }
                await fetchStats();
                showToast(data.is_read ? 'Marked as read' : 'Marked as unread');
            }
        } catch (e) {
            console.error("Failed to toggle read status", e);
        }
    };

    const toggleStar = async (articleId) => {
        try {
            const res = await fetch(`${API_BASE}/plugins/rss-reader/articles/${articleId}/star`, {
                method: 'POST'
            });

            if (res.ok) {
                const data = await res.json();
                // Update local state
                setArticles(prev => prev.map(a =>
                    a.id === articleId ? { ...a, is_starred: data.is_starred } : a
                ));
                if (selectedArticle?.id === articleId) {
                    setSelectedArticle(prev => ({ ...prev, is_starred: data.is_starred }));
                }
                await fetchStats();
                showToast(data.is_starred ? 'Article starred ⭐' : 'Star removed');
            }
        } catch (e) {
            console.error("Failed to toggle star", e);
        }
    };

    const loadArticleById = async (articleId) => {
        try {
            const res = await fetch(`${API_BASE}/plugins/rss-reader/articles/${articleId}`);
            if (!res.ok) {
                console.error("Failed to load article:", res.status);
                return;
            }
            const article = await res.json();
            await selectArticle(article, false); // Don't update URL when loading from URL
        } catch (e) {
            console.error("Failed to load article by ID", e);
        }
    };

    const selectArticle = async (article, updateUrl = true) => {
        setSelectedArticle(article);
        setQAHistory([]);
        setSuggestedQA([]);

        // Track the index for keyboard navigation
        const index = articles.findIndex(a => a.id === article.id);
        if (index !== -1) {
            setLastSelectedIndex(index);
        }

        // Scroll to top of article content
        if (articleContentRef.current) {
            articleContentRef.current.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }

        // Update URL hash with article ID
        if (updateUrl) {
            window.location.hash = `rss-reader/article/${article.id}`;
        }

        // Auto-mark as read when opening
        if (!article.is_read) {
            await toggleRead(article.id);
        }
    };

    const navigateToNextArticle = () => {
        const currentIndex = articles.findIndex(a => a.id === selectedArticle?.id);
        if (currentIndex !== -1 && currentIndex < articles.length - 1) {
            selectArticle(articles[currentIndex + 1]);
            setLastSelectedIndex(currentIndex + 1);
        }
    };

    const navigateToPrevArticle = () => {
        const currentIndex = articles.findIndex(a => a.id === selectedArticle?.id);
        if (currentIndex > 0) {
            selectArticle(articles[currentIndex - 1]);
            setLastSelectedIndex(currentIndex - 1);
        }
    };

    const generateQA = async () => {
        if (!selectedArticle) return;

        setIsLoadingQA(true);
        try {
            const res = await fetch(`${API_BASE}/plugins/rss-reader/articles/${selectedArticle.id}/qa?language=${encodeURIComponent(qaLanguage)}&regenerate=true`);
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

    const getFilterLabel = () => {
        switch (filterMode) {
            case 'unread': return `Unread (${stats?.unread_articles || 0})`;
            case 'read': return 'Read';
            case 'starred': return `Starred (${stats?.starred_articles || 0})`;
            case 'all': return 'All Articles';
            default: return 'All Articles';
        }
    };

    return (
        <div className="animate-fade h-full flex flex-col">
            {/* Toast Notification */}
            {toast && (
                <div className="fixed top-4 right-4 z-50 animate-fade">
                    <div className={`${toast.type === 'success' ? 'bg-green-500/90' : 'bg-blue-500/90'
                        } text-white px-6 py-3 rounded-xl shadow-2xl backdrop-blur-xl`}>
                        {toast.message}
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold">RSS Reader 📰</h1>
                    {stats && (
                        <p className="text-text-muted text-sm mt-1">
                            {stats.total_feeds} feeds · {stats.total_articles} articles · {stats.unread_articles} unread
                        </p>
                    )}
                </div>
                <div className="flex gap-3 items-center">
                    {/* Filter Dropdown */}
                    <select
                        value={filterMode}
                        onChange={(e) => {
                            setFilterMode(e.target.value);
                            setOffset(0);
                            setHasMore(true);
                        }}
                        className="bg-bg-dark/50 border border-glass-border rounded-lg px-4 py-2 text-white outline-none focus:border-primary transition-colors font-semibold"
                    >
                        <option value="unread">📬 Unread</option>
                        <option value="all">📚 All Articles</option>
                        <option value="read">✅ Read</option>
                        <option value="starred">⭐ Starred</option>
                    </select>
                    <button
                        onClick={() => setShowAddFeed(true)}
                        className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-hover transition-colors font-semibold"
                    >
                        + Add Feed
                    </button>
                </div>
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
                        onClick={() => {
                            setSelectedFeed(null);
                            setOffset(0);
                            setHasMore(true);
                        }}
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
                                onClick={() => {
                                    setSelectedFeed(feed.id);
                                    setOffset(0);
                                    setHasMore(true);
                                }}
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
                    <div className="col-span-9 bg-bg-card backdrop-blur-xl border border-glass-border rounded-2xl p-6 overflow-y-auto" ref={articleListRef}>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold">
                                {getFilterLabel()}
                            </h2>
                        </div>
                        <div className="space-y-3">
                            {articles.length === 0 && (
                                <div className="text-center text-text-muted py-12">
                                    <div className="text-6xl mb-4">📄</div>
                                    <p>No articles {filterMode === 'unread' ? 'unread' : filterMode === 'starred' ? 'starred' : ''}</p>
                                    <p className="text-sm mt-2">
                                        {filterMode === 'unread' ? 'All caught up! 🎉' : 'Add RSS feeds to see articles here'}
                                    </p>
                                </div>
                            )}
                            {articles.map((article) => (
                                <div
                                    key={article.id}
                                    onClick={() => selectArticle(article)}
                                    className={`bg-glass border border-glass-border rounded-xl p-4 cursor-pointer hover:border-primary transition-all relative ${article.is_read ? 'opacity-50' : 'opacity-100'
                                        }`}
                                >
                                    {article.is_starred && (
                                        <div className="absolute top-3 right-3 text-xl">⭐</div>
                                    )}
                                    <h3 className="font-bold text-lg mb-2 pr-8">{article.title}</h3>
                                    {article.description && (
                                        <p className="text-text-muted text-sm mb-2 line-clamp-2">{article.description}</p>
                                    )}
                                    <div className="flex items-center gap-4 text-xs text-text-muted flex-wrap">
                                        <span>📅 {formatDate(article.published)}</span>
                                        {article.author && <span>✍️ {article.author}</span>}
                                        <a
                                            href={article.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary hover:underline"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            🔗 Original
                                        </a>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleStar(article.id);
                                            }}
                                            className="text-text-muted hover:text-yellow-400 transition-colors"
                                        >
                                            {article.is_starred ? '⭐' : '☆'}
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleRead(article.id);
                                            }}
                                            className="text-text-muted hover:text-primary transition-colors"
                                        >
                                            {article.is_read ? '✓ Read' : '○ Unread'}
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {/* Load More Trigger */}
                            {hasMore && (
                                <div ref={loadMoreRef} className="py-8 text-center">
                                    {isLoadingMore ? (
                                        <div className="text-text-muted">
                                            <div className="animate-pulse">Loading more articles...</div>
                                        </div>
                                    ) : (
                                        <div className="text-text-muted text-sm">Scroll for more</div>
                                    )}
                                </div>
                            )}

                            {!hasMore && articles.length > 0 && (
                                <div className="py-8 text-center text-text-muted text-sm">
                                    {articles.length >= 200 ? 'Showing first 200 articles' : 'No more articles'}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Article Reader with Q&A */
                    <div className="col-span-9 bg-bg-card backdrop-blur-xl border border-glass-border rounded-2xl overflow-hidden flex flex-col">
                        {/* Article Header */}
                        <div className="p-6 border-b border-glass-border">
                            <div className="flex items-center justify-between mb-4">
                                <button
                                    onClick={() => {
                                        setSelectedArticle(null);
                                        window.location.hash = 'rss-reader';
                                    }}
                                    className="text-primary hover:underline text-sm"
                                >
                                    ← Back to Articles
                                </button>
                                <div className="flex gap-2 text-sm">
                                    <span className="text-text-muted">Navigate:</span>
                                    <kbd className="px-2 py-1 bg-glass rounded text-xs">J</kbd>
                                    <kbd className="px-2 py-1 bg-glass rounded text-xs">K</kbd>
                                    <span className="text-text-muted">Star:</span>
                                    <kbd className="px-2 py-1 bg-glass rounded text-xs">S</kbd>
                                    <span className="text-text-muted">Read:</span>
                                    <kbd className="px-2 py-1 bg-glass rounded text-xs">M</kbd>
                                    <span className="text-text-muted">Scroll:</span>
                                    <kbd className="px-2 py-1 bg-glass rounded text-xs">U</kbd>
                                    <kbd className="px-2 py-1 bg-glass rounded text-xs">Space</kbd>
                                </div>
                            </div>
                            <h2 className="text-3xl font-bold mb-3 leading-tight">{selectedArticle.title}</h2>
                            <div className="flex items-center gap-4 text-sm text-text-muted flex-wrap">
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
                                <button
                                    onClick={() => toggleStar(selectedArticle.id)}
                                    className={`px-3 py-1 rounded-lg transition-colors ${selectedArticle.is_starred
                                        ? 'bg-yellow-500/20 text-yellow-400'
                                        : 'bg-glass text-text-muted hover:text-yellow-400'
                                        }`}
                                >
                                    {selectedArticle.is_starred ? '⭐ Starred' : '☆ Star'}
                                </button>
                                <button
                                    onClick={() => toggleRead(selectedArticle.id)}
                                    className={`px-3 py-1 rounded-lg transition-colors ${selectedArticle.is_read
                                        ? 'bg-green-500/20 text-green-400'
                                        : 'bg-glass text-text-muted hover:text-primary'
                                        }`}
                                >
                                    {selectedArticle.is_read ? '✓ Read' : '○ Mark Unread'}
                                </button>
                            </div>

                            {/* Navigation Arrows */}
                            <div className="flex gap-2 mt-4">
                                <button
                                    onClick={navigateToPrevArticle}
                                    disabled={articles.findIndex(a => a.id === selectedArticle.id) === 0}
                                    className="flex-1 bg-glass border border-glass-border text-text-main px-4 py-2 rounded-lg hover:border-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    ← Previous Article
                                </button>
                                <button
                                    onClick={navigateToNextArticle}
                                    disabled={articles.findIndex(a => a.id === selectedArticle.id) === articles.length - 1}
                                    className="flex-1 bg-glass border border-glass-border text-text-main px-4 py-2 rounded-lg hover:border-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    Next Article →
                                </button>
                            </div>
                        </div>

                        <div ref={articleContentRef} className="flex-1 overflow-y-auto p-8 space-y-8">
                            {/* Article Content */}
                            <div className="prose prose-lg prose-invert max-w-none">
                                {(selectedArticle.content || selectedArticle.description) ? (
                                    <div
                                        dangerouslySetInnerHTML={{ __html: selectedArticle.content || selectedArticle.description }}
                                        className="text-text-main leading-relaxed text-base"
                                        style={{
                                            lineHeight: '1.8',
                                            fontSize: '1.05rem'
                                        }}
                                    />
                                ) : (
                                    <p className="text-text-muted">No content available for this article.</p>
                                )}
                                <style>{`
                                    .prose img {
                                        max-width: 400px;
                                        height: auto;
                                        float: left;
                                        margin: 0 1.5rem 1rem 0;
                                        border-radius: 8px;
                                    }
                                    .prose p {
                                        clear: none;
                                    }
                                    .prose::after {
                                        content: "";
                                        display: table;
                                        clear: both;
                                    }
                                `}</style>
                            </div>

                            {/* Suggested Q&A */}
                            <div className="bg-glass border border-glass-border rounded-xl p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xl font-bold">💡 Suggested Questions & Answers</h3>
                                    <div className="flex items-center gap-3">
                                        <select
                                            value={qaLanguage}
                                            onChange={(e) => setQaLanguage(e.target.value)}
                                            className="bg-bg-dark/50 border border-glass-border rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-primary transition-colors"
                                        >
                                            <option value="Traditional Chinese">繁體中文</option>
                                            <option value="English">English</option>
                                            <option value="Simplified Chinese">简体中文</option>
                                            <option value="Japanese">日本語</option>
                                        </select>
                                        <button
                                            onClick={generateQA}
                                            disabled={isLoadingQA}
                                            className="text-xs bg-primary/20 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/30 transition-colors disabled:opacity-50"
                                        >
                                            {suggestedQA.length > 0 ? '🔄 Regenerate' : '✨ Generate'}
                                        </button>
                                    </div>
                                </div>
                                {isLoadingQA && (
                                    <div className="text-center text-text-muted py-8">
                                        <div className="animate-pulse">Generating insights...</div>
                                    </div>
                                )}
                                {!isLoadingQA && suggestedQA.length === 0 && (
                                    <div className="text-center text-text-muted py-8">
                                        <div className="text-4xl mb-3">💡</div>
                                        <p className="text-sm">Click "Generate" to create AI-powered questions and answers</p>
                                    </div>
                                )}
                                <div className="space-y-4">
                                    {suggestedQA.map((qa, idx) => (
                                        <div key={idx} className="bg-bg-dark/30 rounded-lg p-4">
                                            <div className="font-bold text-primary mb-2">Q: {qa.question}</div>
                                            <div className="text-text-muted text-sm leading-relaxed">A: {qa.answer}</div>
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
                                                    <div className="text-sm text-text-muted leading-relaxed">{qa.answer}</div>
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
