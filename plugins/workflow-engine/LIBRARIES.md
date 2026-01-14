# Workflow Engine Libraries Guide

This document describes the professional libraries installed to enhance the workflow engine.

## 📦 Installed Libraries

### 1. React Flow (v11.11.4)
**Purpose**: Professional node-based workflow UI

**What it provides:**
- Pre-built node rendering system
- Auto-layout algorithms
- Zoom and pan controls
- Mini-map component
- Connection validation
- Drag-and-drop support
- Performance optimizations

**Current Usage**: Not yet integrated (using custom implementation)

**Integration Plan:**
```javascript
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';

// Example usage:
function WorkflowCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), []);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
    >
      <Controls />
      <MiniMap />
      <Background variant="dots" gap={12} size={1} />
    </ReactFlow>
  );
}
```

**Benefits:**
- Professional UI out of the box
- Better performance with large workflows
- Built-in controls (zoom, pan, fit view)
- Mini-map for large workflows
- Node snapping and alignment
- Custom node types support

---

### 2. CodeMirror 6 (v6.x)
**Purpose**: Professional code editor for transform nodes

**Installed packages:**
- `@codemirror/state` (v6.5.4) - Editor state management
- `@codemirror/view` (v6.39.11) - Editor view layer
- `@codemirror/lang-javascript` (v6.2.4) - JavaScript syntax
- `@codemirror/theme-one-dark` (v6.1.3) - Dark theme
- `@codemirror/basic-setup` (v0.20.0) - Basic editor setup

**Current Usage**: Not yet integrated (using textarea)

**Integration Example:**
```javascript
import { EditorView, basicSetup } from '@codemirror/basic-setup';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';

function CodeEditor({ value, onChange }) {
  const editorRef = useRef(null);

  useEffect(() => {
    if (!editorRef.current) return;

    const view = new EditorView({
      doc: value,
      extensions: [
        basicSetup,
        javascript(),
        oneDark,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        }),
      ],
      parent: editorRef.current,
    });

    return () => view.destroy();
  }, []);

  return <div ref={editorRef} />;
}
```

**Benefits:**
- Syntax highlighting
- Auto-completion
- Code folding
- Line numbers
- Bracket matching
- Multiple cursors
- Undo/redo history
- Search and replace

---

### 3. date-fns (v4.1.0)
**Purpose**: Modern date/time library for cron expressions

**Current Usage**: Not yet integrated

**Use Cases:**
1. **Validate cron expressions:**
```javascript
import { isValid, parse } from 'date-fns';

function validateCronExpression(cronExpr) {
  // Parse and validate cron expression
  // Example: "0 9 * * *" -> 9:00 AM daily
  try {
    const parts = cronExpr.split(' ');
    if (parts.length !== 5) return false;
    return true;
  } catch (e) {
    return false;
  }
}
```

2. **Calculate next run time:**
```javascript
import { addMinutes, addHours, addDays, format } from 'date-fns';

function calculateNextRun(cronExpr) {
  const now = new Date();
  // Parse cron and calculate next execution
  const nextRun = addHours(now, 1); // Simplified
  return format(nextRun, 'PPpp');
}
```

3. **Format execution timestamps:**
```javascript
import { formatDistanceToNow, format } from 'date-fns';

// Show "2 hours ago" instead of raw timestamp
const relativeTime = formatDistanceToNow(new Date(execution.start_time), { addSuffix: true });

// Format: "Jan 14, 2026 at 3:30 PM"
const absoluteTime = format(new Date(execution.start_time), 'PPpp');
```

**Benefits:**
- Immutable & pure functions
- Tree-shakeable (only imports what you use)
- TypeScript support
- i18n support
- Better than native Date object

---

### 4. Zod (v4.3.5)
**Purpose**: TypeScript-first schema validation

**Current Usage**: Not yet integrated

**Integration Examples:**

1. **Validate workflow data:**
```javascript
import { z } from 'zod';

const WorkflowSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  enabled: z.boolean(),
  schedule: z.string().regex(/^(\*|[0-9]+)\s+(\*|[0-9]+)\s+(\*|[0-9]+)\s+(\*|[0-9]+)\s+(\*|[0-9]+)$/, "Invalid cron expression").optional(),
  nodes: z.array(z.object({
    id: z.string(),
    type: z.enum(['trigger', 'plugin-action', 'condition', 'delay', 'transform']),
    position: z.object({
      x: z.number(),
      y: z.number()
    }),
    data: z.record(z.any())
  })),
  edges: z.array(z.object({
    id: z.string(),
    source: z.string(),
    target: z.string()
  }))
});

// Validate before saving
try {
  const validatedWorkflow = WorkflowSchema.parse(workflowData);
  await saveWorkflow(validatedWorkflow);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('Validation errors:', error.errors);
  }
}
```

2. **Validate node configurations:**
```javascript
const TriggerNodeSchema = z.object({
  triggerType: z.enum(['schedule', 'webhook', 'manual']),
  webhookPlugin: z.string().optional(),
});

const AIAgentNodeSchema = z.object({
  plugin: z.literal('ai-agent'),
  actionId: z.literal('ask'),
  promptTemplate: z.string().min(1, "Prompt template is required"),
});

const TransformNodeSchema = z.object({
  code: z.string().min(1, "Code is required"),
});
```

**Benefits:**
- Type-safe validation
- Automatic TypeScript type inference
- Detailed error messages
- Composable schemas
- Works with forms
- Runtime type checking

---

## 🚀 Migration Path

### Phase 1: CodeMirror Integration (Quick Win)
**Priority**: High
**Effort**: Low
**Impact**: High

Replace textarea in transform nodes with CodeMirror for immediate improvement:
- Syntax highlighting
- Better editing experience
- Professional appearance

### Phase 2: date-fns Integration (Quick Win)
**Priority**: Medium
**Effort**: Low
**Impact**: Medium

Add cron validation and better time formatting:
- Validate cron expressions before saving
- Show "next run" times in human-readable format
- Format execution timestamps

### Phase 3: Zod Validation (Important)
**Priority**: High
**Effort**: Medium
**Impact**: High

Add schema validation for:
- Workflow creation/update
- Node configuration
- API requests
- Form inputs

### Phase 4: React Flow Migration (Major Refactor)
**Priority**: Low
**Effort**: High
**Impact**: Very High

Full rewrite of canvas component:
- Replace custom canvas with React Flow
- Migrate node components
- Update connection logic
- Add mini-map
- Add controls

**Note**: Keep current implementation working during migration.

---

## 📚 Documentation Links

- **React Flow**: https://reactflow.dev/
- **CodeMirror**: https://codemirror.net/
- **date-fns**: https://date-fns.org/
- **Zod**: https://zod.dev/

---

## 💡 Quick Start Examples

### Using CodeMirror in Transform Node

```javascript
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';

// In NodeProperties component, replace textarea:
const [editorView, setEditorView] = useState(null);

useEffect(() => {
  if (!editorRef.current || editorView) return;

  const view = new EditorView({
    doc: data.code || '',
    extensions: [
      basicSetup,
      javascript(),
      oneDark,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          setData({ ...data, code: update.state.doc.toString() });
        }
      }),
    ],
    parent: editorRef.current,
  });

  setEditorView(view);
  return () => view.destroy();
}, []);
```

### Using Zod for Validation

```javascript
import { z } from 'zod';

// In saveWorkflow function:
const WorkflowSchema = z.object({
  name: z.string().min(1, "Workflow name is required"),
  nodes: z.array(z.any()).min(1, "Add at least one node"),
  edges: z.array(z.any()),
  schedule: z.string().regex(/^(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)$/).optional().or(z.literal('')),
});

try {
  WorkflowSchema.parse(currentWorkflow);
  // Continue with save
} catch (error) {
  alert(`Validation failed: ${error.errors.map(e => e.message).join(', ')}`);
  return;
}
```

### Using date-fns for Time Formatting

```javascript
import { formatDistanceToNow } from 'date-fns';

// In ExecutionsPanel:
<span className="text-xs text-text-muted">
  {formatDistanceToNow(new Date(execution.start_time), { addSuffix: true })}
</span>
```

---

## 🎯 Recommended Next Steps

1. ✅ **Installed**: All libraries (Done)
2. 🚧 **Add CodeMirror** to Transform node code editor
3. 🚧 **Add Zod validation** to workflow save
4. 🚧 **Add date-fns** formatting to execution logs
5. 🔜 **Consider React Flow** migration for better UX

---

## 📝 Notes

- All libraries are compatible with React 19
- CodeMirror 6 uses a completely new API (not compatible with v5)
- React Flow v11 is the latest major version
- Zod is TypeScript-first but works fine with JavaScript
- date-fns v4 is ESM-first (use named imports)

---

*Last updated: 2026-01-14*
