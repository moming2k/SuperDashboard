import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../config';

function NotificationCenter() {
  const [notifications, setNotifications] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('notifications');
  const [filters, setFilters] = useState({
    status: '',
    source: '',
    priority: '',
    type: ''
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const [showCreateRule, setShowCreateRule] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    description: '',
    enabled: true,
    conditions: [],
    actions: {}
  });

  useEffect(() => {
    fetchNotifications();
    fetchRules();
    fetchUnreadCount();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(() => {
      fetchNotifications();
      fetchUnreadCount();
    }, 30000);
    return () => clearInterval(interval);
  }, [filters]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.source) queryParams.append('source', filters.source);
      if (filters.priority) queryParams.append('priority', filters.priority);
      if (filters.type) queryParams.append('type', filters.type);

      const res = await fetch(`${API_BASE}/plugins/notification-center/notifications?${queryParams}`);
      const data = await res.json();
      setNotifications(data);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRules = async () => {
    try {
      const res = await fetch(`${API_BASE}/plugins/notification-center/rules`);
      const data = await res.json();
      setRules(data);
    } catch (error) {
      console.error('Failed to fetch rules:', error);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const res = await fetch(`${API_BASE}/plugins/notification-center/notifications/unread-count`);
      const data = await res.json();
      setUnreadCount(data.count);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await fetch(`${API_BASE}/plugins/notification-center/notifications/${notificationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'read' })
      });
      fetchNotifications();
      fetchUnreadCount();
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await fetch(`${API_BASE}/plugins/notification-center/notifications/${notificationId}`, {
        method: 'DELETE'
      });
      fetchNotifications();
      fetchUnreadCount();
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const markAllRead = async () => {
    try {
      await fetch(`${API_BASE}/plugins/notification-center/notifications/mark-all-read`, {
        method: 'POST'
      });
      fetchNotifications();
      fetchUnreadCount();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const clearRead = async () => {
    try {
      await fetch(`${API_BASE}/plugins/notification-center/notifications/clear-read`, {
        method: 'POST'
      });
      fetchNotifications();
      fetchUnreadCount();
    } catch (error) {
      console.error('Failed to clear read notifications:', error);
    }
  };

  const createRule = async () => {
    try {
      await fetch(`${API_BASE}/plugins/notification-center/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRule)
      });
      setShowCreateRule(false);
      setNewRule({ name: '', description: '', enabled: true, conditions: [], actions: {} });
      fetchRules();
    } catch (error) {
      console.error('Failed to create rule:', error);
    }
  };

  const toggleRule = async (ruleId, currentEnabled) => {
    try {
      const rule = rules.find(r => r.id === ruleId);
      await fetch(`${API_BASE}/plugins/notification-center/rules/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...rule, enabled: !currentEnabled })
      });
      fetchRules();
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  };

  const deleteRule = async (ruleId) => {
    try {
      await fetch(`${API_BASE}/plugins/notification-center/rules/${ruleId}`, {
        method: 'DELETE'
      });
      fetchRules();
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return 'text-red-500';
      case 'high': return 'text-orange-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '⚪';
      default: return '⚪';
    }
  };

  const getSourceIcon = (source) => {
    switch (source) {
      case 'jira': return '🎫';
      case 'bitbucket': return '📦';
      case 'system': return '⚙️';
      default: return '📬';
    }
  };

  const getTypeLabel = (type) => {
    const labels = {
      pr_review: 'PR Review',
      ticket_assignment: 'Ticket Assignment',
      ticket_comment: 'Comment',
      ticket_status_change: 'Status Change',
      pr_comment: 'PR Comment',
      pr_merged: 'PR Merged',
      custom: 'Custom'
    };
    return labels[type] || type;
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            🔔 Notification Center
          </h1>
          <p className="text-text-muted">
            Unified hub for all your notifications
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary text-white">
                {unreadCount} unread
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={markAllRead}
            className="bg-glass backdrop-blur-xl border border-glass-border text-text-main px-4 py-2 rounded-xl hover:border-primary transition-all"
          >
            ✓ Mark All Read
          </button>
          <button
            onClick={clearRead}
            className="bg-glass backdrop-blur-xl border border-glass-border text-text-main px-4 py-2 rounded-xl hover:border-red-500 transition-all"
          >
            🗑️ Clear Read
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-glass-border">
        <button
          onClick={() => setActiveTab('notifications')}
          className={`px-4 py-2 font-semibold transition-all ${
            activeTab === 'notifications'
              ? 'text-primary border-b-2 border-primary'
              : 'text-text-muted hover:text-text-main'
          }`}
        >
          Notifications
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`px-4 py-2 font-semibold transition-all ${
            activeTab === 'rules'
              ? 'text-primary border-b-2 border-primary'
              : 'text-text-muted hover:text-text-main'
          }`}
        >
          Rules
        </button>
      </div>

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <>
          {/* Filters */}
          <div className="bg-glass backdrop-blur-xl border border-glass-border rounded-2xl p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Filters</h3>
            <div className="grid grid-cols-4 gap-4">
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="bg-bg-dark border border-glass-border rounded-xl px-3 py-2 text-text-main"
              >
                <option value="">All Status</option>
                <option value="unread">Unread</option>
                <option value="read">Read</option>
                <option value="archived">Archived</option>
              </select>
              <select
                value={filters.source}
                onChange={(e) => setFilters({ ...filters, source: e.target.value })}
                className="bg-bg-dark border border-glass-border rounded-xl px-3 py-2 text-text-main"
              >
                <option value="">All Sources</option>
                <option value="jira">Jira</option>
                <option value="bitbucket">BitBucket</option>
                <option value="system">System</option>
                <option value="custom">Custom</option>
              </select>
              <select
                value={filters.priority}
                onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                className="bg-bg-dark border border-glass-border rounded-xl px-3 py-2 text-text-main"
              >
                <option value="">All Priorities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="bg-bg-dark border border-glass-border rounded-xl px-3 py-2 text-text-main"
              >
                <option value="">All Types</option>
                <option value="pr_review">PR Review</option>
                <option value="ticket_assignment">Ticket Assignment</option>
                <option value="ticket_comment">Comment</option>
                <option value="pr_merged">PR Merged</option>
              </select>
            </div>
          </div>

          {/* Notifications List */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="bg-glass backdrop-blur-xl border border-glass-border rounded-2xl p-12 text-center">
              <p className="text-text-muted text-lg">No notifications found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`bg-glass backdrop-blur-xl border rounded-2xl p-6 transition-all hover:border-primary ${
                    notification.status === 'unread'
                      ? 'border-primary bg-opacity-80'
                      : 'border-glass-border'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{getSourceIcon(notification.source)}</span>
                        <span className="text-xs px-2 py-1 bg-bg-dark rounded-full text-text-muted">
                          {notification.source}
                        </span>
                        <span className="text-xs px-2 py-1 bg-bg-dark rounded-full text-text-muted">
                          {getTypeLabel(notification.type)}
                        </span>
                        <span className={`text-lg ${getPriorityColor(notification.priority)}`}>
                          {getPriorityIcon(notification.priority)}
                        </span>
                        {notification.status === 'unread' && (
                          <span className="w-2 h-2 bg-primary rounded-full"></span>
                        )}
                      </div>
                      <h3 className="text-xl font-semibold mb-1">{notification.title}</h3>
                      {notification.description && (
                        <p className="text-text-muted mb-2">{notification.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-text-muted">
                        <span>{new Date(notification.created_at).toLocaleString()}</span>
                        {notification.url && (
                          <a
                            href={notification.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            View →
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      {notification.status === 'unread' && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="px-3 py-1 bg-primary text-white rounded-lg hover:bg-primary-hover transition-all text-sm"
                        >
                          ✓
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all text-sm"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <>
          <div className="mb-6">
            <button
              onClick={() => setShowCreateRule(true)}
              className="bg-primary text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-hover transition-all"
            >
              + Create Rule
            </button>
          </div>

          {/* Create Rule Form */}
          {showCreateRule && (
            <div className="bg-glass backdrop-blur-xl border border-glass-border rounded-2xl p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">Create New Rule</h3>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Rule Name"
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  className="w-full bg-bg-dark border border-glass-border rounded-xl px-4 py-2 text-text-main"
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={newRule.description}
                  onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                  className="w-full bg-bg-dark border border-glass-border rounded-xl px-4 py-2 text-text-main"
                />
                <div className="flex gap-2">
                  <button
                    onClick={createRule}
                    className="bg-primary text-white px-4 py-2 rounded-xl hover:bg-primary-hover transition-all"
                  >
                    Save Rule
                  </button>
                  <button
                    onClick={() => setShowCreateRule(false)}
                    className="bg-glass border border-glass-border text-text-main px-4 py-2 rounded-xl hover:border-red-500 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Rules List */}
          {rules.length === 0 ? (
            <div className="bg-glass backdrop-blur-xl border border-glass-border rounded-2xl p-12 text-center">
              <p className="text-text-muted text-lg">No rules configured</p>
            </div>
          ) : (
            <div className="space-y-4">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="bg-glass backdrop-blur-xl border border-glass-border rounded-2xl p-6"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-1">{rule.name}</h3>
                      {rule.description && (
                        <p className="text-text-muted mb-2">{rule.description}</p>
                      )}
                      <div className="flex items-center gap-2">
                        <span className={`text-sm px-2 py-1 rounded-full ${
                          rule.enabled ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'
                        }`}>
                          {rule.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                        <span className="text-xs text-text-muted">
                          {rule.conditions.length} condition(s)
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleRule(rule.id, rule.enabled)}
                        className="px-3 py-1 bg-primary text-white rounded-lg hover:bg-primary-hover transition-all text-sm"
                      >
                        {rule.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => deleteRule(rule.id)}
                        className="px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default NotificationCenter;
