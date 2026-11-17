import React, { useState, useCallback } from 'react';
import { AppIcon } from './AppIcons';
import { PageHeader } from './PageHeader';
import { OUTCOME_STYLES, TreeResultCard } from './TreeResultCard';
import { CopySummaryButton } from './CopySummaryButton';
import { buildTreeSummary } from '../utils/resultSummary';
import { TREE_DATA } from '../data/treeData';

export const DecisionTree = ({ treeId, onBack, onShowVisualization, onOpenReference }) => {
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
    <div className="animate-page-in px-4 sm:px-8 py-8 sm:py-10 max-w-3xl xl:max-w-[72rem] 3xl:max-w-[80rem] mx-auto xl:grid xl:grid-cols-[minmax(0,1fr)_18rem] 3xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-12 xl:items-start">
      <div className="min-w-0">
        <PageHeader
          icon="GitBranch"
          accent="amber"
          size="md"
          title={tree.title}
          description={tree.description}
          back={onBack ? { label: 'All Decision Trees', onClick: onBack } : undefined}
          actions={(
            <button
              type="button"
              onClick={onShowVisualization}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
            >
              <AppIcon name="GitBranch" size={14} />
              View Full Tree
            </button>
          )}
        />

        {/* Breadcrumb trail (narrower screens; wide screens list the answers beside the question) */}
        {pathHistory.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-1 text-xs text-gray-400 xl:hidden">
            <span className="font-medium text-gray-500">Path:</span>
            {pathHistory.map((step, i) => (
              <span key={i} className="flex items-center gap-1 animate-rise-in">
                <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">{step.choice}</span>
                {i < pathHistory.length - 1 && <AppIcon name="ChevronRight" size={10} />}
              </span>
            ))}
          </div>
        )}

        {/* Question node */}
        {/* Keyed by the question, so each one rises in as it is reached. */}
        {currentNode.type === 'question' && (
          <div key={currentNodeId} className="animate-rise-in">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                  Question {pathHistory.length + 1}
                </span>
              </div>
              <p className="text-lg font-semibold text-gray-900 leading-relaxed mb-6">
                {currentNode.text}
              </p>

              {currentNode.helpText && (
                <div className="bg-[#0099A7]/5 border border-[#0099A7]/20 rounded-xl p-4 mb-6 flex items-start gap-3">
                  <AppIcon name="Info" size={16} className="text-[#007A86] shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-700 leading-relaxed">{currentNode.helpText}</p>
                </div>
              )}

              <div className="stagger space-y-3">
                {currentNode.options.map((option, i) => (
                  <button
                    key={i}
                    onClick={() => handleOption(option.next, option.label)}
                    className="w-full text-left px-5 py-4 rounded-xl border border-gray-200 bg-white hover:bg-amber-50 hover:border-amber-400 hover:shadow-sm transition-all text-sm font-medium text-gray-800 flex items-center justify-between gap-3 group active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                  >
                    <span>{option.label}</span>
                    <AppIcon name="ChevronRight" size={16} className="shrink-0 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-amber-600" />
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
          <div key={currentNodeId} className="animate-rise-in">
            <TreeResultCard
              outcome={currentNode.outcome}
              text={currentNode.text}
              reference={currentNode.reference}
              onOpenReference={onOpenReference}
            />

            {/* Controls */}
            <div className="flex flex-wrap gap-3">
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
              <CopySummaryButton
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors sm:ml-auto"
                getText={() => buildTreeSummary({
                  title: tree.title,
                  steps: pathHistory.map((step) => ({ question: questionText(step.nodeId), answer: step.choice })),
                  outcomeLabel: (OUTCOME_STYLES[currentNode.outcome] || OUTCOME_STYLES.conditional).label,
                  text: currentNode.text,
                  reference: currentNode.reference,
                  url: `${window.location.origin}${window.location.pathname}`,
                })}
              />
            </div>
          </div>
        )}
      </div>

      {/* Your answers (wide screens) */}
      <aside aria-label="Your answers" className="hidden xl:block sticky top-6 pt-12 no-print">
        <h2 className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-3">Your answers</h2>
        {pathHistory.length === 0 ? (
          <p className="text-xs leading-relaxed text-gray-500">
            Your answers appear here as you go. Select one to change it.
          </p>
        ) : (
          <ol className="space-y-3 border-l-2 border-amber-100 pl-4">
            {pathHistory.map((step, i) => (
              <li key={`${i}-${step.nodeId}`} className="animate-rise-in">
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
