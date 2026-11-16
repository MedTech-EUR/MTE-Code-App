import React, { useId, useState } from 'react';
import { AppIcon } from './AppIcons';
import { MenuGroup, MenuList, MenuRow, MenuTile, MenuTiles, tileSpan } from './MenuList';
import { PageHeader } from './PageHeader';

const countOf = (count, one, many) => `${count} ${count === 1 ? one : many}`;

// "4 sections · 2 Q&As": what a chapter or annex of a publication holds.
const unitFacts = (unit) => {
  const sections = unit.sections?.length || 0;
  const qas = (unit.sections || []).reduce((total, section) => total + (section.qas?.length || 0), 0);
  return [
    sections > 0 && countOf(sections, 'section', 'sections'),
    qas > 0 && countOf(qas, 'Q&A', 'Q&As'),
  ].filter(Boolean).join(' · ');
};

/** The chapters and annexes of a publication, down two columns where there is room. */
const UnitList = ({ units, headingLevel, onSelectUnit }) => (
  <MenuList columns={units.length === 1 ? 1 : 2}>
    {units.map((unit) => (
      <MenuRow
        key={unit.id}
        headingLevel={headingLevel}
        icon={unit.icon || 'FileText'}
        title={unit.title}
        note={unitFacts(unit)}
        onClick={() => onSelectUnit(unit.id)}
      />
    ))}
  </MenuList>
);

const quietLinkClass = 'inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-[#007A86] transition-colors hover:text-[#7654A1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7654A1]/50';

/** The original PDF and the files that come with a publication. */
const PublicationFiles = ({ document }) => (
  <span className="no-print flex flex-wrap items-center gap-x-5 gap-y-1">
    {document.sourcePdfUrl && (
      <a href={document.sourcePdfUrl} target="_blank" rel="noreferrer" className={quietLinkClass}>
        <AppIcon name="ExternalLink" size={15} />
        Original PDF
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    )}
    {(document.downloads || []).map((file) => (
      <a key={file.url} href={file.url} download={file.filename} className={quietLinkClass}>
        <AppIcon name="Download" size={15} />
        {file.label}
      </a>
    ))}
  </span>
);

/** The search box on a tile whose page is a search: it opens that page with the search done. */
const TileSearch = ({ label, placeholder, onSearch }) => {
  const [query, setQuery] = useState('');
  const inputId = useId();

  return (
    <form
      role="search"
      className="no-print flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(query.trim());
      }}
    >
      <label htmlFor={inputId} className="sr-only">{label}</label>
      <div className="relative min-w-0 flex-1">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
          <AppIcon name="Search" size={16} />
        </span>
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-500 focus:border-[#0099A7] focus:outline-none focus:ring-2 focus:ring-[#0099A7]/25"
        />
      </div>
      <button
        type="submit"
        className="shrink-0 cursor-pointer rounded-lg bg-[#007A86] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#00656F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0099A7] focus-visible:ring-offset-2"
      >
        Search
      </button>
    </form>
  );
};

/**
 * The Transparency page: a tile for each publication and tool (a tool that is a search gets its
 * search box on the tile), then each publication's chapters and annexes with its files.
 */
export const TransparencyLandingPage = ({ documents, onOpenDocument, onOpenUnit, onSearchDocument }) => {
  const publications = documents.filter((document) => document.units?.length > 0);

  return (
    <main className="flex-1 overflow-y-auto bg-slate-50/60 custom-scrollbar h-full">
      <div className="animate-fade-in px-4 sm:px-8 py-8 sm:py-10 max-w-5xl xl:max-w-6xl mx-auto pb-24">
        <PageHeader
          icon="Eye"
          accent="teal"
          title="Transparency"
          description="Access MedTech Europe transparency guidance and related disclosure resources."
        />

        <div className="@container">
          <MenuTiles>
            {documents.map((document, index) => (
              <MenuTile
                key={document.id}
                filled={index === 0}
                icon={document.icon || 'FileText'}
                note={document.publicationDate}
                title={document.title}
                description={document.description}
                className={tileSpan(index, documents.length)}
                onClick={() => onOpenDocument(document.id)}
              >
                {document.search && onSearchDocument && (
                  <TileSearch
                    label={document.search.label}
                    placeholder={document.search.placeholder}
                    onSearch={(query) => onSearchDocument(document.id, query)}
                  />
                )}
              </MenuTile>
            ))}
          </MenuTiles>

          {publications.map((document) => (
            <MenuGroup
              key={document.id}
              title={`In the ${document.title}`}
              action={<PublicationFiles document={document} />}
            >
              <UnitList
                units={document.units}
                headingLevel="h3"
                onSelectUnit={(unitId) => onOpenUnit(document.id, unitId)}
              />
            </MenuGroup>
          ))}
        </div>
      </div>
    </main>
  );
};

export const TransparencyDocumentLandingPage = ({
  document,
  units,
  onSelectUnit,
  sourcePdfUrl,
  onBack,
}) => (
  <div className="animate-fade-in px-4 sm:px-8 py-8 sm:py-10 max-w-6xl 3xl:max-w-7xl mx-auto pb-24">
    <PageHeader
      icon={document.icon || 'FileText'}
      accent="teal"
      eyebrow={document.eyebrow || 'MedTech Europe Code of Ethical Business Practice'}
      title={document.title}
      description={document.publicationDate}
      back={{ label: 'Transparency', onClick: onBack }}
      actions={sourcePdfUrl && (
        <a
          href={sourcePdfUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-bold text-[#7654A1] hover:border-[#7654A1] transition-colors"
        >
          <AppIcon name="ExternalLink" size={16} />
          View original PDF
        </a>
      )}
    />

    <UnitList units={units} headingLevel="h2" onSelectUnit={onSelectUnit} />
  </div>
);
