import { useState, useCallback, useEffect, useRef } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";

// ─────────────────────────────────────────────
// Initial tree data (depth 4)
// ─────────────────────────────────────────────
const INITIAL_TREE = {
  id: "root",
  label: "Root",
  meta: "Top-level node",
  children: [
    {
      id: "A",
      label: "Node A",
      meta: "Branch A",
      children: [
        { id: "A1", label: "A1", meta: "Leaf", children: [] },
        { id: "A2", label: "A2", meta: "Leaf", children: [] },
        { id: "A3", label: "A3", meta: "Leaf", children: [] },
      ],
    },
    {
      id: "B",
      label: "Node B",
      meta: "Branch B",
      children: [
        {
          id: "B1",
          label: "B1",
          meta: "Sub-branch",
          children: [
            { id: "B1a", label: "B1-α", meta: "Deep leaf", children: [] },
            { id: "B1b", label: "B1-β", meta: "Deep leaf", children: [] },
          ],
        },
        { id: "B2", label: "B2", meta: "Leaf", children: [] },
      ],
    },
    {
      id: "C",
      label: "Node C",
      meta: "Branch C",
      children: [
        { id: "C1", label: "C1", meta: "Leaf", children: [] },
        { id: "C2", label: "C2", meta: "Leaf", children: [] },
      ],
    },
    {
      id: "D",
      label: "Node D",
      meta: "Leaf branch",
      children: [],
    },
  ],
};

// ─────────────────────────────────────────────
// Layout engine: assigns x/y to each node
// ─────────────────────────────────────────────
const NODE_W = 140;
const NODE_H = 52;
const H_GAP = 28;   // horizontal gap between siblings
const V_GAP = 90;   // vertical gap between levels

function getVisibleSubtree(node, collapsed) {
  if (collapsed.has(node.id)) {
    return { ...node, children: [] };
  }
  return {
    ...node,
    children: node.children.map((c) => getVisibleSubtree(c, collapsed)),
  };
}

function measureWidth(node) {
  if (!node.children || node.children.length === 0) return NODE_W;
  const total = node.children.reduce((sum, c) => sum + measureWidth(c), 0);
  const gaps = (node.children.length - 1) * H_GAP;
  return Math.max(NODE_W, total + gaps);
}

function assignPositions(node, x, y, positions) {
  const w = measureWidth(node);
  positions[node.id] = { x: x + w / 2 - NODE_W / 2, y };

  if (node.children && node.children.length > 0) {
    let cursor = x;
    for (const child of node.children) {
      const cw = measureWidth(child);
      assignPositions(child, cursor, y + NODE_H + V_GAP, positions);
      cursor += cw + H_GAP;
    }
  }
}

function buildLayout(tree, collapsed) {
  const visible = getVisibleSubtree(tree, collapsed);
  const positions = {};
  assignPositions(visible, 0, 0, positions);
  return positions;
}

// ─────────────────────────────────────────────
// Flatten tree → nodes & edges for ReactFlow
// ─────────────────────────────────────────────
function flattenTree(node, collapsed, positions, selected, hovered, search, result = { nodes: [], edges: [] }) {
  const pos = positions[node.id];
  const hasChildren = node.children && node.children.length > 0;
  const isCollapsed = collapsed.has(node.id);
  const matchesSearch = search && node.label.toLowerCase().includes(search.toLowerCase());

  result.nodes.push({
    id: node.id,
    type: "treeNode",
    position: pos ? { x: pos.x, y: pos.y } : { x: 0, y: 0 },
    data: {
      label: node.label,
      meta: node.meta,
      hasChildren: hasChildren || isCollapsed,
      isCollapsed,
      isSelected: selected === node.id,
      isHovered: hovered === node.id,
      matchesSearch,
      childCount: node.children?.length ?? 0,
    },
  });

  if (node.children) {
    for (const child of node.children) {
      result.edges.push({
        id: `e-${node.id}-${child.id}`,
        source: node.id,
        target: child.id,
        type: "smoothstep",
        animated: false,
        style: { stroke: "#6b7280", strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#6b7280", width: 12, height: 12 },
      });
      flattenTree(child, collapsed, positions, selected, hovered, search, result);
    }
  }

  return result;
}

function flattenCollapsed(tree, collapsed, positions, selected, hovered, search) {
  const visible = getVisibleSubtree(tree, collapsed);
  return flattenTree(visible, collapsed, positions, selected, hovered, search);
}

// ─────────────────────────────────────────────
// Custom Node Component
// ─────────────────────────────────────────────
function TreeNode({ data, id }) {
  const { label, meta, hasChildren, isCollapsed, isSelected, isHovered, matchesSearch, childCount } = data;

  const ring = isSelected
    ? "0 0 0 3px #f59e0b"
    : isHovered
    ? "0 0 0 2px #60a5fa"
    : matchesSearch
    ? "0 0 0 3px #34d399"
    : "none";

  const bg = isSelected
    ? "linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%)"
    : isHovered
    ? "linear-gradient(135deg, #1c2a3a 0%, #1e3a5f 100%)"
    : matchesSearch
    ? "linear-gradient(135deg, #064e3b 0%, #065f46 100%)"
    : "linear-gradient(135deg, #1e2d3d 0%, #243447 100%)";

  return (
    <div
      style={{
        width: NODE_W,
        height: NODE_H,
        borderRadius: 8,
        background: bg,
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: ring !== "none" ? ring + ", 0 4px 20px rgba(0,0,0,0.4)" : "0 4px 20px rgba(0,0,0,0.3)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "all 0.2s ease",
        position: "relative",
        userSelect: "none",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, pointerEvents: "none" }} />

      {/* Label */}
      <span style={{
        color: matchesSearch ? "#6ee7b7" : "#e2e8f0",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: 0.3,
        lineHeight: 1.2,
      }}>
        {label}
      </span>

      {/* Meta */}
      <span style={{
        color: "#64748b",
        fontFamily: "'IBM Plex Sans', sans-serif",
        fontSize: 10,
        marginTop: 2,
      }}>
        {meta}
      </span>

      {/* Expand/Collapse badge */}
      {hasChildren && (
        <div
          style={{
            position: "absolute",
            bottom: -11,
            left: "50%",
            transform: "translateX(-50%)",
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: isCollapsed ? "#f59e0b" : "#3b82f6",
            border: "2px solid #0f172a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
            boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
            transition: "background 0.2s",
          }}
        >
          <span style={{
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1,
            marginTop: isCollapsed ? 0 : -1,
          }}>
            {isCollapsed ? "+" : "−"}
          </span>
        </div>
      )}

      {/* Child count chip when collapsed */}
      {isCollapsed && childCount > 0 && (
        <div style={{
          position: "absolute",
          top: -8,
          right: -8,
          background: "#f59e0b",
          borderRadius: 10,
          padding: "1px 6px",
          fontSize: 10,
          fontWeight: 700,
          color: "#0f172a",
          fontFamily: "'IBM Plex Mono', monospace",
          border: "2px solid #0f172a",
        }}>
          {childCount}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, pointerEvents: "none" }} />
    </div>
  );
}

const nodeTypes = { treeNode: TreeNode };

// ─────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────
export default function TreeVisualizer() {
  const [collapsed, setCollapsed] = useState(new Set());
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [search, setSearch] = useState("");
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const rfRef = useRef(null);

  // Rebuild layout whenever collapsed / search changes
  useEffect(() => {
    const positions = buildLayout(INITIAL_TREE, collapsed);
    const { nodes: n, edges: e } = flattenCollapsed(INITIAL_TREE, collapsed, positions, selected, hovered, search);
    setNodes(n);
    setEdges(e);
  }, [collapsed, selected, hovered, search]);

  // Handle node click: toggle collapse OR select
  const onNodeClick = useCallback((evt, node) => {
    const { hasChildren } = node.data;
    if (hasChildren) {
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(node.id)) next.delete(node.id);
        else next.add(node.id);
        return next;
      });
    }
    setSelected((prev) => (prev === node.id ? null : node.id));
  }, []);

  const onNodeMouseEnter = useCallback((evt, node) => setHovered(node.id), []);
  const onNodeMouseLeave = useCallback(() => setHovered(null), []);

  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => {
    const ids = new Set();
    function collect(n) {
      if (n.children && n.children.length > 0) {
        ids.add(n.id);
        n.children.forEach(collect);
      }
    }
    collect(INITIAL_TREE);
    setCollapsed(ids);
  };

  return (
    <div style={{
      width: "100vw",
      height: "100vh",
      background: "#0a0f1a",
      fontFamily: "'IBM Plex Sans', sans-serif",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@300;400;600&display=swap');
        .react-flow__attribution { display: none; }
        .react-flow__controls button {
          background: #1e2d3d !important;
          border-color: #334155 !important;
          color: #94a3b8 !important;
        }
        .react-flow__controls button:hover {
          background: #243447 !important;
        }
        .react-flow__minimap {
          background: #0f172a !important;
          border: 1px solid #1e2d3d !important;
          border-radius: 8px !important;
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Header */}
      <div style={{
        padding: "14px 24px",
        background: "rgba(10,15,26,0.95)",
        borderBottom: "1px solid #1e2d3d",
        display: "flex",
        alignItems: "center",
        gap: 20,
        backdropFilter: "blur(10px)",
        zIndex: 100,
        flexShrink: 0,
      }}>
        {/* Logo / Title */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="2.5" r="2" fill="white"/>
              <circle cx="2.5" cy="13" r="2" fill="white"/>
              <circle cx="13.5" cy="13" r="2" fill="white"/>
              <line x1="8" y1="4.5" x2="2.5" y2="11" stroke="white" strokeWidth="1.2"/>
              <line x1="8" y1="4.5" x2="13.5" y2="11" stroke="white" strokeWidth="1.2"/>
            </svg>
          </div>
          <span style={{ color: "#e2e8f0", fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, fontWeight: 600, letterSpacing: 0.5 }}>
            TreeFlow
          </span>
        </div>

        {/* Search */}
        <div style={{ position: "relative", flex: 1, maxWidth: 280 }}>
          <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", opacity: 0.4 }}
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search nodes…"
            style={{
              width: "100%",
              paddingLeft: 32, paddingRight: 12, paddingTop: 7, paddingBottom: 7,
              background: "#111827",
              border: "1px solid #1e2d3d",
              borderRadius: 8,
              color: "#e2e8f0",
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontSize: 13,
              outline: "none",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
            onBlur={(e) => e.target.style.borderColor = "#1e2d3d"}
          />
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
          {[
            { label: "Expand All", action: expandAll, color: "#3b82f6" },
            { label: "Collapse All", action: collapseAll, color: "#f59e0b" },
          ].map(({ label, action, color }) => (
            <button
              key={label}
              onClick={action}
              style={{
                padding: "6px 14px",
                background: "transparent",
                border: `1px solid ${color}`,
                borderRadius: 7,
                color: color,
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 0.15s",
                letterSpacing: 0.3,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = color + "22"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          {[
            { color: "#3b82f6", label: "Expanded" },
            { color: "#f59e0b", label: "Collapsed" },
            { color: "#34d399", label: "Match" },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
              <span style={{ color: "#64748b", fontSize: 11, fontFamily: "'IBM Plex Sans', sans-serif" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* React Flow canvas */}
      <div style={{ flex: 1, position: "relative" }}>
        <ReactFlow
          ref={rfRef}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.2}
          maxZoom={2}
          defaultEdgeOptions={{ type: "smoothstep" }}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#1e2d3d" gap={28} size={1} variant="dots" />
          <Controls style={{ bottom: 20, left: 20 }} />
          <MiniMap
            nodeColor={(n) =>
              n.data?.isSelected ? "#f59e0b" :
              n.data?.matchesSearch ? "#34d399" :
              "#1e3a5f"
            }
            maskColor="rgba(10,15,26,0.8)"
            style={{ bottom: 20, right: 20, borderRadius: 8 }}
          />
        </ReactFlow>

        {/* Selected node info panel */}
        {selected && (() => {
          const find = (n) => {
            if (n.id === selected) return n;
            for (const c of n.children || []) {
              const r = find(c);
              if (r) return r;
            }
            return null;
          };
          const node = find(INITIAL_TREE);
          if (!node) return null;
          return (
            <div style={{
              position: "absolute",
              top: 16,
              right: 16,
              background: "rgba(15,23,42,0.95)",
              border: "1px solid #1e3a5f",
              borderRadius: 10,
              padding: "14px 18px",
              minWidth: 180,
              backdropFilter: "blur(12px)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              zIndex: 50,
            }}>
              <div style={{ color: "#64748b", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>
                Selected Node
              </div>
              <div style={{ color: "#e2e8f0", fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                {node.label}
              </div>
              <div style={{ color: "#64748b", fontSize: 12, marginBottom: 8 }}>{node.meta}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ background: "#1e2d3d", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "#94a3b8", fontFamily: "'IBM Plex Mono', monospace" }}>
                  id: <span style={{ color: "#60a5fa" }}>{node.id}</span>
                </div>
                <div style={{ background: "#1e2d3d", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "#94a3b8", fontFamily: "'IBM Plex Mono', monospace" }}>
                  children: <span style={{ color: "#f59e0b" }}>{node.children?.length ?? 0}</span>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{
                  marginTop: 10,
                  width: "100%",
                  padding: "5px 0",
                  background: "transparent",
                  border: "1px solid #334155",
                  borderRadius: 6,
                  color: "#64748b",
                  fontSize: 11,
                  cursor: "pointer",
                  fontFamily: "'IBM Plex Mono', monospace",
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = "#94a3b8"}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = "#334155"}
              >
                Deselect
              </button>
            </div>
          );
        })()}

        {/* Hint */}
        <div style={{
          position: "absolute",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          color: "#334155",
          fontSize: 11,
          fontFamily: "'IBM Plex Mono', monospace",
          letterSpacing: 0.5,
          pointerEvents: "none",
        }}>
          Click a node to select · Click ± badge to expand/collapse
        </div>
      </div>
    </div>
  );
}
