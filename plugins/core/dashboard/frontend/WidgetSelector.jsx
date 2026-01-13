import React, { useState } from 'react';

function WidgetSelector({ availableWidgets, activeWidgets, onSelectWidget, onClose }) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = ['all', ...new Set(availableWidgets.map(w => w.category))];

  const filteredWidgets = availableWidgets.filter(widget => {
    const isActive = activeWidgets.some(w => w.id === widget.id);
    if (isActive) return false;

    if (selectedCategory !== 'all' && widget.category !== selectedCategory) return false;

    if (searchQuery && !widget.displayName.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !widget.description.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    return true;
  });

  const handleSelectWidget = (widget) => {
    onSelectWidget(widget);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-bg-card backdrop-blur-xl border border-glass-border rounded-[24px] shadow-2xl max-w-4xl w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-glass-border">
          <div>
            <h2 className="text-2xl font-bold">Add Widget</h2>
            <p className="text-text-muted text-sm mt-1">Choose a widget to add to your dashboard</p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-main transition-colors text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-6 border-b border-glass-border">
          <div className="flex gap-4 mb-4">
            <input
              type="text"
              placeholder="Search widgets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-glass border border-glass-border rounded-xl px-4 py-2 text-text-main placeholder-text-muted focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl font-semibold transition-all duration-300 ${
                  selectedCategory === cat
                    ? 'bg-primary text-white'
                    : 'bg-glass text-text-muted hover:text-text-main border border-glass-border'
                }`}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {filteredWidgets.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-xl font-bold mb-2">No Widgets Found</h3>
              <p className="text-text-muted">
                {searchQuery ? 'Try a different search term' : 'All available widgets are already added'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredWidgets.map(widget => (
                <div
                  key={widget.id}
                  onClick={() => handleSelectWidget(widget)}
                  className="bg-glass border border-glass-border rounded-xl p-6 cursor-pointer transition-all duration-300 hover:border-primary hover:scale-[1.02] hover:shadow-[0_5px_15px_rgba(99,102,241,0.3)]"
                >
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">{widget.icon}</div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold mb-1">{widget.displayName}</h3>
                      <p className="text-text-muted text-sm mb-2">{widget.description}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                          {widget.category}
                        </span>
                        <span className="text-xs bg-glass text-text-muted px-2 py-1 rounded-full">
                          {widget.pluginName}
                        </span>
                      </div>
                      {widget.preview && (
                        <p className="text-text-muted text-xs mt-2 italic">{widget.preview}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-glass-border flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-xl font-semibold bg-glass border border-glass-border text-text-muted hover:text-text-main transition-all duration-300"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default WidgetSelector;
