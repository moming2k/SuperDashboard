import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config';

/**
 * SuiteSelector Component
 * Allows users to browse, customize, and activate plugin suites
 */
function SuiteSelector({ onSuiteActivated, onSkip }) {
  const [suites, setSuites] = useState([]);
  const [selectedSuite, setSelectedSuite] = useState(null);
  const [step, setStep] = useState('browse'); // browse | customize
  const [enabledPlugins, setEnabledPlugins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    fetchSuites();
  }, []);

  // Clear error when changing steps
  const changeStep = (newStep) => {
    setError(null);
    setStep(newStep);
  };

  const fetchSuites = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/suites`);
      if (!res.ok) throw new Error('Failed to fetch suites');
      const data = await res.json();
      setSuites(data.suites || []);
      setLoading(false);
    } catch (e) {
      console.error('Failed to fetch suites:', e);
      setError('Failed to load suites. Please try again.');
      setLoading(false);
    }
  };

  const selectSuite = (suite) => {
    setSelectedSuite(suite);
    // Auto-enable required and recommended plugins with null safety
    const plugins = suite.plugins || {};
    setEnabledPlugins([
      ...(plugins.required || []),
      ...(plugins.recommended || [])
    ]);
    changeStep('customize');
  };

  const togglePlugin = (pluginName, isRequired) => {
    if (isRequired) return; // Can't disable required plugins

    setEnabledPlugins(prev =>
      prev.includes(pluginName)
        ? prev.filter(p => p !== pluginName)
        : [...prev, pluginName]
    );
  };

  const activateSuite = async () => {
    if (!selectedSuite) return;

    setActivating(true);
    try {
      const response = await fetch(`${API_BASE}/suites/user/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suite_name: selectedSuite.name,
          enabled_plugins: enabledPlugins
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to activate suite');
      }

      const data = await response.json();

      // Reset activating state before callback
      setActivating(false);

      if (onSuiteActivated) {
        onSuiteActivated(selectedSuite, enabledPlugins, data.selection);
      }
    } catch (e) {
      console.error('Failed to activate suite:', e);
      setError(e.message || 'Failed to activate suite. Please try again.');
      setActivating(false);
    }
  };

  const getCategoryColor = (category) => {
    const colors = {
      career: 'from-blue-500 to-blue-600',
      lifestyle: 'from-pink-500 to-rose-600',
      education: 'from-green-500 to-emerald-600',
      productivity: 'from-purple-500 to-violet-600',
      development: 'from-orange-500 to-amber-600',
    };
    return colors[category] || 'from-gray-500 to-gray-600';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-dark flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">📦</div>
          <p className="text-text-muted">Loading available suites...</p>
        </div>
      </div>
    );
  }

  // Browse suites view
  if (step === 'browse') {
    return (
      <div className="min-h-screen bg-bg-dark p-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-4">
              Welcome to SuperDashboard
            </h1>
            <p className="text-text-muted text-lg max-w-2xl mx-auto">
              Choose a suite that matches your goals. Each suite comes with curated plugins
              designed to help you succeed.
            </p>
          </div>

          {error && (
            <div className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-center">
              {error}
              <button
                onClick={() => { setError(null); fetchSuites(); }}
                className="ml-4 underline hover:no-underline"
              >
                Retry
              </button>
            </div>
          )}

          {suites.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-text-muted">No suites available yet.</p>
              <button
                onClick={onSkip}
                className="mt-6 text-primary hover:underline"
              >
                Continue without a suite
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {suites.map(suite => (
                  <button
                    key={suite.name}
                    onClick={() => selectSuite(suite)}
                    className="bg-glass backdrop-blur-xl border border-glass-border
                               rounded-2xl p-6 text-left transition-all duration-300
                               hover:scale-[1.02] hover:border-primary hover:shadow-lg
                               hover:shadow-primary/10 group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="text-5xl group-hover:scale-110 transition-transform">
                        {suite.icon}
                      </div>
                      {suite.category && (
                        <span className={`text-xs px-2 py-1 rounded-full bg-gradient-to-r ${getCategoryColor(suite.category)} text-white`}>
                          {suite.category}
                        </span>
                      )}
                    </div>

                    <h3 className="text-xl font-semibold text-text-main mb-2 group-hover:text-primary transition-colors">
                      {suite.displayName}
                    </h3>

                    <p className="text-text-muted text-sm mb-4 line-clamp-2">
                      {suite.description}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                        {(suite.plugins?.required?.length || 0)} required
                      </span>
                      <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded-full">
                        {(suite.plugins?.recommended?.length || 0)} recommended
                      </span>
                      {(suite.plugins?.optional?.length || 0) > 0 && (
                        <span className="text-xs bg-glass text-text-muted px-2 py-1 rounded-full">
                          +{suite.plugins.optional.length} optional
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <div className="text-center">
                <button
                  onClick={onSkip}
                  className="text-text-muted hover:text-text-main transition-colors"
                >
                  Skip for now - I'll configure manually
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Customize plugins view
  if (step === 'customize' && selectedSuite) {
    const allPlugins = [
      ...(selectedSuite.plugins?.required || []).map(p => ({ name: p, tier: 'required' })),
      ...(selectedSuite.plugins?.recommended || []).map(p => ({ name: p, tier: 'recommended' })),
      ...(selectedSuite.plugins?.optional || []).map(p => ({ name: p, tier: 'optional' }))
    ];

    return (
      <div className="min-h-screen bg-bg-dark p-8">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => changeStep('browse')}
            className="text-text-muted mb-6 hover:text-text-main flex items-center gap-2 transition-colors"
          >
            <span>←</span> Back to suites
          </button>

          <div className="flex items-center gap-4 mb-8">
            <span className="text-6xl">{selectedSuite.icon}</span>
            <div>
              <h1 className="text-3xl font-bold text-text-main">
                {selectedSuite.displayName}
              </h1>
              <p className="text-text-muted">Customize your plugins</p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
              {error}
            </div>
          )}

          <div className="bg-glass backdrop-blur-xl border border-glass-border rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 text-text-main">Select Plugins</h2>

            {allPlugins.length === 0 ? (
              <p className="text-text-muted">No plugins configured for this suite.</p>
            ) : (
              <div className="space-y-2">
                {allPlugins.map(({ name, tier }) => (
                  <label
                    key={name}
                    className={`flex items-center justify-between p-4 rounded-xl
                               transition-all cursor-pointer
                               ${tier === 'required'
                                 ? 'bg-primary/10 cursor-not-allowed'
                                 : 'hover:bg-glass'}`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={enabledPlugins.includes(name)}
                        onChange={() => togglePlugin(name, tier === 'required')}
                        disabled={tier === 'required'}
                        className="w-5 h-5 rounded border-glass-border accent-primary"
                      />
                      <span className="text-text-main capitalize">
                        {name.replace(/-/g, ' ')}
                      </span>
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full font-medium
                      ${tier === 'required' ? 'bg-primary/20 text-primary' : ''}
                      ${tier === 'recommended' ? 'bg-accent/20 text-accent' : ''}
                      ${tier === 'optional' ? 'bg-glass text-text-muted' : ''}
                    `}>
                      {tier}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <button
              onClick={activateSuite}
              disabled={activating}
              className="flex-1 bg-primary text-white p-4 rounded-xl
                         font-semibold transition-all duration-300
                         hover:bg-primary/80 hover:-translate-y-0.5
                         disabled:opacity-50 disabled:cursor-not-allowed
                         disabled:hover:translate-y-0"
            >
              {activating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⏳</span>
                  Activating...
                </span>
              ) : (
                `Activate ${selectedSuite.displayName}`
              )}
            </button>

            <button
              onClick={() => changeStep('browse')}
              disabled={activating}
              className="px-6 py-4 rounded-xl font-semibold bg-glass
                         border border-glass-border text-text-muted
                         hover:text-text-main transition-all duration-300
                         disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

/**
 * SuiteManager Component
 * Compact component for managing active suite from sidebar/settings
 */
export function SuiteManager({ activeSuite, onChangeSuite, onDeactivate }) {
  if (!activeSuite) {
    return (
      <button
        onClick={onChangeSuite}
        className="w-full p-3 px-4 rounded-xl text-left text-text-muted
                   hover:bg-glass hover:text-text-main transition-all duration-300
                   flex items-center gap-3"
      >
        <span>📦</span>
        <span>Choose a Suite</span>
      </button>
    );
  }

  return (
    <div className="bg-glass rounded-xl p-4 mb-4">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{activeSuite.suite_icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-main truncate">
            {activeSuite.suite_display_name}
          </p>
          <p className="text-xs text-text-muted">
            {activeSuite.enabled_plugins?.length || 0} plugins active
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onChangeSuite}
          className="flex-1 text-xs p-2 rounded-lg bg-primary/20 text-primary
                     hover:bg-primary/30 transition-colors"
        >
          Change
        </button>
        <button
          onClick={onDeactivate}
          className="flex-1 text-xs p-2 rounded-lg bg-glass text-text-muted
                     hover:text-text-main transition-colors"
        >
          Deactivate
        </button>
      </div>
    </div>
  );
}

export default SuiteSelector;
