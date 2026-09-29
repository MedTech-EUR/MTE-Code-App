import React from 'react';
import DOMPurify from 'dompurify';
import { AppIcon } from './AppIcons';
import { Highlight } from './Highlight';
import { FullTextSection } from './FullTextSection';
import { TableOfContents } from './TableOfContents';
import { ContextPanel } from './ContextPanel';
import { ResizeHandle } from './ResizeHandle';
import { highlightSearchTerm } from '../utils/textUtils';
import { calculateScrollProgress } from '../utils/scrollProgressUtils';
import { useKeepReadingPosition } from '../hooks/useKeepReadingPosition';

export const DocumentReader = ({
  activeId,
  activeContent,
  items,
  homeId = 'home',
  renderLanding,
  onItemChange,
  onNavigateHome,
  homeLabel = 'Home',
  showSummary,
  showFullText,
  showQA,
  searchHighlight = null,
  glossaryMap,
  handleTermClick,
  scrollRef,
  bookmarksControls,
  bookmarkSection = 'code',
  bookmarkDocumentId = null,
  formatContentTitle = (content) => (
    Number.isNaN(Number(content?.icon))
      ? content?.title
      : `Chapter ${content?.icon}: ${content?.title}`
  ),
  formatSectionPrefix = (content) => (
    Number.isNaN(Number(content?.icon)) ? '' : `Ch ${content?.icon} - `
  ),
  renderBeforeSections,
  buildSectionPath,
  citationSourceTitle,
  citationMarkdownLabel,
  resourceLinks,
  renderSectionSupplement,
  printAllQA = false,
  sourceDocumentUrl,
  readerClassName = '',
  onNavigateTree,
  referenceContext = null,
  onOpenReference,
  // On wide screens, the side panel docked to the right of the text:
  // { item, onClose, onOpenTarget, resize }, or null when it is off.
  sidePane = null,
}) => {
  const currentIndex = items.findIndex((item) => item.id === activeId);
  const previousItem = currentIndex > 0 ? items[currentIndex - 1] : null;
  const nextItem = currentIndex !== -1 && currentIndex < items.length - 1
    ? items[currentIndex + 1]
    : null;
  const hasSummary = Boolean(activeContent?.summary);
  const sections = activeContent?.sections || [];
  // Mirrors TableOfContents: a list is only worth showing for two or more entries.
  const hasContentsList = showFullText
    && sections.length > 0
    && (sections.length >= 2 || (showSummary && hasSummary));
  const showSidePane = Boolean(sidePane) && activeId !== homeId;
  const sidePaneItem = sidePane?.item ?? null;

  const progressBarRef = React.useRef(null);
  const scrollFrameRef = React.useRef(null);
  const sidePaneScrollRef = React.useRef(null);

  // Dragging a pane's edge rewraps the text and the side panel; both keep the reader's place.
  useKeepReadingPosition(scrollRef);
  useKeepReadingPosition(sidePaneScrollRef, showSidePane);

  // Each item opens at its top, even when the panel was scrolled deep into the one before.
  React.useLayoutEffect(() => {
    sidePaneScrollRef.current?.scrollTo({ top: 0 });
  }, [sidePaneItem?.key]);

  const handleScroll = (event) => {
    const scrollContainer = event.currentTarget;
    if (scrollFrameRef.current !== null) return;

    scrollFrameRef.current = window.requestAnimationFrame(() => {
      const progress = calculateScrollProgress(scrollContainer);
      if (progressBarRef.current) {
        progressBarRef.current.style.transform = `scaleX(${progress / 100})`;
      }
      scrollFrameRef.current = null;
    });
  };

  React.useEffect(() => () => {
    if (scrollFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollFrameRef.current);
    }
  }, []);

  React.useEffect(() => {
    if (scrollFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = null;
    }
    if (progressBarRef.current) {
      progressBarRef.current.style.transform = 'scaleX(0)';
    }
  }, [activeId]);

  // Memoized so a re-render (opening a glossary definition, changing a reader setting) doesn't
  // hand dangerouslySetInnerHTML a new { __html } object every time, which would otherwise
  // re-sanitize the summary and clear any text the user had selected in it.
  const summaryMarkup = React.useMemo(() => ({
    __html: DOMPurify.sanitize(
      searchHighlight
        ? highlightSearchTerm(activeContent?.summary, searchHighlight)
        : (activeContent?.summary || ''),
    ),
  }), [activeContent?.summary, searchHighlight]);

  return (
    // The reading area and, on wide screens, the side panel docked to the right edge of the
    // window. Each scrolls on its own.
    <div className="flex flex-1 min-w-0 h-full print:block print:h-auto">
      <main
        ref={scrollRef}
        onScroll={handleScroll}
        className={`flex-1 min-w-0 overflow-y-auto bg-white custom-scrollbar h-full print:h-auto print:overflow-visible relative ${readerClassName}`}
      >
        {activeId !== homeId && (
          <div
            className="sticky top-0 left-0 right-0 h-1 bg-gray-100/60 z-20 no-print pointer-events-none"
            aria-hidden="true"
          >
            <div
              ref={progressBarRef}
              className="h-full origin-left bg-gradient-to-r from-[#0099A7] to-[#7654A1] transition-transform duration-75"
              style={{ transform: 'scaleX(0)' }}
            />
          </div>
        )}

        {activeId === homeId ? renderLanding() : (
          <div className="px-4 md:px-10 pb-24 pt-4 md:pt-6 print:px-0">
            {/* The text stops at the chosen line length (--reader-measure in index.css) and is
                centred in the space between the panes. */}
            <div className="mx-auto w-full max-w-[var(--reader-measure)] print:max-w-none">
              <div
                id="summary-top"
                className="no-print mb-6 flex items-center text-xs font-bold text-[#007A86] uppercase tracking-widest gap-2 scroll-mt-24"
              >
                <button onClick={onNavigateHome} className="hover:text-purple-700">
                  {homeLabel}
                </button>
                <AppIcon name="ChevronRight" size={12} />
                <span className="text-gray-800">{activeContent?.title}</span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                  <Highlight
                    text={formatContentTitle(activeContent)}
                    query={searchHighlight}
                  />
                </h1>
                <span className="flex items-center gap-3 no-print">
                  {activeContent?.sourcePages?.length > 0 && (
                    <span className="text-xs font-semibold text-gray-400">
                      Source {activeContent.sourcePages.length === 1 ? 'page' : 'pages'}{' '}
                      {activeContent.sourcePages.join(', ')}
                    </span>
                  )}
                  {sourceDocumentUrl && (
                    <a
                      href={sourceDocumentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#007A86] hover:text-[#7654A1]"
                    >
                      <AppIcon name="ExternalLink" size={14} />
                      Original PDF
                    </a>
                  )}
                </span>
              </div>

              {showSummary && hasSummary && (
                <div className="animate-fade-in mb-10">
                  <div className="p-8 bg-purple-50 rounded-2xl border border-purple-100 shadow-sm">
                    <h2 className="text-3xl font-extrabold text-gray-900 mb-4">Summary</h2>
                    <div
                      className="text-lg text-gray-700 font-light reader-content summary-content"
                      dangerouslySetInnerHTML={summaryMarkup}
                    />
                  </div>
                </div>
              )}

              {showFullText && (
                <div className={`animate-fade-in ${showSummary && hasSummary ? 'border-t border-gray-100 pt-10' : ''}`}>
                  {renderBeforeSections?.(activeContent)}

                  {activeContent?.sections?.map((section) => (
                    <FullTextSection
                      key={section.computedId}
                      id={section.computedId}
                      section={section}
                      showQA={showQA}
                      query={searchHighlight}
                      glossaryMap={glossaryMap}
                      onTermClick={handleTermClick}
                      bookmarksControls={bookmarksControls}
                      bookmarkSection={bookmarkSection}
                      bookmarkDocumentId={bookmarkDocumentId}
                      chapterId={activeContent.id}
                      chapterPrefix={formatSectionPrefix(activeContent)}
                      fallbackTitle={activeContent.title}
                      buildSectionPath={buildSectionPath}
                      citationSourceTitle={citationSourceTitle}
                      citationMarkdownLabel={citationMarkdownLabel}
                      resourceLinks={resourceLinks}
                      supplement={renderSectionSupplement?.(section)}
                      printAllQA={printAllQA}
                      onNavigateTree={onNavigateTree}
                      referenceContext={referenceContext}
                      onOpenReference={onOpenReference}
                    />
                  ))}
                </div>
              )}

              {!showFullText && !(showSummary && hasSummary) && (
                <div className="p-20 text-center text-gray-300 italic border-2 border-dashed border-gray-100 rounded-3xl">
                  Select an available reading view from the header to display content.
                </div>
              )}

              {(showFullText || (showSummary && hasSummary)) && (
                <div className="mt-16 pt-8 border-t border-gray-200 flex flex-col sm:flex-row items-stretch justify-between gap-4 print:hidden">
                  {previousItem ? (
                    <button
                      onClick={() => onItemChange(previousItem.id)}
                      className="flex items-center gap-3 text-left w-full sm:w-1/2 p-4 rounded-xl border border-gray-200 hover:border-[#7654A1] hover:bg-purple-50 transition-all group"
                    >
                      <span className="shrink-0 text-gray-400 group-hover:text-[#7654A1]">
                        <AppIcon name="ChevronLeft" size={24} />
                      </span>
                      <span>
                        <span className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">
                          Previous
                        </span>
                        <span className="font-bold text-gray-800 text-sm line-clamp-2">
                          {previousItem.title}
                        </span>
                      </span>
                    </button>
                  ) : <div className="hidden sm:block sm:w-1/2" />}

                  {nextItem ? (
                    <button
                      onClick={() => onItemChange(nextItem.id)}
                      className="flex items-center justify-end gap-3 text-right w-full sm:w-1/2 p-4 rounded-xl border border-gray-200 hover:border-[#7654A1] hover:bg-purple-50 transition-all group"
                    >
                      <span>
                        <span className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">
                          Next
                        </span>
                        <span className="font-bold text-gray-800 text-sm line-clamp-2">
                          {nextItem.title}
                        </span>
                      </span>
                      <span className="shrink-0 text-gray-400 group-hover:text-[#7654A1]">
                        <AppIcon name="ChevronRight" size={24} />
                      </span>
                    </button>
                  ) : <div className="hidden sm:block sm:w-1/2" />}
                </div>
              )}

            </div>
          </div>
        )}
      </main>

      {showSidePane && (
        <aside
          id="side-pane"
          aria-label="Side panel"
          className="@container hidden xl:flex flex-col relative shrink-0 w-[var(--side-pane-size)] h-full border-l border-gray-200 bg-slate-50 no-print"
        >
          <ResizeHandle
            edge="left"
            label="Resize the side panel"
            controls="side-pane"
            resize={sidePane.resize}
          />
          {/* The padding is on the inner box, so an expanded section's heading can stay at the
              very top of the panel as its text scrolls; a narrow panel keeps more room for text. */}
          <div ref={sidePaneScrollRef} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
            <div className="px-3 pt-8 pb-10 @sm:px-6">
              {hasContentsList && (
                <TableOfContents
                  sections={sections}
                  showSummary={showSummary && hasSummary}
                  collapsed={Boolean(sidePaneItem)}
                  onExpand={sidePane.onClose}
                />
              )}
              {sidePaneItem ? (
                <ContextPanel
                  key={sidePaneItem.key}
                  item={sidePaneItem}
                  onClose={sidePane.onClose}
                  onOpenTarget={sidePane.onOpenTarget}
                  resourceLinks={resourceLinks}
                />
              ) : (
                <p
                  className={`flex gap-2 text-xs leading-relaxed text-gray-500 ${
                    hasContentsList ? 'mt-8 pt-6 border-t border-gray-200' : ''
                  }`}
                >
                  <AppIcon name="BookOpen" size={14} className="shrink-0 mt-0.5 text-gray-400" />
                  Select an underlined term or reference in the text to see its definition or a
                  preview here.
                </p>
              )}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
};
