import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../config';

function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [sortBy, setSortBy] = useState('created');
  const [editingTask, setEditingTask] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchTasks();
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_BASE}/tasks`);
      const data = await res.json();
      setTasks(data);
    } catch (e) {
      console.error("Failed to fetch tasks", e);
      showToast("Failed to load tasks", "error");
    }
  };

  const addTask = async () => {
    const title = document.getElementById('newTaskTitle').value;
    const desc = document.getElementById('newTaskDesc').value;
    const priority = document.getElementById('newTaskPriority').value;
    const dueDate = document.getElementById('newTaskDueDate').value;

    if (!title) {
      showToast("Task title is required", "error");
      return;
    }

    try {
      await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: desc,
          priority: priority || 'medium',
          due_date: dueDate || null,
          status: 'pending'
        })
      });
      fetchTasks();
      document.getElementById('newTaskTitle').value = '';
      document.getElementById('newTaskDesc').value = '';
      document.getElementById('newTaskPriority').value = 'medium';
      document.getElementById('newTaskDueDate').value = '';
      showToast("Task created successfully!");
    } catch (e) {
      console.error("Failed to add task", e);
      showToast("Failed to create task", "error");
    }
  };

  const updateTask = async (taskId, updates) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...task, ...updates })
      });

      if (res.ok) {
        fetchTasks();
        showToast("Task updated successfully!");
      }
    } catch (e) {
      console.error("Failed to update task", e);
      showToast("Failed to update task", "error");
    }
  };

  const deleteTask = async (taskId) => {
    if (!confirm("Are you sure you want to delete this task?")) return;

    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        fetchTasks();
        showToast("Task deleted successfully!");
      }
    } catch (e) {
      console.error("Failed to delete task", e);
      showToast("Failed to delete task", "error");
    }
  };

  const startEditing = (task) => {
    setEditingTask({
      ...task,
      due_date: task.due_date ? task.due_date.split('T')[0] : ''
    });
  };

  const cancelEditing = () => {
    setEditingTask(null);
  };

  const saveEditing = async () => {
    if (!editingTask) return;
    await updateTask(editingTask.id, {
      title: editingTask.title,
      description: editingTask.description,
      status: editingTask.status,
      priority: editingTask.priority,
      due_date: editingTask.due_date || null
    });
    setEditingTask(null);
  };

  // Filter and sort tasks
  const filteredTasks = tasks
    .filter(task => filterStatus === 'all' || task.status === filterStatus)
    .filter(task => filterPriority === 'all' || task.priority === filterPriority)
    .sort((a, b) => {
      if (sortBy === 'priority') {
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      } else if (sortBy === 'dueDate') {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date) - new Date(b.due_date);
      }
      return 0; // default: created order from backend
    });

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500/20 text-red-400';
      case 'high': return 'bg-orange-500/20 text-orange-400';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400';
      case 'low': return 'bg-blue-500/20 text-blue-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-500/20 text-green-400';
      case 'in-progress': return 'bg-purple-500/20 text-purple-400';
      case 'blocked': return 'bg-red-500/20 text-red-400';
      default: return 'bg-amber-500/20 text-amber-400';
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = date - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: 'Overdue', color: 'text-red-400' };
    if (diffDays === 0) return { text: 'Due today', color: 'text-orange-400' };
    if (diffDays === 1) return { text: 'Due tomorrow', color: 'text-yellow-400' };
    if (diffDays <= 7) return { text: `Due in ${diffDays} days`, color: 'text-blue-400' };
    return { text: date.toLocaleDateString(), color: 'text-text-muted' };
  };

  return (
    <div className="animate-fade">
      <h1 className="text-3xl font-bold mb-8">Task Tracker</h1>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-xl shadow-2xl animate-fade ${toast.type === 'error' ? 'bg-red-500/20 border border-red-500/50 text-red-400' : 'bg-green-500/20 border border-green-500/50 text-green-400'
          }`}>
          {toast.message}
        </div>
      )}

      {/* Filters and Sort */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-sm text-text-muted">Status:</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-bg-dark/50 border border-glass-border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary transition-colors"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-text-muted">Priority:</label>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="bg-bg-dark/50 border border-glass-border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary transition-colors"
          >
            <option value="all">All</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-text-muted">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-bg-dark/50 border border-glass-border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary transition-colors"
          >
            <option value="created">Created</option>
            <option value="priority">Priority</option>
            <option value="dueDate">Due Date</option>
          </select>
        </div>
      </div>

      {/* Tasks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {filteredTasks.length === 0 && <p className="text-text-muted col-span-full">No tasks found. Create one or adjust filters!</p>}
        {filteredTasks.map((task) => {
          const isEditing = editingTask?.id === task.id;
          const dueDate = formatDate(task.due_date);

          return (
            <div key={task.id} className="bg-glass border border-glass-border rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02] hover:border-primary group">
              {isEditing ? (
                // Edit Mode
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editingTask.title}
                    onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                    className="w-full bg-bg-dark/50 border border-glass-border rounded-lg p-2 text-white outline-none focus:border-primary"
                    placeholder="Task title"
                  />
                  <textarea
                    value={editingTask.description || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                    className="w-full bg-bg-dark/50 border border-glass-border rounded-lg p-2 text-white outline-none focus:border-primary resize-none h-20"
                    placeholder="Description"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={editingTask.status}
                      onChange={(e) => setEditingTask({ ...editingTask, status: e.target.value })}
                      className="bg-bg-dark/50 border border-glass-border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-primary"
                    >
                      <option value="pending">Pending</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="blocked">Blocked</option>
                    </select>
                    <select
                      value={editingTask.priority}
                      onChange={(e) => setEditingTask({ ...editingTask, priority: e.target.value })}
                      className="bg-bg-dark/50 border border-glass-border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-primary"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <input
                    type="date"
                    value={editingTask.due_date || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, due_date: e.target.value })}
                    className="w-full bg-bg-dark/50 border border-glass-border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-primary"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={saveEditing}
                      className="flex-1 bg-primary text-white px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-primary-hover transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="flex-1 bg-bg-dark/50 text-text-muted px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-bg-dark transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                // View Mode
                <>
                  <div className="mb-4">
                    <h4 className="text-lg font-bold mb-2">{task.title}</h4>
                    <p className="text-text-muted text-sm line-clamp-2 mb-3">{task.description || 'No description'}</p>

                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(task.status)}`}>
                        {task.status}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                    </div>

                    {dueDate && (
                      <div className={`text-xs ${dueDate.color} flex items-center gap-1`}>
                        <span>📅</span>
                        <span>{dueDate.text}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => updateTask(task.id, { status: task.status === 'completed' ? 'pending' : 'completed' })}
                      className="flex-1 bg-green-500/20 text-green-400 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-green-500/30 transition-colors"
                    >
                      {task.status === 'completed' ? '↶ Reopen' : '✓ Complete'}
                    </button>
                    <button
                      onClick={() => startEditing(task)}
                      className="flex-1 bg-blue-500/20 text-blue-400 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-blue-500/30 transition-colors"
                    >
                      ✎ Edit
                    </button>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-red-500/30 transition-colors"
                    >
                      🗑
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Add New Task Form */}
      <div className="bg-bg-card backdrop-blur-xl border border-glass-border rounded-[24px] p-8 shadow-2xl">
        <h3 className="text-xl font-semibold mb-6">Add New Task</h3>
        <div className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Task Title *"
            id="newTaskTitle"
            className="bg-bg-dark/50 border border-glass-border rounded-xl p-3 text-white w-full outline-none focus:border-primary transition-colors"
          />
          <textarea
            placeholder="Description"
            id="newTaskDesc"
            className="bg-bg-dark/50 border border-glass-border rounded-xl p-3 text-white w-full h-32 outline-none focus:border-primary transition-colors resize-none"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-text-muted mb-2 block">Priority</label>
              <select
                id="newTaskPriority"
                defaultValue="medium"
                className="bg-bg-dark/50 border border-glass-border rounded-xl p-3 text-white w-full outline-none focus:border-primary transition-colors"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-text-muted mb-2 block">Due Date</label>
              <input
                type="date"
                id="newTaskDueDate"
                className="bg-bg-dark/50 border border-glass-border rounded-xl p-3 text-white w-full outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>
          <button
            className="bg-primary text-white p-3 px-6 rounded-xl font-semibold cursor-pointer transition-all duration-300 hover:bg-primary-hover hover:-translate-y-0.5 hover:shadow-[0_5px_15px_rgba(99,102,241,0.4)] self-start"
            onClick={addTask}
          >
            Add Task
          </button>
        </div>
      </div>
    </div>
  );
}

export default Tasks;
