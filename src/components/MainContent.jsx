import React from 'react';
import { DocumentReader } from './DocumentReader';
import { LandingPage } from './LandingPage';
import { AppIcon } from './AppIcons';
import { CODE_CHAPTERS, WEBSITE_CHAPTERS, WEBSITE_PART_ID } from '../data/codeData';
import { getTreesByChapter, isSectionTree } from '../data/treeData';
import { buildCodeSectionPath } from '../utils/routeUtils';

export const MainContent = ({
  activeId,
  activeContent,
  handleChapterChange,
  onNavigateCodeHome,
  showSummary,
  showFullText,
  showQA,
  searchHighlight,
  glossaryMap,
  handleTermClick,
  scrollRef,
  bookmarksControls,
  onNavigateTree,
  referenceContext,
  onOpenReference,
  sidePane,
}) => {
  const renderRelatedTrees = (content) => {
    if (!onNavigateTree) return null;

    const chapterTrees = getTreesByChapter(content?.id).filter((tree) => !isSectionTree(tree));
    if (chapterTrees.length === 0) return null;

    return (
      <div className="mb-8 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 print:hidden">
        <span className="text-amber-600 shrink-0 mt-0.5">
          <AppIcon name="GitBranch" size={18} />
        </span>
        <div className="flex-1">
          <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">
            Related Decision Tree{chapterTrees.length > 1 ? 's' : ''}
          </p>
          <div className="space-y-1">
            {chapterTrees.map((tree) => (
              <button
                key={tree.id}
                onClick={() => onNavigateTree(tree.id)}
                className="text-sm text-amber-700 hover:text-amber-900 font-medium hover:underline flex items-center gap-1 transition-colors"
              >
                {tree.title}
                <AppIcon name="ChevronRight" size={12} />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <DocumentReader
      activeId={activeId}
      activeContent={activeContent}
      // Previous/Next stays within the Code's own chapters, or within the website pages.
      items={activeContent?.part === WEBSITE_PART_ID ? WEBSITE_CHAPTERS : CODE_CHAPTERS}
      renderLanding={() => <LandingPage onSelectChapter={handleChapterChange} />}
      onItemChange={handleChapterChange}
      onNavigateHome={onNavigateCodeHome}
      showSummary={showSummary}
      showFullText={showFullText}
      showQA={showQA}
      searchHighlight={searchHighlight}
      glossaryMap={glossaryMap}
      handleTermClick={handleTermClick}
      scrollRef={scrollRef}
      bookmarksControls={bookmarksControls}
      renderBeforeSections={renderRelatedTrees}
      buildSectionPath={buildCodeSectionPath}
      citationSourceTitle="MedTech Europe Code of Ethical Business Practice"
      citationMarkdownLabel="MedTech Europe Code"
      onNavigateTree={onNavigateTree}
      referenceContext={referenceContext}
      onOpenReference={onOpenReference}
      sidePane={sidePane}
    />
  );
};
