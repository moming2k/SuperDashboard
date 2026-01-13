import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../../../frontend/src/config';

function JiraRecentIssuesWidget() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIssues = async () => {
      try {
        const res = await fetch(`${API_BASE}/plugins/jira/issues`);
        const data = await res.json();
        setIssues(Array.isArray(data) ? data.slice(0, 5) : []);
      } catch (error) {
        console.error('Failed to fetch Jira issues:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchIssues();
    const interval = setInterval(fetchIssues, 60000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower.includes('done') || statusLower.includes('closed')) return 'text-green-400';
    if (statusLower.includes('progress')) return 'text-blue-400';
    return 'text-yellow-400';
  };

  const getPriorityIcon = (priority) => {
    const priorityLower = priority?.toLowerCase() || '';
    if (priorityLower.includes('highest') || priorityLower.includes('critical')) return '🔴';
    if (priorityLower.includes('high')) return '🟠';
    if (priorityLower.includes('medium')) return '🟡';
    if (priorityLower.includes('low')) return '🟢';
    return '⚪';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-text-muted animate-pulse">Loading issues...</p>
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <p className="text-4xl mb-2">🏷️</p>
        <p className="text-text-muted">No recent issues found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="space-y-2">
        {issues.map((issue) => (
          <div
            key={issue.key}
            className="bg-glass border border-glass-border rounded-lg p-3 hover:border-primary transition-colors cursor-pointer"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('navigate-tab', { detail: { tab: 'jira' } }));
            }}
          >
            <div className="flex items-start gap-2">
              <span className="text-lg">{getPriorityIcon(issue.priority)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-primary">{issue.key}</span>
                  <span className={`text-xs font-semibold ${getStatusColor(issue.status)}`}>
                    {issue.status}
                  </span>
                </div>
                <p className="text-sm text-text-main line-clamp-2">{issue.summary}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default JiraRecentIssuesWidget;
