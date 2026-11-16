import React from 'react';
import { AppIcon } from './AppIcons';
import { PageHeader } from './PageHeader';
import { TREE_DATA } from '../data/treeData';
import { TREE_PAGE_TOOLS } from '../config/sections';
import { filterDecisionTrees } from '../utils/treeSearchUtils';

// Every tree card takes the Decision Trees amber; a category is told apart by its heading.
const CATEGORY_CONFIG = {
  scope:      { label: 'Scope & Applicability', icon: 'Compass' },
  events:     { label: 'Events',                icon: 'Globe' },
  grants:     { label: 'Grants and Donations',  icon: 'Star' },
  consulting: { label: 'Consulting Agreements', icon: 'FileText' },
  items:      { label: 'Educational & Promotional Items', icon: 'Gift' },
  research:   { label: 'Research',              icon: 'Search' },
  default:    { label: 'General',               icon: 'GitBranch' },
};

// The trees, then the tools listed with them (which open their own sections).
const TREE_PAGE_ITEMS = [...TREE_DATA, ...TREE_PAGE_TOOLS];
const TOOL_ITEMS = new Set(TREE_PAGE_TOOLS);

export const TreeLandingPage = ({ onSelectTree, onOpenTool }) => {
  const [filterText, setFilterText] = React.useState('');

  const filteredTrees = React.useMemo(
    () => filterDecisionTrees(TREE_PAGE_ITEMS, filterText),
    [filterText],
  );

  // Group filtered trees by category
  const grouped = filteredTrees.reduce((acc, tree) => {
    const cat = tree.category || 'default';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(tree);
    return acc;
  }, {});

  return (
    <div className="animate-fade-in px-4 sm:px-8 py-8 sm:py-10 max-w-5xl xl:max-w-6xl 3xl:max-w-[96rem] mx-auto pb-24">
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

      {Object.keys(CATEGORY_CONFIG).map((category) => {
        const trees = grouped[category];
        if (!trees || trees.length === 0) return null;
        
        const config = CATEGORY_CONFIG[category];
        return (
          <section key={category} className="mb-9">
            <div className="flex items-center gap-2 mb-3">
              <AppIcon name={config.icon} size={15} className="text-amber-600" />
              <h2 className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                {config.label}
              </h2>
              <span aria-hidden="true" className="ml-2 h-px flex-1 bg-gray-200" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4 gap-4">
              {trees.map((tree) => (
                <button
                  key={tree.id}
                  type="button"
                  onClick={() => (TOOL_ITEMS.has(tree) ? onOpenTool?.(tree.id) : onSelectTree(tree.id))}
                  className="group flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 active:scale-[0.99]"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/15 transition-colors duration-200 group-hover:bg-amber-600 group-hover:text-white"
                  >
                    <AppIcon name="GitBranch" size={20} />
                  </span>

                  <span className="flex-1 min-w-0">
                    <span className="block font-bold text-gray-900 mb-1 text-sm">
                      {tree.title}
                    </span>
                    <span className="text-xs text-gray-600 leading-relaxed line-clamp-2">
                      {tree.description}
                    </span>
                    <span className="mt-3 flex items-center text-xs font-bold uppercase tracking-wider text-amber-700">
                      Start
                      <AppIcon name="ChevronRight" size={12} className="ml-1 transition-transform group-hover:translate-x-1" />
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })}

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
