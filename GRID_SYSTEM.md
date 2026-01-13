# SuperDashboard Grid System

## Overview

The SuperDashboard uses a **snap-to-grid layout system** where widgets are positioned and sized according to predefined grid units. This ensures consistent layouts and responsive behavior across different screen sizes.

## Grid Configuration

### Base Grid
- **12-column grid system** (responsive: 12, 10, 6, 4, 2 cols at different breakpoints)
- **Row height**: 100px per grid unit
- **Gutters**: 16px between widgets (handled by react-grid-layout)

### Snap Sizes

Widgets can define **snap sizes** that represent their preferred dimensions in grid units:

#### Common Snap Sizes

| Size | Grid Units (W×H) | Pixel Approx* | Use Case |
|------|------------------|---------------|----------|
| **1×1** | 1 col × 1 row | ~100×100px | Small indicators, icons |
| **2×1** | 2 cols × 1 row | ~200×100px | Compact stats, badges |
| **1×2** | 1 col × 2 rows | ~100×200px | Vertical meters, narrow lists |
| **2×2** | 2 cols × 2 rows | ~200×200px | Small cards, compact widgets |
| **3×2** | 3 cols × 2 rows | ~300×200px | Medium widgets, stat cards |
| **4×2** | 4 cols × 2 rows | ~400×200px | Wide stat displays |
| **4×3** | 4 cols × 3 rows | ~400×300px | Standard widget size |
| **6×2** | 6 cols × 2 rows | ~600×200px | Wide dashboard widgets |
| **6×3** | 6 cols × 3 rows | ~600×300px | Large widgets, charts |
| **6×4** | 6 cols × 4 rows | ~600×400px | Full-width widgets |
| **8×3** | 8 cols × 3 rows | ~800×300px | Extra-wide widgets |
| **12×3** | 12 cols × 3 rows | Full width × 3 rows | Full-width banners |

\* Approximate pixel sizes at 1200px+ viewport width (lg breakpoint)

## Widget Configuration

### In plugin.json

Widgets define their supported snap sizes in the manifest:

```json
{
  "widgets": [
    {
      "id": "my-widget",
      "displayName": "My Widget",
      "description": "A sample widget",
      "icon": "📊",
      "component": "MyWidget",
      "snapSizes": {
        "default": "4x3",
        "supported": ["2x2", "4x2", "4x3", "6x3", "8x3"],
        "min": "2x2",
        "max": "12x4"
      },
      "category": "productivity"
    }
  ]
}
```

### Snap Size Configuration Fields

- **`snapSizes.default`**: The default size when widget is added (e.g., "4x3")
- **`snapSizes.supported`**: Array of snap presets the widget looks best at
- **`snapSizes.min`**: Minimum size (e.g., "2x2") - widget may break below this
- **`snapSizes.max`**: Maximum size (e.g., "12x4") - widget won't grow beyond this
- **`snapSizes.responsive`**: (optional) Boolean to enable responsive behavior

### Backward Compatibility

For legacy widgets without `snapSizes`, the system falls back to:

```javascript
defaultSize: {
  w: 4,  // 4 columns
  h: 3,  // 3 rows
  minW: 2,
  minH: 2
}
```

## Snap Behavior

### 1. Initial Placement
When a widget is added:
- Use `snapSizes.default` to determine initial grid position
- Parse format: "WxH" → `{ w: W, h: H }`
- Place at next available grid position

### 2. Resize Behavior
When a user resizes a widget:
- **Snap to nearest grid unit** (no fractional grid units)
- Constrain to `min` and `max` bounds
- Snap to nearest "supported" size when within threshold (±0.5 grid units)

### 3. Responsive Behavior
At different breakpoints:
- **lg (1200px+)**: 12 columns - full snap sizes available
- **md (996px+)**: 10 columns - scale proportionally
- **sm (768px+)**: 6 columns - 2:1 column reduction
- **xs (480px+)**: 4 columns - vertical stacking
- **xxs (<480px)**: 2 columns - single/double column only

### 4. Layout Compaction
- Use `compactType: "vertical"` to fill gaps
- Prevent collision between widgets
- Auto-adjust when viewport resizes

## CSS Responsiveness

Widgets should implement **internal responsive design** to adapt when:
1. Resized beyond snap sizes
2. Viewport changes breakpoints
3. Content overflows container

### CSS Guidelines

```css
/* Widget container is always 100% of grid cell */
.widget-content {
  width: 100%;
  height: 100%;
  overflow: auto; /* Handle overflow gracefully */
}

/* Use CSS Grid or Flexbox for internal layout */
.widget-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 1rem;
}

/* Responsive typography */
.widget-title {
  font-size: clamp(1rem, 2vw, 1.5rem);
}

/* Hide/show elements based on size */
@container (max-width: 300px) {
  .widget-detail {
    display: none; /* Hide details in small sizes */
  }
}
```

### Container Queries (Recommended)

Use CSS Container Queries for true widget-level responsiveness:

```css
.widget-container {
  container-type: size;
  container-name: widget;
}

@container widget (min-width: 400px) {
  .widget-content {
    grid-template-columns: repeat(2, 1fr);
  }
}

@container widget (min-width: 600px) {
  .widget-content {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

## Implementation Example

### Widget Component (React)

```javascript
function MyWidget({ widgetId }) {
  // Widget receives NO props about size - it adapts via CSS
  return (
    <div className="widget-content">
      <div className="widget-stats">
        {/* Content adapts automatically via CSS Grid/Flexbox */}
        <StatCard label="Tasks" value={42} />
        <StatCard label="Done" value={28} />
        <StatCard label="Pending" value={14} />
      </div>
    </div>
  );
}
```

### Widget CSS

```css
.widget-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
  padding: 1rem;
}

/* Adapt to small sizes */
@container widget (max-width: 300px) {
  .widget-stats {
    grid-template-columns: 1fr; /* Single column */
    gap: 0.5rem;
  }
}

/* Adapt to medium sizes */
@container widget (min-width: 400px) {
  .widget-stats {
    grid-template-columns: repeat(2, 1fr); /* 2 columns */
  }
}

/* Adapt to large sizes */
@container widget (min-width: 600px) {
  .widget-stats {
    grid-template-columns: repeat(3, 1fr); /* 3 columns */
  }
}
```

## Dashboard Layout Configuration

### Dashboard.jsx Setup

```javascript
const ResponsiveGridLayout = WidthProvider(Responsive);

<ResponsiveGridLayout
  className="layout"
  layouts={{ lg: layout }}
  breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
  cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
  rowHeight={100}  // 100px per grid unit
  margin={[16, 16]} // 16px gutters
  containerPadding={[0, 0]}
  onLayoutChange={onLayoutChange}
  draggableHandle=".widget-header"
  compactType="vertical"
  preventCollision={false}
  resizeHandles={['se']} // Southeast corner only
>
```

### Snap Size Parser

```javascript
/**
 * Parse snap size string to grid dimensions
 * @param {string} snapSize - Format: "WxH" (e.g., "4x3")
 * @returns {{ w: number, h: number }}
 */
function parseSnapSize(snapSize) {
  if (!snapSize || typeof snapSize !== 'string') {
    return { w: 4, h: 3 }; // Default fallback
  }

  const [w, h] = snapSize.toLowerCase().split('x').map(Number);

  if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
    return { w: 4, h: 3 }; // Default fallback
  }

  return { w, h };
}
```

## Best Practices

### For Widget Developers

1. **Design for multiple sizes**: Test your widget at all supported snap sizes
2. **Use responsive CSS**: Leverage Grid/Flexbox and Container Queries
3. **Handle overflow**: Use `overflow: auto` and graceful degradation
4. **Test breakpoints**: Ensure widget works at all viewport sizes
5. **Provide fallbacks**: Support browsers without Container Query support

### For Dashboard Users

1. **Start with defaults**: Use the default snap size first
2. **Resize as needed**: Drag resize handles to adjust
3. **Snap to supported sizes**: System will guide you to optimal sizes
4. **Check mobile view**: Preview dashboard on different devices

## Future Enhancements

- **Snap Guidelines**: Visual indicators during resize
- **Size Presets Menu**: Quick-select from supported sizes
- **Layout Templates**: Pre-configured dashboard layouts
- **Widget Recommendations**: Suggest optimal sizes based on content
- **Auto-layout**: AI-powered automatic widget arrangement
- **Responsive Previews**: Test different viewport sizes in real-time

---

**Last Updated**: 2026-01-13
**Version**: 1.0.0
