import React, { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const RSSArticlesWidget = () => {
  const [articles, setArticles] = useState([]);

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/plugins/rss-reader/articles`);
        const data = await response.json();
        setArticles(data.slice(0, 5));
      } catch (error) {
        console.error('Failed to fetch articles:', error);
      }
    };

    fetchArticles();
  }, []);

  const navigateToArticle = (articleId) => {
    window.dispatchEvent(new CustomEvent('navigate-tab', {
      detail: { tab: `rss-reader/article/${articleId}` }
    }));
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto space-y-2 p-4">
        {articles.length === 0 ? (
          <div className="text-text-muted text-sm text-center py-4">
            No articles yet
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
              <div className="text-xs text-text-muted">{article.feed_title}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RSSArticlesWidget;
