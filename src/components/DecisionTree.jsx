import React, { useState, useCallback } from 'react';
import { AppIcon } from './AppIcons';
import { TreeCvsCheck } from './TreeCvsCheck';
import { TreeResultCard } from './TreeResultCard';
import { TREE_DATA } from '../data/treeData';

export const DecisionTree = ({ treeId, onShowVisualization, onOpenReference }) => {
  const tree = TREE_DATA.find(t => t.id === treeId);
  const [currentNodeId, setCurrentNodeId] = useState('start');
  const [pathHistory, setPathHistory] = useState([]);

  const currentNode = tree?.nodes?.find(n => n.id === currentNodeId);

  const handleOption = useCallback((nextId, optionLabel) => {
    setPathHistory(prev => [...prev, { nodeId: currentNodeId, choice: optionLabel }]);
    setCurrentNodeId(nextId);
  }, [currentNodeId]);

  const handleGoBack = useCallback(() => {
    if (pathHistory.length === 0) return;
    const prev = pathHistory[pathHistory.length - 1];
    setPathHistory(p => p.slice(0, -1));
    setCurrentNodeId(prev.nodeId);
  }, [pathHistory]);

  // Returns to an earlier question so its answer can be changed.
  const handleChangeAnswer = useCallback((stepIndex) => {
    const step = pathHistory[stepIndex];
    if (!step) return;
    setPathHistory(p => p.slice(0, stepIndex));
    setCurrentNodeId(step.nodeId);
  }, [pathHistory]);

  const handleReset = useCallback(() => {
    setCurrentNodeId('start');
    setPathHistory([]);
  }, []);

  if (!tree) {
    return (
      <div className="animate-fade-in py-20 text-center text-gray-400">
        <p className="text-lg">Decision tree not found.</p>
      </div>
    );
  }

  if (!currentNode) {
    return (
      <div className="animate-fade-in py-20 text-center text-gray-400">
        <p className="text-lg">Error: Invalid node in decision tree.</p>
        <button onClick={handleReset} className="mt-4 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors">
          Reset Tree
        </button>
      </div>
    );
  }

  const questionText = (nodeId) => tree.nodes.find((node) => node.id === nodeId)?.text || '';

  return (
    // From 1280px the answers sit in a column beside the question, so the question stays in
    // the same place as you answer.
    <div className="animate-fade-in py-10 px-4 max-w-3xl xl:max-w-[69rem] 3xl:max-w-[80rem] mx-auto xl:grid xl:grid-cols-[minmax(0,1fr)_18rem] 3xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-12 xl:items-start">
      <div className="min-w-0">
        {/* Tree header */}
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <h1 className="text-2xl font-bold text-gray-900">{tree.title}</h1>
            <div className="flex gap-2">
              <button
                onClick={onShowVisualization}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
              >
                <AppIcon name="GitBranch" size={14} />
                View Full Tree
              </button>
            </div>
          </div>
          <p className="text-sm text-gray-500">{tree.description}</p>
        </div>

        {/* Breadcrumb trail (narrower screens; wide screens list the answers beside the question) */}
        {pathHistory.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-1 text-xs text-gray-400 xl:hidden">
            <span className="font-medium text-gray-500">Path:</span>
            {pathHistory.map((step, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">{step.choice}</span>
                {i < pathHistory.length - 1 && <AppIcon name="ChevronRight" size={10} />}
              </span>
            ))}
          </div>
        )}

        {/* Question node */}
        {currentNode.type === 'question' && (
          <div className="animate-fade-in">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">
                  Question {pathHistory.length + 1}
                </span>
              </div>
              <p className="text-lg font-semibold text-gray-900 leading-relaxed mb-6">
                {currentNode.text}
              </p>

              {currentNode.helpText && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 flex items-start gap-3">
                  <AppIcon name="Info" size={16} className="text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700 leading-relaxed">{currentNode.helpText}</p>
                </div>
              )}

              <div className="space-y-3">
                {currentNode.options.map((option, i) => (
                  <button
                    key={i}
                    onClick={() => handleOption(option.next, option.label)}
                    className="w-full text-left px-5 py-4 rounded-xl border border-gray-200 bg-gray-50 hover:bg-amber-50 hover:border-amber-300 transition-all text-sm font-medium text-gray-800 flex items-center justify-between group active:scale-[0.98]"
                  >
                    <span>{option.label}</span>
                    <AppIcon name="ChevronRight" size={16} className="text-gray-300 group-hover:text-amber-500 transition-colors" />
                  </button>
                ))}
              </div>
            </div>

            {/* Controls (in the answers column on wide screens) */}
            <div className="flex gap-3 xl:hidden">
              {pathHistory.length > 0 && (
                <button
                  onClick={handleGoBack}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <AppIcon name="ChevronLeft" size={14} />
                  Go Back
                </button>
              )}
              {pathHistory.length > 0 && (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <AppIcon name="RotateCcw" size={14} />
                  Start Over
                </button>
              )}
            </div>
          </div>
        )}

        {/* Result node */}
        {currentNode.type === 'result' && (
          <div className="animate-fade-in">
            {/* Where the answer depends on the Event's live CVS status, the card changes with it */}
            {currentNode.cvsCheck ? (
              <TreeCvsCheck
                key={currentNode.id}
                node={currentNode}
                cvsCheck={tree.cvsCheck}
                onOpenReference={onOpenReference}
              />
            ) : (
              <TreeResultCard
                outcome={currentNode.outcome}
                text={currentNode.text}
                reference={currentNode.reference}
                onOpenReference={onOpenReference}
              />
            )}

            {/* Controls */}
            <div className="flex gap-3">
              <button
                onClick={handleGoBack}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <AppIcon name="ChevronLeft" size={14} />
                Go Back
              </button>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
              >
                <AppIcon name="RotateCcw" size={14} />
                Try Different Scenario
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Your answers (wide screens) */}
      <aside aria-label="Your answers" className="hidden xl:block sticky top-6 pt-1 no-print">
        <h2 className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-3">Your answers</h2>
        {pathHistory.length === 0 ? (
          <p className="text-xs leading-relaxed text-gray-500">
            Your answers appear here as you go. Select one to change it.
          </p>
        ) : (
          <ol className="space-y-3 border-l-2 border-amber-100 pl-4">
            {pathHistory.map((step, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => handleChangeAnswer(i)}
                  className="group block w-full text-left"
                  title="Change this answer"
                >
                  <span className="block text-[11px] font-semibold text-gray-400">Question {i + 1}</span>
                  <span className="text-xs text-gray-500 line-clamp-2">{questionText(step.nodeId)}</span>
                  <span className="mt-0.5 block text-sm font-medium text-gray-800 group-hover:text-amber-700 transition-colors">
                    {step.choice}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
        {pathHistory.length > 0 && currentNode.type === 'question' && (
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={handleGoBack}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <AppIcon name="ChevronLeft" size={14} />
              Go Back
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors"
            >
              <AppIcon name="RotateCcw" size={14} />
              Start Over
            </button>
          </div>
        )}
      </aside>
    </div>
  );
};
