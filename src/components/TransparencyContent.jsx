import React from 'react';
import declarationTemplateRaw from '../data/declaration-csv-template.csv?raw';
import declarationTemplateUrl from '../data/declaration-csv-template.csv?url&no-inline';
import disclosureGuidelinesPdfUrl from '../data/mte-code_disclosure_guidelines.pdf?url';
import {
  DISCLOSURE_GUIDELINES_DOCUMENT,
  TRANSPARENCY_DOCUMENTS,
} from '../data/transparency/transparencyData';
import {
  buildTransparencySectionPath,
  HISTORICAL_DECLARATIONS_DOCUMENT_ID,
} from '../utils/routeUtils';
import { CsvTemplatePreview } from './CsvTemplatePreview';
import { DocumentReader } from './DocumentReader';
import { HistoricalDeclarationsContent } from './HistoricalDeclarationsContent';
import {
  TransparencyDocumentLandingPage,
  TransparencyLandingPage,
} from './TransparencyLandingPage';

const DECLARATION_TEMPLATE_ID = 'declaration-csv-template';
const EMPTY_RESOURCE_LINKS = Object.freeze({});
const DISCLOSURE_RESOURCE_LINKS = Object.freeze({
  [DECLARATION_TEMPLATE_ID]: Object.freeze({
    url: declarationTemplateUrl,
    filename: 'declaration-csv-template.csv',
  }),
});

// Landing-page tile for the Historical Declarations registry. It is listed with the real
// publications but isn't a TRANSPARENCY_DOCUMENTS entry: it has no units/sections and is
// handled as a special case below rather than by the generic document reader. `search` puts
// its search box on the tile.
const HISTORICAL_DECLARATIONS_CARD = Object.freeze({
  id: HISTORICAL_DECLARATIONS_DOCUMENT_ID,
  title: 'Historical Declarations',
  description: 'Search past transparency declarations by company, beneficiary, year, or country.',
  icon: 'Search',
  search: Object.freeze({
    label: 'Search past declarations by company or beneficiary name',
    placeholder: 'Company or beneficiary',
  }),
});

// The Disclosure Guidelines' tile also offers the published PDF and the Annex I template.
const TRANSPARENCY_LANDING_CARDS = Object.freeze([
  ...TRANSPARENCY_DOCUMENTS.map((document) => (
    document.id === DISCLOSURE_GUIDELINES_DOCUMENT.id
      ? {
        ...document,
        sourcePdfUrl: disclosureGuidelinesPdfUrl,
        downloads: [{ label: 'Annex I template (CSV)', url: declarationTemplateUrl, filename: 'declaration-csv-template.csv' }],
      }
      : document
  )),
  HISTORICAL_DECLARATIONS_CARD,
]);

export const TransparencyContent = ({
  activeId,
  activeDocumentId,
  activeContent,
  onNavigateTransparencyHome,
  onNavigateDocument,
  onNavigateUnit,
  onSearchHistoricalDeclarations,
  showFullText,
  showQA,
  searchHighlight,
  glossaryMap,
  handleTermClick,
  scrollRef,
  bookmarksControls,
  referenceContext,
  onOpenReference,
  sidePane,
  footer,
}) => {
  if (!activeDocumentId) {
    return (
      <TransparencyLandingPage
        documents={TRANSPARENCY_LANDING_CARDS}
        onOpenDocument={onNavigateDocument}
        onOpenUnit={onNavigateUnit}
        onSearchDocument={(documentId, query) => onSearchHistoricalDeclarations?.(query)}
        footer={footer}
      />
    );
  }

  if (activeDocumentId === HISTORICAL_DECLARATIONS_DOCUMENT_ID) {
    return (
      <HistoricalDeclarationsContent
        onNavigateTransparencyHome={onNavigateTransparencyHome}
        footer={footer}
      />
    );
  }

  const activeDocument = TRANSPARENCY_DOCUMENTS.find(
    (document) => document.id === activeDocumentId,
  );

  if (!activeDocument) {
    return (
      <TransparencyLandingPage
        documents={TRANSPARENCY_LANDING_CARDS}
        onOpenDocument={onNavigateDocument}
        onOpenUnit={onNavigateUnit}
        onSearchDocument={(documentId, query) => onSearchHistoricalDeclarations?.(query)}
        footer={footer}
      />
    );
  }

  const isDisclosureGuidelines = activeDocument.id === DISCLOSURE_GUIDELINES_DOCUMENT.id;
  const sourceDocumentUrl = isDisclosureGuidelines
    ? disclosureGuidelinesPdfUrl
    : activeDocument.sourceDocumentUrl || null;
  const resourceLinks = isDisclosureGuidelines
    ? DISCLOSURE_RESOURCE_LINKS
    : activeDocument.resourceLinks || EMPTY_RESOURCE_LINKS;

  const renderSectionSupplement = (section) => {
    const hasDeclarationTemplate = isDisclosureGuidelines
      && (section.resourceId === DECLARATION_TEMPLATE_ID
        || section.resources?.some((resource) => resource.id === DECLARATION_TEMPLATE_ID));

    if (!hasDeclarationTemplate) return null;

    return (
      <CsvTemplatePreview
        csvText={declarationTemplateRaw}
        downloadUrl={declarationTemplateUrl}
        filename="declaration-csv-template.csv"
      />
    );
  };

  const buildSectionPath = (unitId, sectionId) => (
    buildTransparencySectionPath(activeDocumentId, unitId, sectionId)
  );

  return (
    <DocumentReader
      activeId={activeId}
      activeContent={activeContent}
      items={activeDocument.units || []}
      renderLanding={() => (
        <TransparencyDocumentLandingPage
          document={activeDocument}
          units={activeDocument.units || []}
          onSelectUnit={(unitId) => onNavigateUnit(activeDocumentId, unitId)}
          sourcePdfUrl={sourceDocumentUrl}
          onBack={onNavigateTransparencyHome}
        />
      )}
      onItemChange={(unitId) => onNavigateUnit(activeDocumentId, unitId)}
      onNavigateHome={() => onNavigateDocument(activeDocumentId)}
      homeLabel={activeDocument.title}
      showSummary={false}
      showFullText={showFullText}
      showQA={showQA}
      searchHighlight={searchHighlight}
      glossaryMap={glossaryMap}
      handleTermClick={handleTermClick}
      scrollRef={scrollRef}
      bookmarksControls={bookmarksControls}
      bookmarkSection="transparency"
      bookmarkDocumentId={activeDocumentId}
      formatContentTitle={(content) => content?.displayTitle || content?.title}
      formatSectionPrefix={(content) => content?.citationPrefix || ''}
      buildSectionPath={buildSectionPath}
      citationSourceTitle={
        activeDocument.citationSourceTitle
        || `${activeDocument.title}${activeDocument.publicationDate ? ` (${activeDocument.publicationDate})` : ''}`
      }
      citationMarkdownLabel={activeDocument.citationMarkdownLabel || activeDocument.title}
      resourceLinks={resourceLinks}
      renderSectionSupplement={renderSectionSupplement}
      printAllQA
      sourceDocumentUrl={sourceDocumentUrl}
      readerClassName="transparency-reader"
      referenceContext={referenceContext}
      onOpenReference={onOpenReference}
      sidePane={sidePane}
      footer={footer}
    />
  );
};
