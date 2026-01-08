import React, { useState, useEffect, Suspense, lazy } from 'react';
import Toast from './components/Toast';
import config, { API_BASE } from './config';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Import all plugin components using glob pattern
const pluginModules = import.meta.glob('./plugins/*/*.jsx', { eager: true });

const componentCache = {};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400">
          <h2 className="text-xl font-bold mb-2">Plugin Error</h2>
          <p>This plugin failed to load or crashed. Please check the console for details.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const PluginComponent = ({ plugin, props }) => {
  if (!plugin || !plugin.manifest?.frontendComponent) return null;

  if (!componentCache[plugin.name]) {
    // Find the matching module from glob imports
    const modulePath = `./plugins/${plugin.name}/${plugin.manifest.frontendComponent}.jsx`;
    const module = pluginModules[modulePath];

    if (!module) {
      console.error(`Plugin component not found: ${modulePath}`);
      return (
        <div className="p-8 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400">
          <h2 className="text-xl font-bold mb-2">Plugin Not Found</h2>
          <p>Component file not found: {modulePath}</p>
        </div>
      );
    }

    componentCache[plugin.name] = module.default;
  }

  const Component = componentCache[plugin.name];

  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="p-8 text-text-muted animate-pulse">Loading plugin: {plugin.name}...</div>}>
        <Component {...props} />
      </Suspense>
    </ErrorBoundary>
  );
};

const SortablePluginItem = ({ plugin, togglePlugin, openConfigModal }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: plugin.name });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-bg-card backdrop-blur-xl border border-glass-border rounded-[24px] p-6 shadow-2xl transition-all hover:border-primary"
    >
      <div className="flex items-center gap-4">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-text-muted hover:text-text-main transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8h16M4 16h16"
            />
          </svg>
        </div>

        {/* Plugin Icon */}
        <span className="text-3xl">{plugin.manifest?.tab?.icon || '🧩'}</span>

        {/* Plugin Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold">{plugin.manifest?.displayName || plugin.name}</h3>
            {plugin.isCore && (
              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">CORE</span>
            )}
          </div>
          <p className="text-text-muted text-xs">v{plugin.manifest?.version || '1.0.0'}</p>
          {plugin.manifest?.description && (
            <p className="text-text-muted text-sm mt-2">{plugin.manifest.description}</p>
          )}
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${plugin.enabled ? 'bg-green-400' : 'bg-gray-400'}`}></div>
          <p className="text-text-muted text-sm uppercase tracking-wider">{plugin.status}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => togglePlugin(plugin.name, plugin.enabled)}
            disabled={plugin.isCore}
            className={`p-2 px-4 rounded-xl font-semibold text-sm transition-all duration-300 ${plugin.isCore
              ? 'bg-gray-600/30 text-gray-500 cursor-not-allowed'
              : plugin.enabled
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                : 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30'
              }`}
          >
            {plugin.enabled ? 'Disable' : 'Enable'}
          </button>
          <button
            onClick={() => openConfigModal(plugin)}
            className="p-2 px-4 rounded-xl font-semibold text-sm bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 transition-all duration-300"
          >
            ⚙️ Config
          </button>
        </div>
      </div>
    </div>
  );
};

function App() {
  // Get initial tab from URL hash (e.g., #dashboard, #jira, #plugins)
  const getInitialTab = () => {
    const hash = window.location.hash.slice(1); // Remove the '#'
    // Extract base plugin name from paths like 'rss-reader/article/123'
    const baseTab = hash.split('/')[0];
    // If no hash, default to 'dashboard' tab
    return baseTab || 'dashboard';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab());
  const [plugins, setPlugins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [selectedPlugin, setSelectedPlugin] = useState(null);
  const [pluginConfig, setPluginConfig] = useState({});
  const [toast, setToast] = useState(null);

  // Custom setActiveTab that also updates URL
  const navigateToTab = (tabId) => {
    setActiveTab(tabId);
    window.location.hash = tabId;
  };

  const fetchPlugins = async () => {
    try {
      const res = await fetch(`${API_BASE}/plugins`);
      const data = await res.json();
      setPlugins(data);
      setLoading(false);
    } catch (e) {
      console.error("Failed to fetch plugins", e);
      setLoading(false);
    }
  };

  const togglePlugin = async (pluginName, currentEnabled) => {
    try {
      const res = await fetch(`${API_BASE}/plugins/${pluginName}/toggle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentEnabled })
      });
      const data = await res.json();

      if (res.ok) {
        // Update local state
        setPlugins(plugins.map(p =>
          p.name === pluginName ? { ...p, enabled: !currentEnabled, status: !currentEnabled ? 'enabled' : 'disabled' } : p
        ));
        // Show success message
        setToast({ message: 'Plugin toggled successfully!', type: 'success' });
      } else {
        setToast({ message: `Error: ${data.detail || 'Failed to toggle plugin'}`, type: 'error' });
      }
    } catch (e) {
      console.error("Failed to toggle plugin", e);
      setToast({ message: 'Failed to toggle plugin', type: 'error' });
    }
  };

  const openConfigModal = async (plugin) => {
    setSelectedPlugin(plugin);
    try {
      const res = await fetch(`${API_BASE}/plugins/${plugin.name}/config`);
      const data = await res.json();
      setPluginConfig(data.config || {});
      setConfigModalOpen(true);
    } catch (e) {
      console.error("Failed to fetch plugin config", e);
      setPluginConfig({});
      setConfigModalOpen(true);
    }
  };

  const savePluginConfig = async () => {
    if (!selectedPlugin) return;

    try {
      const res = await fetch(`${API_BASE}/plugins/${selectedPlugin.name}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: pluginConfig })
      });

      if (res.ok) {
        setToast({ message: 'Plugin configuration saved successfully!', type: 'success' });
        setConfigModalOpen(false);
        fetchPlugins(); // Refresh plugin list
      } else {
        const data = await res.json();
        setToast({ message: `Error: ${data.detail || 'Failed to save config'}`, type: 'error' });
      }
    } catch (e) {
      console.error("Failed to save plugin config", e);
      setToast({ message: 'Failed to save plugin configuration', type: 'error' });
    }
  };

  const savePluginOrder = async (orderedPlugins) => {
    try {
      const orders = orderedPlugins.map((plugin, index) => ({
        plugin_name: plugin.name,
        order_index: index
      }));

      const res = await fetch(`${API_BASE}/plugins/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders })
      });

      if (res.ok) {
        setToast({ message: 'Plugin order saved successfully!', type: 'success' });
        // Refresh plugin list to update navigation order in real-time
        await fetchPlugins();
      } else {
        const data = await res.json();
        setToast({ message: `Error: ${data.detail || 'Failed to save order'}`, type: 'error' });
      }
    } catch (e) {
      console.error("Failed to save plugin order", e);
      setToast({ message: 'Failed to save plugin order', type: 'error' });
    }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setPlugins((items) => {
        const oldIndex = items.findIndex((item) => item.name === active.id);
        const newIndex = items.findIndex((item) => item.name === over.id);

        const newOrder = arrayMove(items, oldIndex, newIndex);

        // Save the new order to the backend
        savePluginOrder(newOrder);

        return newOrder;
      });
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchPlugins();

    // Listen for navigation events from plugins
    const handleNavigate = (e) => {
      if (e.detail?.tab) {
        navigateToTab(e.detail.tab);
      }
    };

    // Listen for hash changes (browser back/forward buttons)
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      // Extract base plugin name from paths like 'rss-reader/article/123'
      const baseTab = hash.split('/')[0];
      if (baseTab && baseTab !== activeTab) {
        setActiveTab(baseTab);
      }
    };

    window.addEventListener('navigate-tab', handleNavigate);
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('navigate-tab', handleNavigate);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [activeTab]);

  // Get all plugins with tabs enabled
  const getVisibleTabs = () => {
    if (!plugins || plugins.length === 0) return [];

    // Find plugins that replace core views (only if enabled)
    const replacedViews = plugins
      .filter(p => p.enabled && p.manifest?.replaces)
      .map(p => p.manifest.replaces);

    // Filter plugins with tabs enabled
    const visiblePlugins = plugins.filter(plugin => {
      // Don't show disabled plugins
      if (!plugin.enabled) return false;

      const manifest = plugin.manifest || {};
      const tab = manifest.tab || {};

      // Check if tab is explicitly disabled
      if (tab.enabled === false) return false;

      // Check if this is a core plugin that's been replaced
      if (manifest.name && replacedViews.includes(manifest.name)) return false;

      // Include if it has a frontend component
      return manifest.frontendComponent;
    });

    // Map to tab objects and sort by order (using backend's stored order)
    return visiblePlugins
      .map(plugin => {
        const manifest = plugin.manifest || {};
        const tab = manifest.tab || {};

        return {
          id: tab.id || manifest.name,
          label: `${tab.icon || '🧩'} ${tab.label || manifest.displayName || manifest.name}`,
          order: plugin.order !== null && plugin.order !== undefined ? plugin.order : 999,
          plugin: plugin
        };
      })
      .sort((a, b) => a.order - b.order);
  };

  // Get active plugin
  const getActivePlugin = () => {
    const tabs = getVisibleTabs();
    const activeTabObj = tabs.find(tab => tab.id === activeTab);
    return activeTabObj?.plugin;
  };

  const visibleTabs = getVisibleTabs();
  const activePlugin = getActivePlugin();

  // Get command palette plugin (if enabled)
  const commandPalettePlugin = plugins.find(p => p.name === 'command-palette' && p.enabled);

  if (loading) {
    return (
      <div className="flex h-screen bg-bg-dark font-outfit text-text-main items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⚡</div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Loading SuperDashboard...
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-bg-dark font-outfit text-text-main">
      {/* Sidebar */}
      <div className="w-[260px] bg-glass backdrop-blur-xl border-r border-glass-border p-8 flex flex-col gap-8">
        <div className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-8">
          SuperDashboard
        </div>
        <nav className="flex flex-col gap-2">
          {visibleTabs.map((tab) => (
            <div
              key={tab.id}
              className={`flex items-center gap-3 p-3 px-4 rounded-xl cursor-pointer transition-all duration-300 hover:bg-glass hover:text-text-main hover:translate-x-1 ${activeTab === tab.id
                ? 'bg-glass text-text-main translate-x-1'
                : 'text-text-muted'
                }`}
              onClick={() => navigateToTab(tab.id)}
            >
              {tab.label}
            </div>
          ))}
        </nav>

        {/* Plugin Registry Tab */}
        <div className="mt-auto">
          <div
            className={`flex items-center gap-3 p-3 px-4 rounded-xl cursor-pointer transition-all duration-300 hover:bg-glass hover:text-text-main hover:translate-x-1 ${activeTab === 'plugins'
              ? 'bg-glass text-text-main translate-x-1'
              : 'text-text-muted'
              }`}
            onClick={() => navigateToTab('plugins')}
          >
            🧩 Plugin Registry
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        {activeTab === 'plugins' ? (
          <div className="animate-fade">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-3xl font-bold">Plugin Registry</h1>
              <p className="text-text-muted text-sm">Drag and drop to reorder plugins</p>
            </div>
            {plugins.length === 0 ? (
              <p className="text-text-muted">No plugins detected.</p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={plugins.map(p => p.name)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex flex-col gap-4">
                    {plugins.map(plugin => (
                      <SortablePluginItem
                        key={plugin.name}
                        plugin={plugin}
                        togglePlugin={togglePlugin}
                        openConfigModal={openConfigModal}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        ) : (
          activePlugin && <PluginComponent plugin={activePlugin} />
        )}

        {!activePlugin && activeTab !== 'plugins' && (
          <div className="animate-fade flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-6xl mb-4">🔌</div>
              <h2 className="text-2xl font-bold mb-2">Tab Not Found</h2>
              <p className="text-text-muted">The requested tab "{activeTab}" is not available.</p>
            </div>
          </div>
        )}

        {/* Config Modal */}
        {configModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setConfigModalOpen(false)}>
            <div className="bg-bg-card backdrop-blur-xl border border-glass-border rounded-[24px] p-8 shadow-2xl max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Configure {selectedPlugin?.manifest?.displayName || selectedPlugin?.name}</h2>
                <button onClick={() => setConfigModalOpen(false)} className="text-text-muted hover:text-text-main transition-colors">
                  ✕
                </button>
              </div>


              {/* Instructions Section */}
              {selectedPlugin?.manifest?.config?.instructions && (
                <div className="mb-6 bg-glass border border-glass-border rounded-xl p-6">
                  <pre className="text-text-main text-sm whitespace-pre-wrap font-sans leading-relaxed">
                    {selectedPlugin.manifest.config.instructions}
                  </pre>
                </div>
              )}

              <div className="mb-6">
                <p className="text-text-muted text-sm mb-4">
                  Configure plugin settings in JSON format. This configuration will be available to the plugin at runtime.
                </p>
                <textarea
                  value={JSON.stringify(pluginConfig, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      setPluginConfig(parsed);
                    } catch {
                      // Keep invalid JSON in state for user to fix
                    }
                  }}
                  className="w-full h-64 bg-glass border border-glass-border rounded-xl p-4 text-text-main font-mono text-sm focus:outline-none focus:border-primary transition-colors"
                  placeholder='{\n  "key": "value"\n}'
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={savePluginConfig}
                  className="flex-1 bg-primary text-white p-3 px-6 rounded-xl font-semibold transition-all duration-300 hover:bg-primary/80"
                >
                  Save Configuration
                </button>
                <button
                  onClick={() => setConfigModalOpen(false)}
                  className="p-3 px-6 rounded-xl font-semibold bg-glass border border-glass-border text-text-muted hover:text-text-main transition-all duration-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Command Palette (Global Overlay) */}
      {commandPalettePlugin && <PluginComponent plugin={commandPalettePlugin} />}
    </div>
  );
}

export default App;
