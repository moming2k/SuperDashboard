import React, { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const RSSDetailedWidget = () => {
  const [articles, setArticles] = useState([]);
  const [feeds, setFeeds] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [articlesRes, feedsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/plugins/rss-reader/articles`),
          fetch(`${API_BASE_URL}/plugins/rss-reader/feeds`)
        ]);

        const articlesData = await articlesRes.json();
        const feedsData = await feedsRes.json();

        setArticles(articlesData.slice(0, 8));
        setFeeds(feedsData);
      } catch (error) {
        console.error('Failed to fetch RSS data:', error);
      }
    };

    fetchData();
  }, []);

  const navigateToArticle = (articleId) => {
    window.dispatchEvent(new CustomEvent('navigate-tab', {
      detail: { tab: `rss-reader/article/${articleId}` }
    }));
  };

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
          <span>📰</span>
          <span>RSS Reader</span>
        </h3>
        <div className="flex gap-2">
          <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">
            {articles.length} articles
          </span>
          <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded">
            {feeds.length} feeds
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {articles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted text-sm">
            <div className="text-4xl mb-2">📰</div>
            <p>No articles yet</p>
            <p className="text-xs mt-1">Add RSS feeds to get started</p>
          </div>
        ) : (
          articles.map((article) => (
            <div
              key={article.id}
              onClick={() => navigateToArticle(article.id)}
              className="bg-glass rounded-lg p-3 hover:bg-glass/80 transition-all cursor-pointer"
            >
              <div className="font-semibold text-sm text-text-main mb-1 line-clamp-2">
                {article.title}
              </div>
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>{article.feed_title}</span>
                <span>{new Date(article.published_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <button
        onClick={() => window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab: 'rss-reader' } }))}
        className="mt-3 w-full bg-primary text-white py-2 rounded-lg font-semibold text-sm hover:bg-primary/80 transition-all"
      >
        Open RSS Reader
      </button>
    </div>
  );
};

export default RSSDetailedWidget;
