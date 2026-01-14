import React, { useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const CodeReviewQuickWidget = () => {
  const [code, setCode] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  const analyzeCode = async () => {
    if (!code.trim()) return;

    setAnalyzing(true);
    try {
      // Trigger navigation to the code review tab
      window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab: 'code-review' } }));
    } catch (error) {
      console.error('Failed to analyze code:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-4">
      <h3 className="text-lg font-bold mb-3 text-text-main flex items-center gap-2">
        <span>🔍</span>
        <span>Quick Review</span>
      </h3>
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Paste code to review..."
        className="flex-1 bg-glass border border-glass-border rounded-lg p-3 text-text-main text-sm font-mono resize-none focus:outline-none focus:border-primary transition-colors"
      />
      <button
        onClick={analyzeCode}
        disabled={!code.trim() || analyzing}
        className="mt-3 w-full bg-primary text-white py-2 rounded-lg font-semibold text-sm hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {analyzing ? 'Analyzing...' : 'Analyze Code'}
      </button>
    </div>
  );
};

export default CodeReviewQuickWidget;
