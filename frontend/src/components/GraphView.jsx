import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import * as d3 from 'd3';
import { useStore } from '../store';
import { getNodeColor } from '../utils/colors';
import { buildHierarchy, getVisibleItems, aggregateClusterState } from '../utils/clustering';

export default function GraphView({ source = 'active' }) {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const simRef = useRef(null);
  const nodesDataRef = useRef([]);
  const transformRef = useRef(d3.zoomIdentity);
  const hoveredRef = useRef(null);

  // Store access
  const baseline = useStore((s) => s.baseline);
  const scenario = useStore((s) => s.scenario);
  const activeNodes = useStore((s) => s.nodes);
  const activeEdgesSrc = useStore((s) => s.edgesSrc);
  const activeEdgesDst = useStore((s) => s.edgesDst);

  // Sync state
  const sharedTransform = useStore((s) => s.graphTransform);
  const setSharedTransform = useStore((s) => s.setGraphTransform);
  const sharedHoveredId = useStore((s) => s.graphHoveredId);
  const setSharedHoveredId = useStore((s) => s.setGraphHoveredId);

  const currentDay = useStore((s) => s.currentDay);
  const currentClusterId = useStore((s) => s.currentClusterId);
  const drillInto = useStore((s) => s.drillInto);
  const breadcrumbs = useStore((s) => s.breadcrumbs);
  const navigateTo = useStore((s) => s.navigateTo);

  const [tooltip, setTooltip] = useState(null);

  // Resolve which data to use
  const nodes = useMemo(() => {
    if (source === 'baseline') return baseline?.nodes || [];
    if (source === 'scenario') return scenario?.nodes || [];
    return activeNodes;
  }, [source, baseline, scenario, activeNodes]);

  const edgesSrc = useMemo(() => {
    if (source === 'baseline') return baseline?.edges_src || [];
    if (source === 'scenario') return scenario?.edges_src || [];
    return activeEdgesSrc;
  }, [source, baseline, scenario, activeEdgesSrc]);

  const edgesDst = useMemo(() => {
    if (source === 'baseline') return baseline?.edges_dst || [];
    if (source === 'scenario') return scenario?.edges_dst || [];
    return activeEdgesDst;
  }, [source, baseline, scenario, activeEdgesDst]);

  // Build hierarchy once
  const hierarchy = useMemo(() => {
    if (!nodes.length) return null;
    return buildHierarchy(nodes, edgesSrc, edgesDst);
  }, [nodes, edgesSrc, edgesDst]);

  // Get visible items at current cluster level
  const visibleItems = useMemo(() => {
    if (!hierarchy) return [];
    return getVisibleItems(hierarchy, currentClusterId);
  }, [hierarchy, currentClusterId]);

  // Compute edges between visible items (clusters or nodes)
  const visibleEdges = useMemo(() => {
    if (!visibleItems.length || !edgesSrc.length) return [];

    const nodeToVisibleIndex = new Map();
    visibleItems.forEach((item, idx) => {
      item.nodeIds.forEach(nid => {
        nodeToVisibleIndex.set(nid, idx);
      });
    });

    const seen = new Set();
    const result = [];
    for (let i = 0; i < edgesSrc.length; i++) {
      const u = edgesSrc[i];
      const v = edgesDst[i];
      const idxU = nodeToVisibleIndex.get(u);
      const idxV = nodeToVisibleIndex.get(v);

      if (idxU !== undefined && idxV !== undefined && idxU !== idxV) {
        const pair = idxU < idxV ? `${idxU}_${idxV}` : `${idxV}_${idxU}`;
        if (!seen.has(pair)) {
          seen.add(pair);
          result.push([idxU, idxV]);
        }
      }
    }
    return result;
  }, [visibleItems, edgesSrc, edgesDst]);

  const nodeLookup = useMemo(() => {
    const m = new Map();
    nodes.forEach(n => m.set(n.id, n));
    return m;
  }, [nodes]);

  // Update transformRef when shared state changes
  useEffect(() => {
    transformRef.current = new d3.ZoomTransform(sharedTransform.k, sharedTransform.x, sharedTransform.y);
  }, [sharedTransform]);

  // Update hoveredRef when shared hover changes
  useEffect(() => {
    const found = nodesDataRef.current.find(n => n._origId === sharedHoveredId);
    hoveredRef.current = found;
  }, [sharedHoveredId]);

  // Draw loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const t = transformRef.current;
    const day = useStore.getState().currentDay;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.scale(t.k, t.k);

    const simNodes = nodesDataRef.current;

    // Draw edges
    const isNodeLevel = simNodes.length > 0 && simNodes[0]._type === 'node';
    ctx.strokeStyle = isNodeLevel ? 'rgba(120,120,160,0.3)' : 'rgba(100,100,140,0.15)';
    ctx.lineWidth = isNodeLevel ? 1.2 : 0.8;
    for (const [srcIdx, dstIdx] of visibleEdges) {
      const u = simNodes[srcIdx];
      const v = simNodes[dstIdx];
      if (!u || !v) continue;

      ctx.beginPath();
      ctx.moveTo(u.x, u.y);
      ctx.lineTo(v.x, v.y);
      ctx.stroke();
    }

    // Draw nodes
    for (const n of simNodes) {
      const state = n._type === 'node'
        ? nodeLookup.get(n._origId)?.days?.[day]
        : aggregateClusterState(n._nodeIds, nodeLookup, day);

      const color = getNodeColor(state);
      const r = n._radius;

      // Glow
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 3, 0, Math.PI * 2);
      ctx.fillStyle = color.replace('rgb', 'rgba').replace(')', ',0.15)');
      ctx.fill();

      // Node
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Border
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Cluster count label
      if (n._type === 'cluster' && n._count > 1) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = `bold ${Math.max(8, r * 0.6)}px Inter`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(n._count > 999 ? `${(n._count / 1000).toFixed(1)}k` : String(n._count), n.x, n.y);
      }
    }

    // Highlight hovered
    const hovered = hoveredRef.current;
    if (hovered) {
      ctx.beginPath();
      ctx.arc(hovered.x, hovered.y, hovered._radius + 5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  }, [nodes, visibleEdges, nodeLookup]);

  // Setup simulation and interactions
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper || !visibleItems.length) return;

    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight;
    canvas.width = w;
    canvas.height = h;

    const simNodes = visibleItems.map((item, idx) => {
      const isNode = item.type === 'node' && item.count === 1;
      const count = item.count || 1;
      const radius = isNode ? 5 : Math.max(7, Math.min(32, Math.sqrt(count) * 1.8));

      // Deterministic initial layout (spiral/circle based on index)
      const angle = idx * (Math.PI * 2 / Math.min(visibleItems.length, 50));
      const dist = 50 + idx * 2;

      return {
        x: w / 2 + Math.cos(angle) * dist,
        y: h / 2 + Math.sin(angle) * dist,
        _origId: isNode ? (item.nodeIds?.[0] ?? item.id) : item.id,
        _type: isNode ? 'node' : 'cluster',
        _count: count,
        _nodeIds: item.nodeIds || [],
        _radius: radius,
        _item: item,
      };
    });
    nodesDataRef.current = simNodes;

    // Force simulation
    if (simRef.current) simRef.current.stop();
    const sim = d3.forceSimulation(simNodes)
      .force('center', d3.forceCenter(w / 2, h / 2))
      .force('charge', d3.forceManyBody().strength(-100))
      .force('collision', d3.forceCollide().radius(d => d._radius + 5))
      .force('x', d3.forceX(w / 2).strength(0.05))
      .force('y', d3.forceY(h / 2).strength(0.05))
      .alphaDecay(0.05)
      .on('tick', draw);
    simRef.current = sim;

    // Zoom
    const zoom = d3.zoom()
      .scaleExtent([0.2, 8])
      .on('zoom', (e) => {
        transformRef.current = e.transform;
        setSharedTransform({ x: e.transform.x, y: e.transform.y, k: e.transform.k });
        draw();
      });
    const zoomSelection = d3.select(canvas);
    zoomSelection.call(zoom);

    // Initial "zoom in" effect when entering a level
    zoomSelection.transition().duration(800)
      .call(zoom.transform, d3.zoomIdentity);

    // Hit detection
    const findNode = (mx, my) => {
      const t = transformRef.current;
      const px = (mx - t.x) / t.k;
      const py = (my - t.y) / t.k;
      for (let i = simNodes.length - 1; i >= 0; i--) {
        const n = simNodes[i];
        const dx = px - n.x, dy = py - n.y;
        if (dx * dx + dy * dy < (n._radius + 8 / t.k) ** 2) return n;
      }
      return null;
    };

    const handleMouseMove = (e) => {
      const [mx, my] = d3.pointer(e);
      const found = findNode(mx, my);
      hoveredRef.current = found;
      setSharedHoveredId(found?._origId || null);
      canvas.style.cursor = found ? 'pointer' : 'grab';

      if (found) {
        const day = useStore.getState().currentDay;
        const state = found._type === 'node'
          ? nodeLookup.get(found._origId)?.days?.[day]
          : aggregateClusterState(found._nodeIds, nodeLookup, day);

        setTooltip({
          x: e.clientX, y: e.clientY,
          type: found._type,
          count: found._count,
          id: found._origId,
          state,
        });
      } else {
        setTooltip(null);
      }
      draw();
    };

    const handleClick = (e) => {
      const [mx, my] = d3.pointer(e);
      const found = findNode(mx, my);
      if (found && found._type === 'cluster' && found._item.children) {
        const t = transformRef.current;
        const targetScale = t.k * 3;
        const targetX = w / 2 - found.x * targetScale;
        const targetY = h / 2 - found.y * targetScale;

        zoomSelection.transition().duration(700)
          .call(zoom.transform, d3.zoomIdentity.translate(targetX, targetY).scale(targetScale))
          .on('end', () => {
            drillInto(found._item.id, `Cluster (${found._count})`);
            setTooltip(null);
          });
      }
    };

    zoomSelection.on('mousemove', handleMouseMove);
    zoomSelection.on('click', handleClick);
    zoomSelection.on('mouseleave', () => {
      hoveredRef.current = null;
      setSharedHoveredId(null);
      setTooltip(null);
      draw();
    });

    return () => {
      sim.stop();
      zoomSelection.on('.zoom', null);
      zoomSelection.on('mousemove', null);
      zoomSelection.on('click', null);
      zoomSelection.on('mouseleave', null);
    };
  }, [visibleItems, draw, drillInto, nodes, setSharedTransform, setSharedHoveredId]);

  // Redraw when day changes
  useEffect(() => { draw(); }, [currentDay, draw]);

  return (
    <div ref={wrapperRef} className="w-full h-full relative cursor-crosshair">
      {/* Technical Grid Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-20"
        style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

      {/* Crosshairs */}
      <div className="absolute top-1/2 left-0 w-full h-px bg-white/5 pointer-events-none" />
      <div className="absolute left-1/2 top-0 w-px h-full bg-white/5 pointer-events-none" />

      {/* Source Label */}
      <div className="absolute top-4 right-4 z-10 bg-black/80 px-3 py-1 border border-white/10 text-[9px] font-black uppercase text-indigo-400 tracking-[0.2em] flex items-center gap-2">
        <div className={`w-1 h-1 ${source === 'baseline' ? 'bg-slate-500' : 'bg-rose-500 animate-pulse'}`} />
        ID::{source.toUpperCase()}
      </div>

      {/* Breadcrumbs */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-0 bg-black/60 border border-white/10 p-0.5">
        {breadcrumbs.map((bc, i) => (
          <span key={i} className="flex items-center">
            {i > 0 && <span className="text-slate-700 px-1 text-[10px]">/</span>}
            <button
              onClick={() => navigateTo(i)}
              className={`text-[9px] px-3 py-1.5 transition-all font-black uppercase tracking-widest
                ${i === breadcrumbs.length - 1
                  ? 'text-indigo-400 bg-indigo-500/10'
                  : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
            >
              {bc.label}
            </button>
          </span>
        ))}
      </div>

      <canvas ref={canvasRef} className="w-full h-full" />

      {/* Tooltip Portal */}
      {tooltip && createPortal(
        <div
          className="fixed z-[200] bg-[#0a0a0f]/95 backdrop-blur-2xl rounded-2xl p-4 pointer-events-none max-w-xs border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
          style={{ left: tooltip.x + 20, top: tooltip.y - 20 }}
        >
          {tooltip.type === 'node' ? (
            <div>
              <div className="text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">Node Identification · #{tooltip.id}</div>
              <div className="grid grid-cols-5 gap-3 text-center">
                {['S', 'E', 'I', 'R', 'D'].map((k) => (
                  <div key={k}>
                    <div className="text-[9px] font-black text-slate-500 uppercase mb-1">{k}</div>
                    <div className="text-xs font-black text-white font-mono">
                      {((tooltip.state?.[k] || 0) * 100).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="text-[10px] font-black text-indigo-400 mb-2 uppercase tracking-widest">
                Cluster Level · {tooltip.count.toLocaleString()} Nodes
              </div>
              <div className="grid grid-cols-5 gap-3 text-center">
                {['S', 'E', 'I', 'R', 'D'].map((k) => (
                  <div key={k}>
                    <div className="text-[9px] font-black text-slate-500 uppercase mb-1">{k}</div>
                    <div className="text-xs font-black text-white font-mono">
                      {((tooltip.state?.[k] || 0) * 100).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-[9px] font-black text-indigo-500 mt-3 uppercase tracking-tighter animate-pulse">Click to explore cluster →</div>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
