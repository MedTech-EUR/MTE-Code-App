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
      <main ref={ref} className="flex-1 overflow-y-auto bg-white custom-scrollbar h-full">
        <TreeLandingPage onSelectTree={handleSelectTree} onOpenTool={onOpenTool} />
      </main>
    );
  }

  // Visualization mode
  if (showVisualization) {
    return (
      <main ref={ref} className="flex-1 overflow-y-auto bg-white custom-scrollbar h-full">
        <TreeVisualization
          treeId={activeId}
          onClose={() => setShowVisualization(false)}
        />
      </main>
    );
  }

  // Interactive tree
  return (
    <main ref={ref} className="flex-1 overflow-y-auto bg-white custom-scrollbar h-full">
      <div className="max-w-3xl xl:max-w-[69rem] 3xl:max-w-[80rem] mx-auto px-4 pt-4 pb-2">
        <button
          onClick={handleBackToLanding}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors mb-2"
        >
          ← All Decision Trees
        </button>
      </div>
      <DecisionTree
        treeId={activeId}
        onShowVisualization={() => setShowVisualization(true)}
        onOpenReference={onOpenReference}
      />
    </main>
  );
};
