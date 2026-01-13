import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../../../frontend/src/config';

function JiraStatsWidget() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIssues = async () => {
      try {
        const res = await fetch(`${API_BASE}/plugins/jira/issues`);
        const data = await res.json();
        setIssues(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to fetch Jira issues:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchIssues();
    const interval = setInterval(fetchIssues, 60000); // Refresh every minute

    return () => clearInterval(interval);
  }, []);

  const stats = {
    total: issues.length,
    byStatus: issues.reduce((acc, issue) => {
      const status = issue.status || 'Unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {}),
    byPriority: issues.reduce((acc, issue) => {
      const priority = issue.priority || 'Unknown';
      acc[priority] = (acc[priority] || 0) + 1;
      return acc;
    }, {})
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-text-muted animate-pulse">Loading stats...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="text-center mb-4">
        <p className="text-4xl font-bold">{stats.total}</p>
        <p className="text-text-muted text-sm">Total Issues</p>
      </div>

      <div className="space-y-3">
        {/* Status breakdown */}
        <div>
          <p className="text-text-muted text-xs mb-2">By Status</p>
          <div className="space-y-1">
            {Object.entries(stats.byStatus).map(([status, count]) => (
              <div key={status} className="flex justify-between items-center text-sm">
                <span className="text-text-main">{status}</span>
                <span className="font-bold text-primary">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Priority breakdown */}
        {Object.keys(stats.byPriority).length > 0 && (
          <div>
            <p className="text-text-muted text-xs mb-2">By Priority</p>
            <div className="space-y-1">
              {Object.entries(stats.byPriority).slice(0, 3).map(([priority, count]) => (
                <div key={priority} className="flex justify-between items-center text-sm">
                  <span className="text-text-main">{priority}</span>
                  <span className="font-bold text-accent">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default JiraStatsWidget;
