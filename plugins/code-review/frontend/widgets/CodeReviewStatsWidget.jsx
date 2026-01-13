import React from 'react';

const CodeReviewStatsWidget = () => {
  return (
    <div className="h-full flex flex-col items-center justify-center p-4">
      <div className="text-5xl mb-2">🔍</div>
      <div className="text-2xl font-bold text-primary mb-2">Code Review</div>
      <div className="text-sm text-text-muted text-center">
        AI-powered code analysis
      </div>
      <div className="mt-4 flex gap-4">
        <div className="text-center">
          <div className="text-xl font-bold text-green-400">✓</div>
          <div className="text-xs text-text-muted">Quality</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-blue-400">🔒</div>
          <div className="text-xs text-text-muted">Security</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-purple-400">⚡</div>
          <div className="text-xs text-text-muted">Performance</div>
        </div>
      </div>
    </div>
  );
};

export default CodeReviewStatsWidget;
