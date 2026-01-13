import React from 'react';

const CodeReviewDetailedWidget = () => {
  const features = [
    { icon: '🔍', title: 'Code Analysis', desc: 'Deep code inspection' },
    { icon: '🔒', title: 'Security Scan', desc: 'Vulnerability detection' },
    { icon: '⚡', title: 'Performance', desc: 'Optimization tips' },
    { icon: '📝', title: 'Best Practices', desc: 'Code quality checks' },
    { icon: '🐛', title: 'Bug Detection', desc: 'Find potential issues' },
    { icon: '📊', title: 'Metrics', desc: 'Code complexity analysis' }
  ];

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      <div className="text-center mb-4">
        <div className="text-5xl mb-2">🔍</div>
        <h3 className="text-xl font-bold text-text-main">AI Code Review</h3>
        <p className="text-sm text-text-muted">GPT-4 powered analysis</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-3">
          {features.map((feature, index) => (
            <div key={index} className="bg-glass rounded-lg p-3 hover:bg-glass/80 transition-all">
              <div className="text-2xl mb-2">{feature.icon}</div>
              <div className="text-sm font-semibold text-text-main mb-1">{feature.title}</div>
              <div className="text-xs text-text-muted">{feature.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab: 'code-review' } }))}
        className="mt-4 w-full bg-primary text-white py-2 rounded-lg font-semibold text-sm hover:bg-primary/80 transition-all"
      >
        Open Code Review
      </button>
    </div>
  );
};

export default CodeReviewDetailedWidget;
