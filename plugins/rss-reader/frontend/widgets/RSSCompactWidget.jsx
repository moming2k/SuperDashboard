import React, { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const RSSCompactWidget = () => {
  const [articleCount, setArticleCount] = useState(0);
  const [feedCount, setFeedCount] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const feedsResponse = await fetch(`${API_BASE_URL}/plugins/rss-reader/feeds`);
        const feedsData = await feedsResponse.json();
        setFeedCount(feedsData.length);

        const articlesResponse = await fetch(`${API_BASE_URL}/plugins/rss-reader/articles`);
        const articlesData = await articlesResponse.json();
        setArticleCount(articlesData.length);
      } catch (error) {
        console.error('Failed to fetch RSS stats:', error);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="h-full flex flex-col items-center justify-center p-4">
      <div className="text-5xl mb-2">📰</div>
      <div className="flex gap-4 mt-2">
        <div className="text-center">
          <div className="text-2xl font-bold text-primary">{articleCount}</div>
          <div className="text-xs text-text-muted">Articles</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-accent">{feedCount}</div>
          <div className="text-xs text-text-muted">Feeds</div>
        </div>
      </div>
    </div>
  );
};

export default RSSCompactWidget;
