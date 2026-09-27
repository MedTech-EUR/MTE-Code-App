import React, { useState, useCallback, useId, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { AppIcon } from './AppIcons';
import { TreeCvsCheck } from './TreeCvsCheck';
import { TREE_DATA } from '../data/treeData';
import { REFERENCE_INDEX } from '../data/referenceIndex';
import {
  describeReferenceTarget,
  getReferenceHref,
  isPlainLinkClick,
  resolveTreeReference,
} from '../utils/crossReferences';

const OUTCOME_STYLES = {
  'compliant':     { bg: 'bg-emerald-50',  border: 'border-emerald-200', text: 'text-emerald-800', icon: '✅', label: 'Compliant' },
  'non-compliant': { bg: 'bg-red-50',      border: 'border-red-200',     text: 'text-red-800',     icon: '❌', label: 'Non-Compliant' },
  'conditional':   { bg: 'bg-amber-50',    border: 'border-amber-200',   text: 'text-amber-800',   icon: '⚠️', label: 'Conditional' },
  'consult-legal': { bg: 'bg-blue-50',     border: 'border-blue-200',    text: 'text-blue-800',    icon: '⚖️', label: 'Consult Legal' },
  'not-required':  { bg: 'bg-teal-50',     border: 'border-teal-200',    text: 'text-teal-800',    icon: 'ℹ️', label: 'CVS Assessment Not Required' },
  'out-of-scope':  { bg: 'bg-purple-50',   border: 'border-purple-200',  text: 'text-purple-800',  icon: '➖', label: 'Out of Scope' },
  'not-applicable':{ bg: 'bg-purple-50',   border: 'border-purple-200',  text: 'text-purple-800',  icon: '➖', label: 'Not Applicable' },
  'prior-review':  { bg: 'bg-purple-50',   border: 'border-purple-200',  text: 'text-purple-800',  icon: '📋', label: 'Prior Review Required' },
  'in-scope':      { bg: 'bg-indigo-50',   border: 'border-indigo-200',  text: 'text-indigo-800',  icon: '🎯', label: 'In Scope of the Code' },
  'more-info':     { bg: 'bg-gray-50',     border: 'border-gray-300',    text: 'text-gray-800',    icon: '❔', label: 'More Information Needed' },
};

// The provision a result cites. It opens in place, so the tree keeps its answers, and links to
// the full text in the Code.
const ResultReference = ({ reference, onOpenReference }) => {
  const target = useMemo(() => resolveTreeReference(reference, REFERENCE_INDEX), [reference]);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const preview = target ? describeReferenceTarget(target) : null;
  const previewMarkup = useMemo(
    () => ({ __html: DOMPurify.sanitize(preview?.html || '') }),
    [preview?.html],
  );

  return (
    <div className="bg-white/60 rounded-xl p-4 border border-white/80">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Reference</p>
      {!target ? (
        <p className="text-sm text-gray-700">{reference}</p>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={panelId}
            className="inline-flex items-center gap-1 text-left text-sm font-medium text-gray-800 underline decoration-dotted underline-offset-4 hover:text-gray-950"
          >
            {reference}
            <AppIcon name={open ? 'ChevronUp' : 'ChevronDown'} size={14} className="shrink-0" />
          </button>
          {open && (
            <div id={panelId} className="mt-3 pt-3 border-t border-gray-200/80 animate-fade-in">
              <p className="text-xs font-semibold text-gray-500 mb-2">
                {[preview.location, preview.title].filter(Boolean).join(' › ')}
              </p>
              <div
                className="max-h-72 overflow-y-auto custom-scrollbar pr-1 text-sm leading-relaxed text-gray-700 space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mt-1"
                dangerouslySetInnerHTML={previewMarkup}
              />
              <a
                href={getReferenceHref(target)}
                onClick={(event) => {
                  if (!onOpenReference || !isPlainLinkClick(event)) return;
                  event.preventDefault();
                  onOpenReference(target);
                }}
                className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#007A86] hover:text-[#7654A1]"
              >
                Open in the Code
                <AppIcon name="ArrowRight" size={12} />
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
};

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

  const outcomeStyle = currentNode.type === 'result'
    ? (OUTCOME_STYLES[currentNode.outcome] || OUTCOME_STYLES['conditional'])
    : null;
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
        {currentNode.type === 'result' && outcomeStyle && (
          <div className="animate-fade-in">
            <div className={`rounded-2xl border-2 ${outcomeStyle.border} ${outcomeStyle.bg} p-8 mb-6`}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{outcomeStyle.icon}</span>
                <span className={`text-sm font-bold uppercase tracking-wider ${outcomeStyle.text}`}>
                  {outcomeStyle.label}
                </span>
              </div>
              <p className={`text-lg font-semibold leading-relaxed mb-4 ${outcomeStyle.text}`}>
                {currentNode.text}
              </p>

              {currentNode.reference && (
                <ResultReference reference={currentNode.reference} onOpenReference={onOpenReference} />
              )}
            </div>

            {/* The Event's live CVS status, where this result depends on it */}
            {currentNode.cvsCheck && (
              <TreeCvsCheck key={currentNode.id} mode={currentNode.cvsCheck} cvsCheck={tree.cvsCheck} />
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
