import React, { useEffect, useMemo, useState } from 'react';
import { AppIcon } from './AppIcons';
import { SearchResults } from './SearchResults';
import { ResizeHandle } from './ResizeHandle';
import { CODE_CHAPTERS, CODE_PARTS as CODE_PART_LIST, WEBSITE_CHAPTERS, updateSearchStatus } from '../data/codeData';
import { CVS_CHECK_URL } from '../config/sections';
import {
  TRANSPARENCY_DOCUMENTS,
} from '../data/transparency/transparencyData';
import { addRecentSearch, normalizeRecentSearches } from '../utils/recentSearchUtils';
import { HISTORICAL_DECLARATIONS_DOCUMENT_ID } from '../utils/routeUtils';
import { normalizeSearchQuery } from '../utils/searchResultUtils';
import { describeSearchResponse, emitSearchEvent, isSearchDebugEnabled } from '../utils/searchEvents';

/**
 * The two kinds of heading in the menu. A section ("The Code", "Decision Trees") is the larger,
 * darker one; a group inside it ("Introductory Chapters") is a step smaller and lighter; the
 * entries under them are smaller again (text-sm). Full class names: Tailwind cannot build them.
 */
const GROUP_LEVELS = {
  1: { label: 'text-base font-semibold text-[#3b3450]', icon: 'text-[#8a83a0]', iconSize: 16, chevron: 14 },
  2: { label: 'text-[0.9375rem] font-semibold text-[#6e6a85]', icon: 'text-[#8a83a0]', iconSize: 14, chevron: 12 },
};

/**
 * CollapsibleGroup — a generic collapsible section with a header and children.
 * `level` 1 is a section of the menu, 2 a group inside a section.
 */
const CollapsibleGroup = ({
  label,
  icon,
  badge,
  expanded,
  onToggle,
  children,
  level = 1,
  className = '',
}) => {
  const panelId = React.useId();
  const tier = GROUP_LEVELS[level] || GROUP_LEVELS[1];

  return (
    <div className={className}>
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex justify-between items-center gap-2 rounded-lg px-4 group ${level === 1 ? 'py-1 mb-1.5' : 'py-0.5 mb-1'}`}
        aria-expanded={expanded}
        aria-controls={panelId}
      >
        <span className={`flex items-center gap-2 text-left leading-snug ${tier.label}`}>
          {icon && <AppIcon name={icon} size={tier.iconSize} className={`shrink-0 ${tier.icon}`} />}
          {label}
        </span>
        <span className="flex items-center gap-1.5">
          {badge !== undefined && badge !== null && (
            <span className="text-[10px] font-bold bg-purple-50 text-[#7654A1] px-2 py-0.5 rounded-full">
              {badge}
            </span>
          )}
          <AppIcon
            name="ChevronDown"
            size={tier.chevron}
            className={`text-gray-400 group-hover:text-gray-600 transition duration-300 ease-out-soft ${expanded ? 'rotate-180' : ''}`}
          />
        </span>
      </button>
      {expanded && (
        <div id={panelId} className="animate-rise-in">
          {children}
        </div>
      )}
    </div>
  );
};

const getDefaultExpandedGroups = ({
  activeSection,
  activeDocumentId,
  isWebsitePage,
  hasBookmarks,
  hasRecentHistory,
}) => {
  const groups = new Set();

  if (!activeSection) {
    if (hasBookmarks) groups.add('bookmarks');
    if (hasRecentHistory) groups.add('history');
  } else if (isWebsitePage) {
    groups.add('section-website');
  } else if (activeSection === 'code') {
    groups.add('section-code');
    groups.add('code-intro');
    groups.add('code-part1');
    groups.add('code-part2');
    groups.add('code-part3');
  } else if (activeSection === 'trees' || activeSection === 'event-support') {
    groups.add('section-trees');
  } else if (activeSection === 'transparency') {
    groups.add('section-transparency');
    if (activeDocumentId) groups.add(`transparency-${activeDocumentId}`);
  }

  return groups;
};

// The Code's parts, each with the key of its collapsible group.
const CODE_PARTS = CODE_PART_LIST.map((part) => ({ ...part, groupKey: `code-${part.id}` }));

const CODE_TYPE_CHIPS = [
  { key: 'provision', label: 'Provisions' },
  { key: 'qa', label: 'Q&As' },
  { key: 'definition', label: 'Definitions' },
];
const TRANSPARENCY_TYPE_CHIPS = [
  { key: 'provision', label: 'Provisions' },
  { key: 'qa', label: 'Q&As' },
];
const DEFAULT_TYPE_FILTER_KEYS = ['provision', 'qa', 'definition'];

export const Sidebar = ({
  sidebarOpen,
  setSidebarOpen,
  searchTerm,
  setSearchTerm,
  debouncedSearch,
  activeId,
  activeSection,
  activeDocumentId,
  onNavigateChapter,
  onNavigateCodeSection,
  onNavigateTrees,
  onNavigateTransparency,
  onNavigateTransparencyDocument,
  onNavigateTransparencyUnit,
  onNavigateTransparencySection,
  setShowSummary,
  setShowFullText,
  setShowQA,
  onGoHome,
  installPromptEvent,
  isIos,
  setShowIosPrompt,
  handleInstallClick,
  bookmarks = [],
  recentHistory = [],
  searchResponse = null,
  onOpenDefinition,
  onPreviewResult,
  canPreviewResult,
  resize,
}) => {
  // True while the active *section* is Transparency, independent of whether a search is
  // active -- it decides both the search scope and which parts of the non-search tree show.
  const isTransparencySection = activeSection === 'transparency';
  const searchScope = isTransparencySection ? 'transparency' : 'code';
  const isWebsitePage = activeSection === 'code'
    && WEBSITE_CHAPTERS.some((chapter) => chapter.id === activeId);
  // The event support checker is listed with the trees.
  const browsingTrees = activeSection === 'trees' || activeSection === 'event-support';

  // Track which groups are expanded
  const [expandedGroups, setExpandedGroups] = useState(() => (
    getDefaultExpandedGroups({
      activeSection,
      activeDocumentId,
      isWebsitePage,
      hasBookmarks: bookmarks.length > 0,
      hasRecentHistory: recentHistory.length > 0,
    })
  ));

  const normalizedDebouncedSearch = normalizeSearchQuery(debouncedSearch);
  const hasActiveSearch = normalizedDebouncedSearch.length > 0;
  const searchResultsAreCurrent = normalizeSearchQuery(searchTerm) === normalizedDebouncedSearch;
  const isStale = !searchResultsAreCurrent;

  const defaultExpandedGroups = useMemo(() => (
    getDefaultExpandedGroups({
      activeSection,
      activeDocumentId,
      isWebsitePage,
      hasBookmarks: bookmarks.length > 0,
      hasRecentHistory: recentHistory.length > 0,
    })
  ), [
    activeDocumentId,
    activeSection,
    isWebsitePage,
    bookmarks.length,
    recentHistory.length,
  ]);

  // Result-type chips (Provisions / Q&As / Definitions), local to the sidebar and on by default.
  const [typeFilter, setTypeFilter] = useState(() => new Set(DEFAULT_TYPE_FILTER_KEYS));
  const toggleType = (key) => {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const [debug] = useState(() => isSearchDebugEnabled());

  // Recent searches state & localStorage sync
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const saved = localStorage.getItem('MTE_RECENT_SEARCHES');
      return saved ? normalizeRecentSearches(JSON.parse(saved)) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      if (recentSearches.length > 0) {
        localStorage.setItem('MTE_RECENT_SEARCHES', JSON.stringify(recentSearches));
      } else {
        localStorage.removeItem('MTE_RECENT_SEARCHES');
      }
    } catch (error) {
      console.error('Could not save recent searches', error);
    }
  }, [recentSearches]);

  const rememberSearch = (term) => {
    setRecentSearches((previous) => addRecentSearch(previous, term));
  };

  // When activeSection changes, update default expansion
  useEffect(() => {
    setExpandedGroups(new Set(defaultExpandedGroups));
  }, [defaultExpandedGroups]);

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // Announce result counts for screen readers whenever the response changes during an active
  // search, and announce when the search is cleared. The tree's own expansion state is never
  // touched by search (it is simply not rendered while a search is active), so there is nothing
  // to snapshot or restore here any more.
  useEffect(() => {
    if (!hasActiveSearch) {
      updateSearchStatus('Search empty');
      return;
    }
    if (!searchResponse) return;
    const count = searchResponse.results.length;
    updateSearchStatus(
      count > 0
        ? `${count} results for "${searchResponse.query}"`
        : `No results for "${searchResponse.query}"`,
    );
  }, [hasActiveSearch, searchResponse]);

  const handleSelectResult = (hit, rank) => {
    const target = hit.target || {};
    switch (target.kind) {
      case 'code-section':
        onNavigateCodeSection(target.chapterId, target.anchor);
        break;
      case 'transparency-section':
        onNavigateTransparencySection(target.documentId, target.unitId, target.anchor);
        break;
      case 'definition':
        onOpenDefinition?.(target.termId);
        break;
      case 'chapter':
        setShowSummary(true);
        setShowFullText(true);
        onNavigateChapter(target.chapterId);
        break;
      case 'transparency-document':
        onNavigateTransparencyDocument(target.documentId);
        break;
      default:
        break;
    }

    rememberSearch(searchTerm);
    emitSearchEvent('select', {
      query: describeSearchResponse(searchResponse).query,
      id: hit.id,
      rank,
      type: hit.type,
    });
    setSidebarOpen(false);
  };

  return (
    // From 1024px the sidebar is docked to the left edge and can be resized by dragging its
    // right edge; below that it is a slide-in menu.
    <aside
      id="sidebar"
      aria-label="Navigation"
      className={`
        w-80 lg:w-[var(--sidebar-size)] bg-white border-r border-gray-200 flex flex-col h-full shrink-0 shadow-sm z-40
        fixed inset-y-0 left-0 transition-[translate,box-shadow] duration-[420ms] ease-out-soft
        ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
        lg:translate-x-0 lg:sticky lg:top-0 lg:shadow-sm lg:[view-transition-name:app-sidebar]
      `}
    >
      {/* Top section: close button + home + search. Below 1024px the sidebar is a slide-in
          menu, so the search box starts under the close button. */}
      <div className="px-4 pt-16 pb-2 lg:pt-6 relative">
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 bg-gray-50 rounded-lg"
          aria-label="Close navigation"
        >
          <AppIcon name="X" size={20} />
        </button>

        <div
          id="search-status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        />

        {/* Search bar */}
        <div className="relative mb-4">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <AppIcon name="Search" size={16} />
          </div>
          <input
            id="searchTerm"
            type="text"
            placeholder={isTransparencySection ? 'Search Transparency...' : 'Search the Code...'}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-[#7654A1] transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') rememberSearch(searchTerm);
            }}
            aria-label={isTransparencySection ? 'Search Transparency publications' : 'Search the Code'}
          />
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm('');
                updateSearchStatus('Search cleared');
              }}
              className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-[#7654A1] transition-colors"
              title="Clear search"
              aria-label="Clear search"
              type="button"
            >
              <AppIcon name="X" size={18} />
            </button>
          )}
        </div>

        {/* Recent search chips */}
        {!searchTerm && recentSearches.length > 0 && (
          <div className="mb-4 px-1 no-print animate-fade-in">
            <div className="flex items-center justify-between mb-2 px-0.5">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                <AppIcon name="Clock" size={10} /> Recent Searches
              </span>
              <button
                onClick={() => {
                  setRecentSearches([]);
                }}
                className="text-[10px] text-gray-400 hover:text-red-500 font-medium transition-colors"
                title="Clear recent searches"
                type="button"
              >
                Clear
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {recentSearches.map(term => (
                <button
                  key={term}
                  onClick={() => setSearchTerm(term)}
                  className="text-xs bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-[#7654A1] border border-slate-200 hover:border-purple-200 rounded-lg px-2.5 py-1 font-medium transition-all flex items-center gap-1.5 group"
                  title={`Search for "${term}"`}
                  type="button"
                >
                  <span>{term}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Home button */}
        <button
          onClick={() => {
            onGoHome();
            setSidebarOpen(false);
          }}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold mb-2 transition-all border ${
            activeSection === null
              ? 'bg-gray-100 border-gray-200 text-gray-900'
              : 'text-gray-500 border-transparent hover:bg-gray-50'
          }`}
        >
          <AppIcon name="Home" size={18} /> Home
        </button>
      </div>

      {/* Scrollable navigation area */}
      <nav
        className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4 space-y-4 [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-[#7654A1]"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)',
        }}
      >
        {hasActiveSearch ? (
          <>
            {/* Result-type chips */}
            <div className="px-2 flex flex-wrap gap-1.5 animate-fade-in no-print">
              {(isTransparencySection ? TRANSPARENCY_TYPE_CHIPS : CODE_TYPE_CHIPS).map((chip) => (
                <button
                  key={chip.key}
                  onClick={() => toggleType(chip.key)}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-md border transition-colors ${
                    typeFilter.has(chip.key)
                      ? 'bg-purple-100 text-purple-700 border-purple-200'
                      : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                  }`}
                  type="button"
                >
                  {chip.label}
                </button>
              ))}
            </div>

            <SearchResults
              response={searchResponse}
              scope={searchScope}
              typeFilter={typeFilter}
              isStale={isStale}
              debug={debug}
              onSelect={handleSelectResult}
              onSearch={setSearchTerm}
              onPreview={onPreviewResult}
              canPreview={canPreviewResult}
            />
          </>
        ) : (
          <>
            {/* Bookmarks */}
            {bookmarks && bookmarks.length > 0 && (
              <CollapsibleGroup
                label="Bookmarks"
                icon="Star"
                expanded={expandedGroups.has('bookmarks')}
                onToggle={() => toggleGroup('bookmarks')}
              >
                <div className="space-y-1">
                  {bookmarks.map((b) => (
                    <button
                      key={`bm-${b.key || b.id}`}
                      title={b.title}
                      onClick={() => {
                        if (b.section === 'transparency' && b.documentId) {
                          onNavigateTransparencySection(b.documentId, b.chapterId, b.id);
                        } else {
                          onNavigateCodeSection(b.chapterId, b.id);
                        }
                        setSidebarOpen(false);
                      }}
                      className="w-full group text-left px-3 py-2.5 rounded-xl text-sm transition-all flex items-center gap-3 text-purple-700 hover:bg-purple-50 hover:text-purple-900 border border-transparent hover:border-purple-200"
                    >
                      <span className="shrink-0 text-purple-400">
                        <AppIcon name="Bookmark" size={16} />
                      </span>
                      <span className="line-clamp-2 flex-1 font-medium text-xs">
                        {b.title}
                      </span>
                    </button>
                  ))}
                </div>
              </CollapsibleGroup>
            )}

            {/* The Code section group */}
            {!isTransparencySection && (
              <CollapsibleGroup
                label="The Code"
                icon="FileText"
                expanded={expandedGroups.has('section-code')}
                onToggle={() => toggleGroup('section-code')}
                className="space-y-2"
              >
              {CODE_PARTS.map((part) => {
                const items = CODE_CHAPTERS.filter((chapter) => chapter.part === part.id);

                return (
                  <CollapsibleGroup
                    key={part.id}
                    label={part.label}
                    level={2}
                    expanded={expandedGroups.has(part.groupKey)}
                    onToggle={() => toggleGroup(part.groupKey)}
                    className="ml-2 not-first:mt-3"
                  >
                    <div className="space-y-1">
                      {items.map((item) => (
                        <button
                          key={item.id}
                          title={item.title}
                          onClick={() => {
                            onNavigateChapter(item.id);
                            setSidebarOpen(false);
                            window.scrollTo(0, 0);
                          }}
                          className={`w-full group text-left px-3 py-2.5 rounded-xl text-sm transition-all flex items-center gap-3 ${
                            activeSection === 'code' && activeId === item.id
                              ? 'bg-[#7654A1] text-white shadow-md'
                              : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <span
                            className={`shrink-0 ${
                              activeSection === 'code' && activeId === item.id
                                ? 'text-white'
                                : 'text-gray-400'
                            }`}
                          >
                            <AppIcon name={item.icon} size={18} />
                          </span>

                          <span className="line-clamp-3 flex-1">{item.title}</span>
                        </button>
                      ))}
                    </div>
                  </CollapsibleGroup>
                );
              })}
              </CollapsibleGroup>
            )}

            {/* Transparency section group */}
            <CollapsibleGroup
              label="Transparency"
              icon="Eye"
              expanded={expandedGroups.has('section-transparency')}
              onToggle={() => toggleGroup('section-transparency')}
              className="space-y-2"
            >
              <button
                type="button"
                onClick={() => {
                  onNavigateTransparency();
                  setSidebarOpen(false);
                }}
                className={`w-[calc(100%-0.5rem)] group text-left px-3 py-2.5 rounded-xl text-sm transition-all flex items-center gap-3 ml-2 ${
                  activeSection === 'transparency' && !activeDocumentId
                    ? 'bg-[#007A86] text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <AppIcon name="Eye" size={17} />
                <span className="line-clamp-2 flex-1">Transparency Home</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onNavigateTransparencyDocument(HISTORICAL_DECLARATIONS_DOCUMENT_ID);
                  setSidebarOpen(false);
                }}
                className={`w-[calc(100%-0.5rem)] group text-left px-3 py-2.5 rounded-xl text-sm transition-all flex items-center gap-3 ml-2 mb-2 ${
                  activeSection === 'transparency' && activeDocumentId === HISTORICAL_DECLARATIONS_DOCUMENT_ID
                    ? 'bg-[#7654A1] text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <AppIcon name="Search" size={17} />
                <span className="line-clamp-2 flex-1">Historical Declarations</span>
              </button>

              {TRANSPARENCY_DOCUMENTS.map((document) => (
                <CollapsibleGroup
                  key={document.id}
                  label={document.title}
                  level={2}
                  expanded={expandedGroups.has(`transparency-${document.id}`)}
                  onToggle={() => toggleGroup(`transparency-${document.id}`)}
                  className="ml-2 not-first:mt-3"
                >
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        onNavigateTransparencyDocument(document.id);
                        setSidebarOpen(false);
                      }}
                      className={`w-full group text-left px-3 py-2.5 rounded-xl text-sm transition-all flex items-center gap-3 ${
                        activeSection === 'transparency'
                          && activeDocumentId === document.id
                          && activeId === 'home'
                          ? 'bg-[#7654A1] text-white shadow-md'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <AppIcon name="List" size={16} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">Document Overview</span>
                      </span>
                    </button>

                    {(document.units || []).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        title={item.title}
                        onClick={() => {
                          onNavigateTransparencyUnit(document.id, item.id);
                          setSidebarOpen(false);
                        }}
                        className={`w-full group text-left px-3 py-2.5 rounded-xl text-sm transition-all flex items-center gap-3 ${
                          activeSection === 'transparency'
                            && activeDocumentId === document.id
                            && activeId === item.id
                            ? 'bg-[#007A86] text-white shadow-md'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className="shrink-0">
                          <AppIcon name={item.icon || 'FileText'} size={16} />
                        </span>
                        <span className="line-clamp-3 flex-1">{item.title}</span>
                      </button>
                    ))}
                  </div>
                </CollapsibleGroup>
              ))}
            </CollapsibleGroup>

            {/* Decision Trees section group */}
            <CollapsibleGroup
              label="Decision Trees"
              icon="GitBranch"
              expanded={expandedGroups.has('section-trees')}
              onToggle={() => toggleGroup('section-trees')}
              className="space-y-2"
            >
              <button
                onClick={() => {
                  onNavigateTrees();
                  setSidebarOpen(false);
                }}
                className={`w-[calc(100%-0.5rem)] group text-left px-3 py-2.5 rounded-xl text-sm transition-all flex items-center gap-3 ml-2 ${
                  browsingTrees
                    ? 'bg-amber-700 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className={`shrink-0 ${browsingTrees ? 'text-amber-200' : 'text-gray-400'}`}>
                  <AppIcon name="GitBranch" size={18} />
                </span>
                <span className="line-clamp-2 flex-1">Browse Decision Trees</span>
              </button>
              {/* The CVS checker is on ethicalmedtech.eu; it opens in a new tab. */}
              <a
                href={CVS_CHECK_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setSidebarOpen(false)}
                className="w-[calc(100%-0.5rem)] group text-left px-3 py-2.5 rounded-xl text-sm transition-all flex items-center gap-3 ml-2 text-gray-600 hover:bg-gray-50"
              >
                <span className="shrink-0 text-gray-400">
                  <AppIcon name="CVSBadge" size={18} />
                </span>
                <span className="line-clamp-2 flex-1">CVS checker</span>
                <AppIcon name="ExternalLink" size={14} className="shrink-0 text-gray-400" />
                <span className="sr-only">(opens ethicalmedtech.eu in a new tab)</span>
              </a>
            </CollapsibleGroup>

            {/* Website section group: pages about the app itself, available from every section */}
            <CollapsibleGroup
              label="Website"
              icon="Info"
              expanded={expandedGroups.has('section-website')}
              onToggle={() => toggleGroup('section-website')}
              className="space-y-2"
            >
              {WEBSITE_CHAPTERS.map((item) => {
                const isActive = activeSection === 'code' && activeId === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.title}
                    onClick={() => {
                      onNavigateChapter(item.id);
                      setSidebarOpen(false);
                      window.scrollTo(0, 0);
                    }}
                    className={`w-[calc(100%-0.5rem)] group text-left px-3 py-2.5 rounded-xl text-sm transition-all flex items-center gap-3 ml-2 ${
                      isActive
                        ? 'bg-[#7654A1] text-white shadow-md'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className={`shrink-0 ${isActive ? 'text-white' : 'text-gray-400'}`}>
                      <AppIcon name={item.icon} size={18} />
                    </span>
                    <span className="line-clamp-3 flex-1">{item.title}</span>
                  </button>
                );
              })}
            </CollapsibleGroup>

            {/* Recently Viewed */}
            {recentHistory && recentHistory.length > 0 && (
              <CollapsibleGroup
                label="Recently Viewed"
                icon="Clock"
                expanded={expandedGroups.has('history')}
                onToggle={() => toggleGroup('history')}
                className="mt-4"
              >
                <div className="space-y-1">
                  {recentHistory.map((h) => (
                    <button
                      key={`history-${h.timestamp}`}
                      title={h.title}
                      onClick={() => {
                        if (h.section === 'transparency' && h.documentId) {
                          onNavigateTransparencyUnit(h.documentId, h.id);
                        } else {
                          onNavigateChapter(h.id);
                        }
                        setSidebarOpen(false);
                        window.scrollTo(0, 0);
                      }}
                      className="w-full group text-left px-3 py-2.5 rounded-xl text-sm transition-all flex items-center gap-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent hover:border-slate-200"
                    >
                      <span className="shrink-0 text-slate-400">
                        <AppIcon name={h.icon || 'BookOpen'} size={16} />
                      </span>
                      <span className="line-clamp-2 flex-1 font-medium text-xs">
                        {h.title}
                      </span>
                    </button>
                  ))}
                </div>
              </CollapsibleGroup>
            )}
          </>
        )}

        {/* Install button */}
        <div className="pt-4 border-t border-gray-100 mt-4">
          <button
            onClick={(e) => {
              if (isIos) {
                setShowIosPrompt(true);
              } else if (installPromptEvent) {
                handleInstallClick(e);
              } else {
                alert("To install the app, look for the install icon in your browser's address bar or menu.");
              }
            }}
            className="flex items-center justify-center w-full px-4 py-3 text-sm font-bold rounded-xl text-[#7654A1] bg-[#7654A1]/10 border border-[#7654A1]/20 hover:bg-[#7654A1]/15 hover:border-[#7654A1]/30 transition-colors gap-2"
          >
            <AppIcon name="Download" size={18} />
            Install The Code App
          </button>
        </div>
      </nav>

      <ResizeHandle
        edge="right"
        label="Resize the navigation"
        controls="sidebar"
        resize={resize}
        className="hidden lg:block"
      />
    </aside>
  );
};
