import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:8000';

function WorkflowStatusWidget() {
  const [workflows, setWorkflows] = useState([]);
  const [scheduled, setScheduled] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      // Fetch workflows
      const workflowsRes = await fetch(`${API_BASE}/plugins/workflow-engine/workflows`);
      const workflowsData = await workflowsRes.json();
      setWorkflows(workflowsData);

      // Fetch scheduled workflows
      const scheduledRes = await fetch(`${API_BASE}/plugins/workflow-engine/scheduled`);
      const scheduledData = await scheduledRes.json();
      setScheduled(scheduledData);

      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch workflow data:', error);
      setLoading(false);
    }
  };

  const executeWorkflow = async (workflowId) => {
    try {
      await fetch(`${API_BASE}/plugins/workflow-engine/workflows/${workflowId}/execute`, {
        method: 'POST'
      });
      alert('Workflow executed!');
    } catch (error) {
      console.error('Failed to execute workflow:', error);
      alert('Failed to execute workflow');
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-text-muted">
        <div className="text-center">
          <div className="animate-spin text-3xl mb-2">⚙️</div>
          <p className="text-sm">Loading workflows...</p>
        </div>
      </div>
    );
  }

  const activeWorkflows = workflows.filter(w => w.enabled);
  const scheduledWorkflows = Object.keys(scheduled);

  return (
    <div className="h-full flex flex-col p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          ⚙️ Workflows
        </h3>
        <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">
          {activeWorkflows.length} active
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-bg-card rounded-lg p-3">
          <div className="text-2xl font-bold text-primary">{workflows.length}</div>
          <div className="text-xs text-text-muted">Total</div>
        </div>
        <div className="bg-bg-card rounded-lg p-3">
          <div className="text-2xl font-bold text-accent">{scheduledWorkflows.length}</div>
          <div className="text-xs text-text-muted">Scheduled</div>
        </div>
      </div>

      {/* Workflow List */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {activeWorkflows.length === 0 ? (
          <div className="text-center text-text-muted text-sm py-4">
            No active workflows
          </div>
        ) : (
          activeWorkflows.slice(0, 5).map(workflow => (
            <div
              key={workflow.id}
              className="bg-bg-card border border-glass-border rounded-lg p-3 hover:border-primary transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-1">
                <div className="flex-1">
                  <div className="font-medium text-sm truncate">{workflow.name}</div>
                  {workflow.schedule && (
                    <div className="text-xs text-text-muted font-mono mt-1">
                      {workflow.schedule}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => executeWorkflow(workflow.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-primary text-white px-2 py-1 rounded hover:bg-primary-hover"
                >
                  ▶️ Run
                </button>
              </div>

              {scheduled[workflow.id] && (
                <div className="text-xs text-accent mt-2">
                  Next run: {new Date(scheduled[workflow.id].next_run_time).toLocaleString()}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {activeWorkflows.length > 5 && (
        <div className="text-xs text-text-muted text-center mt-2">
          +{activeWorkflows.length - 5} more workflows
        </div>
      )}
    </div>
  );
}

export default WorkflowStatusWidget;
