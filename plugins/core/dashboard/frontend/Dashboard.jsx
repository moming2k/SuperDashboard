import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import config, { API_BASE } from '../../../../frontend/src/config';
import WidgetSelector from './WidgetSelector';
import './dashboard.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

// Widget component cache
const widgetComponentCache = {};

const WidgetContainer = ({ widget, onRemove }) => {
  // Dynamically load widget component
  const loadWidget = () => {
    const cacheKey = `${widget.pluginName}.${widget.component}`;

    if (!widgetComponentCache[cacheKey]) {
      widgetComponentCache[cacheKey] = lazy(() =>
        import(`../../../../frontend/src/plugins/${widget.pluginName}/${widget.component}.jsx`)
          .catch(err => {
            console.error(`Failed to load widget: ${widget.pluginName}/${widget.component}`, err);
            return {
              default: () => (
                <div className="text-red-400 text-sm">
                  Failed to load widget: {widget.displayName}
                </div>
              )
            };
          })
      );
    }

    return widgetComponentCache[cacheKey];
  };

  const WidgetComponent = loadWidget();

  return (
    <div className="widget-container bg-bg-card backdrop-blur-xl border border-glass-border rounded-[20px] shadow-2xl overflow-hidden flex flex-col h-full">
      {/* Widget Header */}
      <div className="widget-header flex items-center justify-between p-4 border-b border-glass-border cursor-move">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{widget.icon}</span>
          <h3 className="font-semibold text-text-main">{widget.displayName}</h3>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(widget.id);
          }}
          className="text-text-muted hover:text-red-400 transition-colors text-lg leading-none"
          aria-label="Remove widget"
        >
          ✕
        </button>
      </div>

      {/* Widget Content */}
      <div className="widget-content flex-1 overflow-auto p-4">
        <Suspense fallback={<div className="text-text-muted text-sm animate-pulse">Loading widget...</div>}>
          <WidgetComponent widgetId={widget.id} />
        </Suspense>
      </div>

      {/* Resize Handle */}
      <div className="resize-handle absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-0 hover:opacity-100 transition-opacity">
        <svg viewBox="0 0 16 16" className="w-full h-full text-primary">
          <path fill="currentColor" d="M16,16 L16,14 L14,16 Z M16,12 L12,16 L14,16 L16,14 Z M16,8 L8,16 L12,16 L16,12 Z" />
        </svg>
      </div>
    </div>
  );
};

function Dashboard() {
  const [layout, setLayout] = useState([]);
  const [availableWidgets, setAvailableWidgets] = useState([]);
  const [activeWidgets, setActiveWidgets] = useState([]);
  const [showSelector, setShowSelector] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch available widgets from backend
  useEffect(() => {
    const fetchWidgets = async () => {
      try {
        const res = await fetch(`${API_BASE}/widgets`);
        const data = await res.json();
        setAvailableWidgets(data.widgets || []);
      } catch (error) {
        console.error('Failed to fetch widgets:', error);
      }
    };

    fetchWidgets();
  }, []);

  // Load saved layout from backend
  useEffect(() => {
    const loadLayout = async () => {
      try {
        const res = await fetch(`${API_BASE}/dashboard/layout`);
        const data = await res.json();

        if (data.layout && data.layout.length > 0) {
          setLayout(data.layout);

          // Reconstruct active widgets from layout
          const widgets = data.layout.map(item => {
            const widgetDef = availableWidgets.find(w => w.id === item.i);
            return widgetDef || { id: item.i, displayName: 'Unknown Widget', icon: '📦' };
          });
          setActiveWidgets(widgets);
        } else {
          // Default layout with welcome widget
          const welcomeWidget = availableWidgets.find(w => w.id === 'dashboard.welcome');
          if (welcomeWidget) {
            addWidget(welcomeWidget);
          }
        }

        setLoading(false);
      } catch (error) {
        console.error('Failed to load layout:', error);
        setLoading(false);
      }
    };

    if (availableWidgets.length > 0) {
      loadLayout();
    }
  }, [availableWidgets]);

  // Save layout to backend
  const saveLayout = async (newLayout) => {
    try {
      await fetch(`${API_BASE}/dashboard/layout`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: newLayout })
      });
    } catch (error) {
      console.error('Failed to save layout:', error);
    }
  };

  const addWidget = (widget) => {
    // Check if widget already exists
    if (activeWidgets.find(w => w.id === widget.id)) {
      console.warn('Widget already added');
      return;
    }

    const newWidget = { ...widget };
    const newLayoutItem = {
      i: widget.id,
      x: (layout.length * 2) % 12,
      y: Infinity, // Puts it at the bottom
      w: widget.defaultSize?.w || 4,
      h: widget.defaultSize?.h || 3,
      minW: widget.defaultSize?.minW || 2,
      minH: widget.defaultSize?.minH || 2,
    };

    const newLayout = [...layout, newLayoutItem];
    const newActiveWidgets = [...activeWidgets, newWidget];

    setLayout(newLayout);
    setActiveWidgets(newActiveWidgets);
    saveLayout(newLayout);
  };

  const removeWidget = (widgetId) => {
    const newLayout = layout.filter(item => item.i !== widgetId);
    const newActiveWidgets = activeWidgets.filter(w => w.id !== widgetId);

    setLayout(newLayout);
    setActiveWidgets(newActiveWidgets);
    saveLayout(newLayout);
  };

  const onLayoutChange = (newLayout) => {
    setLayout(newLayout);
    saveLayout(newLayout);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-6xl mb-4">📊</div>
          <h2 className="text-2xl font-bold mb-2">Loading Dashboard...</h2>
          <p className="text-text-muted">Setting up your workspace</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container h-full flex flex-col">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Customize your workspace with widgets
          </p>
        </div>

        <button
          onClick={() => setShowSelector(true)}
          className="bg-primary text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 hover:bg-primary/80 hover:scale-105 hover:shadow-[0_5px_15px_rgba(99,102,241,0.4)] flex items-center gap-2"
        >
          <span className="text-xl">➕</span>
          Add Widget
        </button>
      </div>

      {/* Grid Layout */}
      {activeWidgets.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">📦</div>
            <h2 className="text-2xl font-bold mb-2">No Widgets Yet</h2>
            <p className="text-text-muted mb-4">Add your first widget to get started</p>
            <button
              onClick={() => setShowSelector(true)}
              className="bg-primary text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 hover:bg-primary/80"
            >
              Add Widget
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <ResponsiveGridLayout
            className="layout"
            layouts={{ lg: layout }}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={100}
            onLayoutChange={onLayoutChange}
            draggableHandle=".widget-header"
            compactType="vertical"
            preventCollision={false}
          >
            {activeWidgets.map((widget) => (
              <div key={widget.id}>
                <WidgetContainer
                  widget={widget}
                  onRemove={removeWidget}
                />
              </div>
            ))}
          </ResponsiveGridLayout>
        </div>
      )}

      {/* Widget Selector Modal */}
      {showSelector && (
        <WidgetSelector
          availableWidgets={availableWidgets}
          activeWidgets={activeWidgets}
          onSelectWidget={addWidget}
          onClose={() => setShowSelector(false)}
        />
      )}
    </div>
  );
}

export default Dashboard;
