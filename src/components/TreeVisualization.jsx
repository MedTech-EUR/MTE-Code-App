import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { AppIcon } from './AppIcons';
import { TREE_DATA } from '../data/treeData';

const OUTCOME_COLORS = {
  'compliant':     { bg: '#dcfce7', border: '#86efac', text: '#166534' },
  'non-compliant': { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b' },
  'conditional':   { bg: '#fffbeb', border: '#fcd34d', text: '#92400e' },
  'consult-legal': { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af' },
  'not-required':  { bg: '#f0fdfa', border: '#5eead4', text: '#115e59' },
  'out-of-scope':  { bg: '#faf5ff', border: '#d8b4fe', text: '#6b21a8' },
  'not-applicable':{ bg: '#faf5ff', border: '#d8b4fe', text: '#6b21a8' },
  'prior-review':  { bg: '#faf5ff', border: '#d8b4fe', text: '#6b21a8' },
  'in-scope':      { bg: '#e0e7ff', border: '#a5b4fc', text: '#3730a3' },
  'more-info':     { bg: '#f9fafb', border: '#d1d5db', text: '#1f2937' },
};

/* ------------------------------------------------------------------ */
/*  Adaptive layout engine with text-length-based sizing               */
/* ------------------------------------------------------------------ */

const NODE_GAP_X = 36;
const CONNECTOR_DROP = 20; // vertical drop from parent to horizontal rail

// Estimate height needed for a block of text at ~10px font in a box of given width
function estimateTextHeight(text, boxWidth, fontSize = 10) {
  const charsPerLine = Math.floor(boxWidth / (fontSize * 0.58));
  const lines = Math.ceil((text || '').length / Math.max(charsPerLine, 1));
  return Math.max(lines, 1) * (fontSize + 4); // line-height ~14px for 10px font
}

function computeLayout(nodeId, nodeMap, depth = 0) {
  const node = nodeMap[nodeId];
  if (!node) return { width: 0, height: 0, elements: [], connectors: [], rootX: 0, rootY: 0 };

  const nodeW = node.type === 'result' ? 240 : 280;
  const padding = 28; // internal padding

  // Compute adaptive height
  let nodeH;
  if (node.type === 'result') {
    const labelLine = 16;
    const textH = estimateTextHeight(node.text, nodeW - padding, 10);
    nodeH = labelLine + textH + padding;
  } else {
    const textH = estimateTextHeight(node.text, nodeW - padding, 11);
    nodeH = textH + padding;
  }
  nodeH = Math.max(nodeH, 50);

  if (node.type === 'result' || !node.options || node.options.length === 0) {
    return {
      width: nodeW,
      height: nodeH,
      rootX: nodeW / 2,
      rootY: 0,
      elements: [{ id: nodeId, x: 0, y: 0, w: nodeW, h: nodeH, node, depth }],
      connectors: [],
    };
  }

  // Compute label heights adaptively
  const labelW = 150;
  const labelHeights = node.options.map(opt => {
    const textH = estimateTextHeight(opt.label, labelW - 16, 10);
    return Math.max(textH + 10, 24);
  });
  const maxLabelH = Math.max(...labelHeights);
  const LABEL_GAP = 8;
  const branchTopGap = LABEL_GAP + maxLabelH + LABEL_GAP;

  const childLayouts = node.options.map(opt => computeLayout(opt.next, nodeMap, depth + 1));

  const totalChildrenWidth = childLayouts.reduce((sum, cl) => sum + cl.width, 0)
    + (childLayouts.length - 1) * NODE_GAP_X;

  const subtreeWidth = Math.max(nodeW, totalChildrenWidth);
  const parentX = subtreeWidth / 2 - nodeW / 2;
  const parentCenterX = subtreeWidth / 2;

  const connectorStartY = nodeH;
  const connectorMidY = connectorStartY + CONNECTOR_DROP;
  const childRowY = connectorMidY + branchTopGap;

  let cursorX = (subtreeWidth - totalChildrenWidth) / 2;
  const elements = [{ id: nodeId, x: parentX, y: 0, w: nodeW, h: nodeH, node, depth }];
  const connectors = [];

  node.options.forEach((opt, i) => {
    const cl = childLayouts[i];
    const childCenterX = cursorX + cl.rootX;

    elements.push({
      id: `label-${nodeId}-${i}`,
      x: childCenterX - labelW / 2,
      y: connectorMidY + LABEL_GAP,
      w: labelW,
      h: labelHeights[i],
      isLabel: true,
      label: opt.label,
      depth,
      optionKey: `${nodeId}-${opt.next}`,
    });

    cl.elements.forEach(el => {
      elements.push({ ...el, x: el.x + cursorX, y: el.y + childRowY });
    });
    cl.connectors.forEach(con => {
      connectors.push({
        ...con,
        x1: con.x1 + cursorX, y1: con.y1 + childRowY,
        x2: con.x2 + cursorX, y2: con.y2 + childRowY,
      });
    });

    // Vertical from parent center down to rail
    connectors.push({ x1: parentCenterX, y1: connectorStartY, x2: parentCenterX, y2: connectorMidY, optionKey: `${nodeId}-${opt.next}` });
    // Horizontal rail to child center
    connectors.push({ x1: parentCenterX, y1: connectorMidY, x2: childCenterX, y2: connectorMidY, optionKey: `${nodeId}-${opt.next}` });
    // Vertical from rail down through label to child
    connectors.push({ x1: childCenterX, y1: connectorMidY, x2: childCenterX, y2: childRowY, optionKey: `${nodeId}-${opt.next}` });

    cursorX += cl.width + NODE_GAP_X;
  });

  const totalHeight = childRowY + Math.max(...childLayouts.map(cl => cl.height));

  return { width: subtreeWidth, height: totalHeight, rootX: parentCenterX, rootY: 0, elements, connectors };
}


export const TreeVisualization = ({ treeId, highlightedPath = [], onClose }) => {
  const tree = TREE_DATA.find(t => t.id === treeId);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);
  const printRef = useRef(null);

  const nodeMap = useMemo(() => {
    if (!tree) return {};
    const map = {};
    tree.nodes.forEach(n => { map[n.id] = n; });
    return map;
  }, [tree]);

  const highlightedSet = useMemo(() => new Set(highlightedPath), [highlightedPath]);

  const layout = useMemo(() => {
    if (!tree) return null;
    return computeLayout('start', nodeMap);
  }, [tree, nodeMap]);

  // Fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      const el = containerRef.current;
      if (el?.requestFullscreen) el.requestFullscreen();
      else if (el?.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
  }, [isFullscreen]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Print: scale the entire tree to fit on one landscape page
  const handlePrint = useCallback(() => {
    const printArea = printRef.current;
    if (!printArea || !layout) return;

    const treeW = layout.width + 80;
    const treeH = layout.height + 80;

    // A4 landscape printable area ~1100x750 pixels at 96dpi
    const pageW = 1060;
    const pageH = 720;
    const scale = Math.min(pageW / treeW, pageH / treeH, 1);

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const outerHTML = printArea.outerHTML;

    printWindow.document.write(`<!DOCTYPE html>
<html><head><title>${tree?.title || 'Decision Tree'}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    background: white;
    padding: 16px;
  }
  .print-header { margin-bottom: 12px; }
  .print-header h1 { font-size: 16px; font-weight: 700; color: #111827; }
  .print-header p { font-size: 10px; color: #6b7280; margin-top: 2px; }
  .tree-wrapper {
    transform: scale(${scale});
    transform-origin: top left;
    width: ${treeW}px;
    height: ${treeH}px;
  }
  .tree-wrapper > div { position: relative !important; }

  /* Legend */
  .legend { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
  .legend-item {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 8px; padding: 2px 6px; border-radius: 4px;
    border: 1px solid;
  }
  .legend-dot { width: 6px; height: 6px; border-radius: 50%; }

  @media print {
    @page { size: landscape; margin: 8mm; }
    body { padding: 0; }
  }
</style>
</head><body>
  <div class="print-header">
    <h1>${tree?.title || 'Decision Tree'}</h1>
    <p>Full decision tree visualization — MedTech Europe Code</p>
  </div>
  <div class="legend">
    ${Object.entries(OUTCOME_COLORS).map(([outcome, colors]) =>
      `<span class="legend-item" style="background:${colors.bg};border-color:${colors.border};color:${colors.text}">
        <span class="legend-dot" style="background:${colors.border}"></span>${outcome.replaceAll('-', ' ')}
      </span>`
    ).join('')}
  </div>
  <div class="tree-wrapper">${outerHTML}</div>
  <script>setTimeout(function(){ window.print(); window.close(); }, 600);</script>
</body></html>`);
    printWindow.document.close();
  }, [tree, layout]);

  if (!tree || !layout) {
    return <div className="p-8 text-gray-400 text-center">Tree not found.</div>;
  }

  const { width: totalW, height: totalH, elements, connectors } = layout;
  const pad = 40;

  return (
    <div
      ref={containerRef}
      className={`animate-fade-in ${isFullscreen ? 'fixed inset-0 z-50 bg-white overflow-auto' : ''}`}
    >
      <div className={`${isFullscreen ? 'p-6' : 'py-10 px-4 max-w-6xl mx-auto'}`}>
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{tree.title}</h1>
            <p className="text-sm text-gray-500">Full decision tree visualization</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
              title="Print tree"
            >
              <AppIcon name="Printer" size={14} />
              Print
            </button>
            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              <AppIcon name={isFullscreen ? 'Minimize2' : 'Maximize2'} size={14} />
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
            >
              <AppIcon name="ChevronLeft" size={14} />
              Back to Interactive
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-6 text-xs">
          {Object.entries(OUTCOME_COLORS).map(([outcome, colors]) => (
            <div
              key={outcome}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border"
              style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }}
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.border }} />
              {outcome.replaceAll('-', ' ')}
            </div>
          ))}
        </div>

        {/* Tree canvas */}
        <div className="bg-gray-50 rounded-2xl border border-gray-200 overflow-auto custom-scrollbar">
          <div
            ref={printRef}
            style={{
              position: 'relative',
              width: totalW + pad * 2,
              height: totalH + pad * 2,
              minWidth: totalW + pad * 2,
              minHeight: totalH + pad * 2,
            }}
          >
            {/* SVG connector layer */}
            <svg
              width={totalW + pad * 2}
              height={totalH + pad * 2}
              style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
              xmlns="http://www.w3.org/2000/svg"
            >
              {connectors.map((con, i) => {
                const highlighted = con.optionKey && highlightedSet.has(con.optionKey.split('-').pop());
                return (
                  <line
                    key={i}
                    x1={con.x1 + pad} y1={con.y1 + pad}
                    x2={con.x2 + pad} y2={con.y2 + pad}
                    stroke={highlighted ? '#f59e0b' : '#cbd5e1'}
                    strokeWidth={highlighted ? 2.5 : 1.5}
                  />
                );
              })}
            </svg>

            {/* Positioned elements */}
            {elements.map((el) => {
              if (el.isLabel) {
                const isLabelHL = el.optionKey && highlightedSet.has(el.optionKey.split('-').pop());
                return (
                  <div
                    key={el.id}
                    style={{
                      position: 'absolute',
                      left: el.x + pad,
                      top: el.y + pad,
                      width: el.w,
                      minHeight: el.h,
                    }}
                    className={`text-[10px] font-medium px-2 py-1 rounded-md text-center flex items-center justify-center leading-tight ${
                      isLabelHL
                        ? 'bg-amber-100 text-amber-700 border border-amber-300'
                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                    }`}
                  >
                    {el.label}
                  </div>
                );
              }

              const { node } = el;
              const isHL = highlightedSet.has(node.id);

              if (node.type === 'result') {
                const colors = OUTCOME_COLORS[node.outcome] || OUTCOME_COLORS['conditional'];
                return (
                  <div
                    key={el.id}
                    style={{
                      position: 'absolute',
                      left: el.x + pad,
                      top: el.y + pad,
                      width: el.w,
                      minHeight: el.h,
                      backgroundColor: colors.bg,
                      borderColor: colors.border,
                      color: colors.text,
                      borderWidth: '2px',
                      borderStyle: 'solid',
                      borderRadius: '12px',
                      padding: '12px',
                      boxSizing: 'border-box',
                    }}
                    className={`transition-all ${isHL ? 'ring-2 ring-amber-400 ring-offset-2' : ''}`}
                  >
                    <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.7, marginBottom: '4px' }}>
                      {node.outcome?.replaceAll('-', ' ')}
                    </div>
                    <p style={{ fontSize: '10px', fontWeight: 500, lineHeight: 1.5 }}>{node.text}</p>
                  </div>
                );
              }

              return (
                <div
                  key={el.id}
                  style={{
                    position: 'absolute',
                    left: el.x + pad,
                    top: el.y + pad,
                    width: el.w,
                    minHeight: el.h,
                    backgroundColor: 'white',
                    borderWidth: '2px',
                    borderStyle: 'solid',
                    borderRadius: '12px',
                    padding: '12px',
                    boxSizing: 'border-box',
                    borderColor: isHL ? '#fbbf24' : '#e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  className={`transition-all ${isHL ? 'ring-2 ring-amber-200 shadow-md' : 'shadow-sm'}`}
                >
                  <p style={{ fontSize: '11px', fontWeight: 600, color: '#1f2937', lineHeight: 1.5, textAlign: 'center' }}>
                    {node.text}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
