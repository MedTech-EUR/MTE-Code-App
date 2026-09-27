import React, { Suspense, lazy, useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { FULL_CODE_DATA } from './data/codeData';
import { REFERENCE_INDEX } from './data/referenceIndex';
import { DefinitionPopup } from './components/DefinitionPopup';
import { extractGlossaryMap, generateSectionId } from './utils/textUtils';
import { useDebounce } from './hooks/useDebounce';
import { useSearch } from './hooks/useSearch';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { usePWAInstall } from './hooks/usePWAInstall';
import { useAppRouting } from './hooks/useAppRouting';
import { useBookmarks } from './hooks/useBookmarks';
import { useRecentHistory } from './hooks/useRecentHistory';
import { useReaderSettings } from './hooks/useReaderSettings';
import { useSidePanelFits } from './hooks/useSidePanelFits';
import { usePaneWidths } from './hooks/usePaneWidths';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MainContent } from './components/MainContent';
import { InstallPrompt } from './components/InstallPrompt';
import { HubPage } from './components/HubPage';
import { TreeContent } from './components/TreeContent';
import { QuizContent } from './components/quiz/QuizContent';
import { TransparencyContent } from './components/TransparencyContent';
import { SectionLoadError } from './components/SectionLoadError';
import { getTransparencyUnit } from './data/transparency/transparencyData';
import { getReaderMeasure } from './config/readerSettings';
import { CVS_CHECK_TREE_ID } from './config/sections';
import {
  describeReferenceTarget,
  findReferenceTarget,
  getReferenceAnchor,
  getReferenceHref,
  getReferenceTarget,
  referenceKey,
} from './utils/crossReferences';

const TPPTContent = lazy(() =>
  import('./components/TPPTContent')
    .then((module) => ({
      default: module.TPPTContent,
    }))
    // A failed chunk fetch (offline, or removed by a newer deploy) would
    // otherwise reject inside Suspense and blank the whole app.
    .catch(() => ({
      default: ({ onGoHome }) => (
        <SectionLoadError sectionName="TPPT Checker" onGoHome={onGoHome} />
      ),
    }))
);

const EventSupportContent = lazy(() =>
  import('./components/EventSupportContent')
    .catch(() => ({
      default: ({ onGoHome }) => (
        <SectionLoadError sectionName="“Can we support this event?” guide" onGoHome={onGoHome} />
      ),
    }))
);

if (typeof FULL_CODE_DATA !== 'undefined') {
  FULL_CODE_DATA.forEach(chapter => {
    chapter.sections.forEach((section, idx) => {
      section.computedId = generateSectionId(chapter.id, section.title, idx);
    });
  });
}

const App = () => {
  const [activeSection, setActiveSection] = useState(null); // null = Home, 'code', 'trees', 'quiz', 'tppt', 'transparency', 'event-support'
  const [activeId, setActiveId] = useState('home');
  const [activeDocumentId, setActiveDocumentId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSummary, setShowSummary] = useState(true);
  const [showFullText, setShowFullText] = useState(true);
  const [showQA, setShowQA] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [readerOpen, setReaderOpen] = useState(false);
  const {
    readerSize,
    setReaderSize,
    readerLine,
    setReaderLine,
    readerSpace,
    setReaderSpace,
    readerLineLength,
    setReaderLineLength,
    readerSidePanel,
    setReaderSidePanel,
  } = useReaderSettings();
  const paneWidths = usePaneWidths();
  const [glossaryMap, setGlossaryMap] = useState({});
  const [activeDefinition, setActiveDefinition] = useState(null);
  // The side panel beside the reader text: one definition or reference preview at a time.
  const [contextItem, setContextItem] = useState(null);
  const contextOpenerRef = useRef(null);
  const scrollRef = useRef(null);

  // Custom Hooks
  useKeyboardShortcuts(setSearchTerm, setSidebarOpen);
  const { installPromptEvent, isIos, showIosPrompt, setShowIosPrompt, handleInstallClick } = usePWAInstall();
  const {
    navigateHome,
    navigateCodeHome,
    navigateChapter,
    navigateCodeSection,
    navigateTreesHome,
    navigateTree,
    navigateQuiz,
    navigateTppt,
    navigateEventSupport,
    navigateTransparencyHome,
    navigateTransparencyDocument,
    navigateTransparencyUnit,
    navigateTransparencySection,
  } = useAppRouting({
    setActiveId,
    setActiveDocumentId,
    setActiveSection,
    setShowSummary,
    setShowFullText,
    setShowQA,
    scrollRef,
  });
  const { bookmarks, toggleBookmark, isBookmarked } = useBookmarks();
  const { history, addHistory } = useRecentHistory();

  const searchScope = activeSection === 'transparency' ? 'transparency' : 'code';
  const searchResponse = useSearch(debouncedSearch, searchScope);
  const searchHighlight = searchResponse?.highlight ?? null;

  useEffect(() => {
    const map = extractGlossaryMap(FULL_CODE_DATA);
    setGlossaryMap(map);
  }, []);

  useEffect(() => {
    if (activeId !== 'home') {
      addHistory(activeId, activeSection || 'code', activeDocumentId);
    }
  }, [activeId, activeSection, activeDocumentId, addHistory]);

  const readerMode = (activeSection === 'code' && activeId !== 'home')
    || (activeSection === 'transparency' && Boolean(activeDocumentId) && activeId !== 'home');
  // The event support checker keeps its answers only while it is open, so the Code opens in a
  // new tab from there instead of replacing the checker.
  const checkerOpen = activeSection === 'event-support';
  const sidePanelFits = useSidePanelFits();
  const sidePanelEnabled = (readerMode || checkerOpen) && readerSidePanel === 'on' && sidePanelFits;

  // A new page starts with the side panel closed.
  useEffect(() => {
    setContextItem(null);
    contextOpenerRef.current = null;
  }, [activeSection, activeId, activeDocumentId]);

  const openContextItem = (item, opener) => {
    contextOpenerRef.current = opener instanceof HTMLElement ? opener : document.activeElement;
    setContextItem(item);
  };

  // Closing returns focus to the term or link that opened the panel.
  const closeContextItem = () => {
    setContextItem(null);
    const opener = contextOpenerRef.current;
    contextOpenerRef.current = null;
    if (opener instanceof HTMLElement && opener.isConnected) {
      window.requestAnimationFrame(() => opener.focus());
    }
  };

  const navigateToReference = (target) => {
    const anchor = getReferenceAnchor(target);
    if (target.publication === 'code') {
      if (anchor) navigateCodeSection(target.unitId, anchor);
      else navigateChapter(target.unitId);
    } else if (anchor) {
      navigateTransparencySection(target.documentId, target.unitId, anchor);
    } else {
      navigateTransparencyUnit(target.documentId, target.unitId);
    }
  };

  const openContextTarget = (target) => {
    setContextItem(null);
    contextOpenerRef.current = null;
    navigateToReference(target);
  };

  const openTargetInNewTab = (target) => {
    window.open(getReferenceHref(target), '_blank', 'noopener,noreferrer');
  };

  const glossaryTarget = getReferenceTarget(REFERENCE_INDEX, 'code:glossary');

  const buildDefinitionItem = (entry) => ({
    key: `definition:${entry.id}`,
    label: 'Definition',
    title: entry.term,
    html: entry.definition,
    ...(glossaryTarget && {
      target: glossaryTarget,
      href: getReferenceHref(glossaryTarget),
      actionLabel: checkerOpen ? 'Open the Glossary in a new tab' : 'Open the Glossary',
    }),
  });

  const buildReferenceItem = (target) => ({
    key: referenceKey(target),
    ...describeReferenceTarget(target),
    ...(checkerOpen && { actionLabel: 'Open in the Code in a new tab' }),
    target,
    href: getReferenceHref(target),
  });

  const handleTermClick = (termKey, opener) => {
    const entry = glossaryMap[termKey];
    if (!entry) return;
    if (sidePanelEnabled) {
      openContextItem(buildDefinitionItem(entry), opener);
      return;
    }
    setActiveDefinition({ term: entry.term, definition: entry.definition });
  };

  // References in the text preview in the side panel when it fits, and open directly otherwise.
  // In the checker they open in the definition dialog instead, so its answers are kept.
  const handleOpenReference = (key, opener) => {
    const target = getReferenceTarget(REFERENCE_INDEX, key);
    if (!target) return;
    if (sidePanelEnabled) openContextItem(buildReferenceItem(target), opener);
    else if (checkerOpen) {
      const preview = describeReferenceTarget(target);
      setActiveDefinition({
        term: [preview.location, preview.title].filter(Boolean).join(' › '),
        definition: preview.html,
        action: { href: getReferenceHref(target), label: 'Open in the Code in a new tab' },
      });
    } else navigateToReference(target);
  };

  const findSearchResultTarget = (hit) => {
    const target = hit?.target || {};
    if (target.kind === 'code-section') {
      return findReferenceTarget(REFERENCE_INDEX, { publication: 'code', unitId: target.chapterId, anchor: target.anchor });
    }
    if (target.kind === 'transparency-section') {
      return findReferenceTarget(REFERENCE_INDEX, {
        publication: 'transparency',
        documentId: target.documentId,
        unitId: target.unitId,
        anchor: target.anchor,
      });
    }
    if (target.kind === 'chapter') {
      return findReferenceTarget(REFERENCE_INDEX, { publication: 'code', unitId: target.chapterId });
    }
    return null;
  };

  const canPreviewSearchResult = (hit) => (
    hit?.target?.kind === 'definition'
      ? Boolean(glossaryMap[hit.target.termId])
      : Boolean(findSearchResultTarget(hit))
  );

  const handlePreviewSearchResult = (hit, opener) => {
    if (hit?.target?.kind === 'definition') {
      const entry = glossaryMap[hit.target.termId];
      if (entry) openContextItem(buildDefinitionItem(entry), opener);
      return;
    }
    const target = findSearchResultTarget(hit);
    if (target) openContextItem(buildReferenceItem(target), opener);
  };

  // Cross-reference links need to know which page they sit on (a page never links to itself).
  const referenceContext = useMemo(() => {
    if (activeSection === 'code') {
      return { index: REFERENCE_INDEX, context: { publication: 'code', unitId: activeId } };
    }
    if (activeSection === 'transparency' && activeDocumentId) {
      return {
        index: REFERENCE_INDEX,
        context: { publication: 'transparency', documentId: activeDocumentId, unitId: activeId },
      };
    }
    return null;
  }, [activeSection, activeId, activeDocumentId]);

  // Applied before the first paint, so saved reading settings don't make the text jump.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--reader-font-size', readerSize);
    root.style.setProperty('--reader-line-height', readerLine);
    root.style.setProperty('--reader-paragraph-spacing', readerSpace);
    root.style.setProperty('--reader-measure', getReaderMeasure(readerLineLength));
  }, [readerSize, readerLine, readerSpace, readerLineLength]);

  const sidePane = sidePanelEnabled
    ? {
      item: contextItem,
      onClose: closeContextItem,
      onOpenTarget: checkerOpen ? openTargetInNewTab : openContextTarget,
      resize: paneWidths.sidePane,
    }
    : null;

  const activeContent = activeSection === 'transparency'
    ? getTransparencyUnit(activeDocumentId, activeId)
    : FULL_CODE_DATA.find((content) => content.id === activeId);

  const handleSectionSelect = (sectionId) => {
    setSidebarOpen(false);
    if (sectionId === 'code') navigateCodeHome();
    if (sectionId === 'trees') navigateTreesHome();
    if (sectionId === 'cvs-check') navigateTree(CVS_CHECK_TREE_ID);
    if (sectionId === 'quiz') navigateQuiz();
    if (sectionId === 'tppt') navigateTppt();
    if (sectionId === 'event-support') navigateEventSupport();
    if (sectionId === 'transparency') navigateTransparencyHome();
  };

  const handleGoHome = () => {
    setSidebarOpen(false);
    navigateHome();
  };

  const handleChapterChange = (id) => {
    setSidebarOpen(false);
    if (searchTerm && searchTerm.trim() !== '') {
      setShowSummary(true);
      setShowFullText(true);
    }
    navigateChapter(id);
  };

  const handleNavigateTree = (treeId) => {
    navigateTree(treeId);
  };

  const handleTreeChange = (treeId) => {
    if (!treeId || treeId === 'home' || treeId === 'trees-home') {
      navigateTreesHome();
      return;
    }
    navigateTree(treeId);
  };

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden print:h-auto print:overflow-visible">
      <DefinitionPopup
        term={activeDefinition?.term}
        definition={activeDefinition?.definition}
        action={activeDefinition?.action}
        onClose={() => setActiveDefinition(null)}
      />
      <InstallPrompt show={showIosPrompt} onClose={() => setShowIosPrompt(false)} />

      <Header
        activeId={activeId}
        activeSection={activeSection}
        setSidebarOpen={setSidebarOpen}
        onGoHome={handleGoHome}
        showSummary={showSummary}
        setShowSummary={setShowSummary}
        showFullText={showFullText}
        setShowFullText={setShowFullText}
        showQA={showQA}
        setShowQA={setShowQA}
        readerOpen={readerOpen}
        setReaderOpen={setReaderOpen}
        readerSize={readerSize}
        setReaderSize={setReaderSize}
        readerLine={readerLine}
        setReaderLine={setReaderLine}
        readerSpace={readerSpace}
        setReaderSpace={setReaderSpace}
        readerLineLength={readerLineLength}
        setReaderLineLength={setReaderLineLength}
        readerSidePanel={readerSidePanel}
        setReaderSidePanel={setReaderSidePanel}
        readerMode={readerMode}
        showSummaryControl={activeSection === 'code'}
        showFullTextControl={activeSection === 'code'}
        showQAControl={Boolean(
          activeContent?.sections?.some((section) => section.qas?.length > 0),
        )}
      />

      <div className="flex flex-1 overflow-hidden relative print:block print:overflow-visible">
        <Sidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          debouncedSearch={debouncedSearch}
          activeId={activeId}
          activeSection={activeSection}
          activeDocumentId={activeDocumentId}
          onNavigateChapter={navigateChapter}
          onNavigateCodeSection={navigateCodeSection}
          onNavigateTrees={navigateTreesHome}
          onNavigateTree={navigateTree}
          onNavigateTransparency={navigateTransparencyHome}
          onNavigateTransparencyDocument={navigateTransparencyDocument}
          onNavigateTransparencyUnit={navigateTransparencyUnit}
          onNavigateTransparencySection={navigateTransparencySection}
          setShowSummary={setShowSummary}
          setShowFullText={setShowFullText}
          setShowQA={setShowQA}
          onGoHome={handleGoHome}
          installPromptEvent={installPromptEvent}
          isIos={isIos}
          setShowIosPrompt={setShowIosPrompt}
          handleInstallClick={handleInstallClick}
          bookmarks={bookmarks}
          recentHistory={history}
          searchResponse={searchResponse}
          onOpenDefinition={handleTermClick}
          onPreviewResult={sidePanelEnabled ? handlePreviewSearchResult : undefined}
          canPreviewResult={canPreviewSearchResult}
          resize={paneWidths.sidebar}
        />

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-30 lg:hidden backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}

        {activeSection === null ? (
          <main ref={scrollRef} className="flex-1 overflow-y-auto bg-white custom-scrollbar h-full">
            <HubPage onSelectSection={handleSectionSelect} />
          </main>
        ) : activeSection === 'code' ? (
          <MainContent
            activeId={activeId}
            activeContent={activeContent}
            handleChapterChange={handleChapterChange}
            onNavigateCodeHome={navigateCodeHome}
            showSummary={showSummary}
            showFullText={showFullText}
            showQA={showQA}
            searchHighlight={searchHighlight}
            glossaryMap={glossaryMap}
            handleTermClick={handleTermClick}
            scrollRef={scrollRef}
            bookmarksControls={{ toggleBookmark, isBookmarked }}
            onNavigateTree={handleNavigateTree}
            referenceContext={referenceContext}
            onOpenReference={handleOpenReference}
            sidePane={sidePane}
          />
        ) : activeSection === 'transparency' ? (
          <TransparencyContent
            activeId={activeId}
            activeDocumentId={activeDocumentId}
            activeContent={activeContent}
            onNavigateTransparencyHome={navigateTransparencyHome}
            onNavigateDocument={navigateTransparencyDocument}
            onNavigateUnit={navigateTransparencyUnit}
            showFullText
            showQA={showQA}
            searchHighlight={searchHighlight}
            glossaryMap={glossaryMap}
            handleTermClick={handleTermClick}
            scrollRef={scrollRef}
            bookmarksControls={{ toggleBookmark, isBookmarked }}
            referenceContext={referenceContext}
            onOpenReference={handleOpenReference}
            sidePane={sidePane}
          />
        ) : activeSection === 'quiz' ? (
          <QuizContent
            onExit={handleGoHome}
          />
        ) : activeSection === 'event-support' ? (
          <Suspense
            fallback={
              <main className="flex-1 h-full overflow-y-auto bg-gray-50/50 custom-scrollbar p-8">
                <div className="max-w-4xl mx-auto bg-white border border-slate-100 rounded-2xl shadow-sm p-6 text-sm font-semibold text-gray-500">
                  Loading the event support checker...
                </div>
              </main>
            }
          >
            <EventSupportContent
              onGoHome={handleGoHome}
              onBack={navigateTreesHome}
              scrollRef={scrollRef}
              glossaryMap={glossaryMap}
              onTermClick={handleTermClick}
              onOpenReference={handleOpenReference}
              sidePane={sidePane}
            />
          </Suspense>
        ) : activeSection === 'tppt' ? (
          <Suspense
            fallback={
              <main className="flex-1 h-full overflow-y-auto bg-gray-50/50 custom-scrollbar p-8">
                <div className="max-w-4xl mx-auto bg-white border border-slate-100 rounded-2xl shadow-sm p-6 text-sm font-semibold text-gray-500">
                  Loading TPPT Checker...
                </div>
              </main>
            }
          >
            <TPPTContent
              onGoHome={handleGoHome}
            />
          </Suspense>
        ) : (
          <TreeContent
            activeId={activeId}
            setActiveId={handleTreeChange}
            onOpenTool={handleSectionSelect}
            scrollRef={scrollRef}
            onOpenReference={navigateToReference}
          />
        )}
      </div>
    </div>
  );
};

export default App;

