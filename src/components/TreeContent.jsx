import React, { useState, useRef } from 'react';
import { TreeLandingPage } from './TreeLandingPage';
import { DecisionTree } from './DecisionTree';
import { TreeVisualization } from './TreeVisualization';

/**
 * TreeContent — main content area for the Decision Trees section.
 * Manages routing between the tree landing page, interactive tree, and visualization.
 */
export const TreeContent = ({ activeId, setActiveId, scrollRef, onOpenReference, onOpenTool }) => {
  const [showVisualization, setShowVisualization] = useState(false);
  const localRef = useRef(null);
  const ref = scrollRef || localRef;

  const handleSelectTree = (treeId) => {
    setActiveId(treeId);
    setShowVisualization(false);
    if (ref.current) {
      ref.current.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  const handleBackToLanding = () => {
    setActiveId('trees-home');
    setShowVisualization(false);
    if (ref.current) {
      ref.current.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  // Landing page
  if (!activeId || activeId === 'home' || activeId === 'trees-home') {
    return (
      <main ref={ref} className="flex-1 overflow-y-auto bg-slate-50/60 custom-scrollbar h-full">
        <TreeLandingPage onSelectTree={handleSelectTree} onOpenTool={onOpenTool} />
      </main>
    );
  }

  // Visualization mode
  if (showVisualization) {
    return (
      <main ref={ref} className="flex-1 overflow-y-auto bg-slate-50/60 custom-scrollbar h-full">
        <TreeVisualization
          treeId={activeId}
          onClose={() => setShowVisualization(false)}
        />
      </main>
    );
  }

  // Interactive tree
  return (
    <main ref={ref} className="flex-1 overflow-y-auto bg-slate-50/60 custom-scrollbar h-full">
      <DecisionTree
        treeId={activeId}
        onBack={handleBackToLanding}
        onShowVisualization={() => setShowVisualization(true)}
        onOpenReference={onOpenReference}
      />
    </main>
  );
};
