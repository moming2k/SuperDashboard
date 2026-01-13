import React, { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const SnippetCompactWidget = () => {
  const [snippetCount, setSnippetCount] = useState(0);
  const [recentSnippet, setRecentSnippet] = useState(null);

  useEffect(() => {
    const fetchSnippets = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/plugins/snippet-manager/snippets`);
        const data = await response.json();
        setSnippetCount(data.length);
        if (data.length > 0) {
          setRecentSnippet(data[0]);
        }
      } catch (error) {
        console.error('Failed to fetch snippets:', error);
      }
    };

    fetchSnippets();
  }, []);

  return (
    <div className="h-full flex flex-col items-center justify-center p-4">
      <div className="text-5xl mb-2">📋</div>
      <div className="text-4xl font-bold text-primary mb-2">{snippetCount}</div>
      <div className="text-sm text-text-muted text-center">
        {snippetCount === 1 ? 'Snippet' : 'Snippets'}
      </div>
      {recentSnippet && (
        <div className="mt-3 text-xs text-text-muted text-center truncate w-full px-2">
          Latest: {recentSnippet.title}
        </div>
      )}
    </div>
  );
};

export default SnippetCompactWidget;
