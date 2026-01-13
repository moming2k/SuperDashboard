import React, { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const SnippetListWidget = () => {
  const [snippets, setSnippets] = useState([]);

  useEffect(() => {
    const fetchSnippets = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/plugins/snippet-manager/snippets`);
        const data = await response.json();
        setSnippets(data.slice(0, 5));
      } catch (error) {
        console.error('Failed to fetch snippets:', error);
      }
    };

    fetchSnippets();
  }, []);

  const copyToClipboard = (code) => {
    navigator.clipboard.writeText(code);
  };

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      <h3 className="text-lg font-bold mb-3 text-text-main flex items-center gap-2">
        <span>📋</span>
        <span>Recent Snippets</span>
      </h3>
      <div className="flex-1 overflow-y-auto space-y-2">
        {snippets.length === 0 ? (
          <div className="text-text-muted text-sm text-center py-4">
            No snippets yet
          </div>
        ) : (
          snippets.map((snippet) => (
            <div
              key={snippet.id}
              className="bg-glass rounded-lg p-3 hover:bg-glass/80 transition-all cursor-pointer group"
              onClick={() => copyToClipboard(snippet.code)}
            >
              <div className="flex items-start justify-between mb-1">
                <span className="font-semibold text-sm text-text-main truncate flex-1">
                  {snippet.title}
                </span>
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                  Copy
                </span>
              </div>
              <span className="text-xs text-text-muted">{snippet.language}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SnippetListWidget;
