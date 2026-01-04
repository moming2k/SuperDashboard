import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../../../../frontend/src/config';

function Tasks() {
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_BASE}/tasks`);
      const data = await res.json();
      setTasks(data);
    } catch (e) {
      console.error("Failed to fetch tasks", e);
    }
  };

  const addTask = async () => {
    const title = document.getElementById('newTaskTitle').value;
    const desc = document.getElementById('newTaskDesc').value;
    if (!title) return;

    try {
      await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description: desc })
      });
      fetchTasks();
      document.getElementById('newTaskTitle').value = '';
      document.getElementById('newTaskDesc').value = '';
    } catch (e) {
      console.error("Failed to add task", e);
    }
  };

  return (
    <div className="animate-fade">
      <h1 className="text-3xl font-bold mb-8">Task Tracker</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {tasks.length === 0 && <p className="text-text-muted col-span-full">No tasks yet. Create one!</p>}
        {tasks.map((task) => (
          <div key={task.id} className="bg-glass border border-glass-border rounded-2xl p-6 transition-transform duration-300 hover:scale-[1.02] hover:border-primary">
            <h4 className="text-lg font-bold mb-2">{task.title}</h4>
            <p className="text-text-muted mb-4 line-clamp-2">{task.description}</p>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              task.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
            }`}>
              {task.status}
            </span>
          </div>
        ))}
      </div>

      <div className="bg-bg-card backdrop-blur-xl border border-glass-border rounded-[24px] p-8 shadow-2xl">
        <h3 className="text-xl font-semibold mb-6">Add New Task</h3>
        <div className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Task Title"
            id="newTaskTitle"
            className="bg-bg-dark/50 border border-glass-border rounded-xl p-3 text-white w-full outline-none focus:border-primary transition-colors"
          />
          <textarea
            placeholder="Description"
            id="newTaskDesc"
            className="bg-bg-dark/50 border border-glass-border rounded-xl p-3 text-white w-full h-32 outline-none focus:border-primary transition-colors resize-none"
          />
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
