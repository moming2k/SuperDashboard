import React, { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const SnippetDetailedWidget = () => {
  const [snippets, setSnippets] = useState([]);
  const [selectedSnippet, setSelectedSnippet] = useState(null);

  useEffect(() => {
    const fetchSnippets = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/plugins/snippet-manager/snippets`);
        const data = await response.json();
        setSnippets(data.slice(0, 8));
        if (data.length > 0) {
          setSelectedSnippet(data[0]);
        }
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
    <div className="h-full flex p-4 gap-3 overflow-hidden">
      <div className="w-1/3 flex flex-col overflow-hidden">
        <h3 className="text-sm font-bold mb-2 text-text-main">Snippets</h3>
        <div className="flex-1 overflow-y-auto space-y-1">
          {snippets.length === 0 ? (
            <div className="text-text-muted text-xs text-center py-4">
              No snippets
            </div>
          ) : (
            snippets.map((snippet) => (
              <div
                key={snippet.id}
                onClick={() => setSelectedSnippet(snippet)}
                className={`p-2 rounded-lg cursor-pointer transition-all text-xs ${
                  selectedSnippet?.id === snippet.id
                    ? 'bg-primary/20 border border-primary/50'
                    : 'bg-glass hover:bg-glass/80'
                }`}
              >
                <div className="font-semibold text-text-main truncate">{snippet.title}</div>
                <div className="text-text-muted text-xs">{snippet.language}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedSnippet ? (
          <>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-text-main truncate">{selectedSnippet.title}</h3>
              <button
                onClick={() => copyToClipboard(selectedSnippet.code)}
                className="text-xs bg-primary/20 text-primary px-3 py-1 rounded-lg hover:bg-primary/30 transition-all"
              >
                Copy
              </button>
            </div>
            <div className="flex-1 bg-glass rounded-lg p-3 overflow-auto">
              <pre className="text-xs text-text-main font-mono whitespace-pre-wrap">
                {selectedSnippet.code}
              </pre>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
            Select a snippet
          </div>
        )}
      </div>
    </div>
  );
};

export default SnippetDetailedWidget;
