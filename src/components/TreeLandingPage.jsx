import React from 'react';
import { AppIcon } from './AppIcons';
import { MenuList, MenuRow } from './MenuList';
import { PageHeader } from './PageHeader';
import { TREE_DATA } from '../data/treeData';
import { TREE_PAGE_TOOLS } from '../config/sections';
import { filterDecisionTrees } from '../utils/treeSearchUtils';

// Each tree's row names its category; the rows are listed category by category, in this order.
// tests/cmsConfig.test.mjs reads these keys to keep the editor's category choices in step.
const CATEGORY_CONFIG = {
  scope:      { label: 'Scope & Applicability' },
  events:     { label: 'Events' },
  grants:     { label: 'Grants and Donations' },
  consulting: { label: 'Consulting Agreements' },
  items:      { label: 'Educational & Promotional Items' },
  research:   { label: 'Research' },
  default:    { label: 'General' },
};
const CATEGORY_ORDER = Object.keys(CATEGORY_CONFIG);
const categoryOf = (tree) => (CATEGORY_CONFIG[tree.category] ? tree.category : 'default');

// The trees, then the tools listed with them (which open their own sections).
const TREE_PAGE_ITEMS = [...TREE_DATA, ...TREE_PAGE_TOOLS];
const TOOL_ITEMS = new Set(TREE_PAGE_TOOLS);

export const TreeLandingPage = ({ onSelectTree, onOpenTool }) => {
  const [filterText, setFilterText] = React.useState('');

  const filteredTrees = React.useMemo(
    () => filterDecisionTrees(TREE_PAGE_ITEMS, filterText),
    [filterText],
  );

  // Category by category; within one, in the order the trees are kept in.
  const orderedTrees = [...filteredTrees].sort(
    (a, b) => CATEGORY_ORDER.indexOf(categoryOf(a)) - CATEGORY_ORDER.indexOf(categoryOf(b)),
  );

  return (
    <div className="animate-page-in px-4 sm:px-8 py-8 sm:py-10 max-w-5xl xl:max-w-6xl mx-auto pb-24">
      <PageHeader
        icon="GitBranch"
        accent="amber"
        title="Decision Trees"
        description="Interactive compliance decision guides based on the MedTech Europe Code. Step through scenarios to assess compliance."
      >
        {/* Filter input */}
        <div className="no-print relative mt-6 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
            <AppIcon name="Search" size={16} />
          </div>
          <input
            type="search"
            placeholder="Search decision trees (e.g. Grants, Hospitality, Events)..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-10 py-2.5 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 shadow-sm transition-all"
            aria-label="Search decision trees"
          />
          {filterText && (
            <button
              type="button"
              onClick={() => setFilterText('')}
              className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-amber-700 transition-colors"
              title="Clear search"
              aria-label="Clear decision tree search"
            >
              <AppIcon name="X" size={16} />
            </button>
          )}
        </div>
      </PageHeader>

      {orderedTrees.length > 0 && (
        <MenuList>
          {orderedTrees.map((tree) => (
            <MenuRow
              key={tree.id}
              tourId={`tree-${tree.id}`}
              accent="amber"
              icon="GitBranch"
              title={tree.title}
              note={CATEGORY_CONFIG[categoryOf(tree)].label}
              description={tree.description}
              split
              titleWidth="19rem"
              onClick={() => (TOOL_ITEMS.has(tree) ? onOpenTool?.(tree.id) : onSelectTree(tree.id))}
            />
          ))}
        </MenuList>
      )}

      {filteredTrees.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <AppIcon
            name={TREE_DATA.length === 0 ? 'GitBranch' : 'Search'}
            size={48}
            className="mx-auto mb-4 opacity-30"
          />
          <p className="text-lg">
            {TREE_DATA.length === 0
              ? 'No decision trees available yet.'
              : `No decision trees match "${filterText.trim()}".`}
          </p>
          <p className="text-sm mt-1">
            {TREE_DATA.length === 0
              ? 'Decision trees will be added in a future update.'
              : 'Try a broader search term or clear the filter.'}
          </p>
          {TREE_DATA.length > 0 && (
            <button
              type="button"
              onClick={() => setFilterText('')}
              className="mt-4 text-sm font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2"
            >
              Clear search
            </button>
          )}
        </div>
      )}
    </div>
  );
};
