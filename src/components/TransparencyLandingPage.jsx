import React from 'react';
import { AppIcon } from './AppIcons';
import { PageHeader } from './PageHeader';

export const TransparencyLandingPage = ({ documents, onOpenDocument }) => (
  <main className="flex-1 overflow-y-auto bg-slate-50/60 custom-scrollbar h-full">
    <div className="animate-fade-in px-4 sm:px-8 py-8 sm:py-10 max-w-5xl xl:max-w-6xl mx-auto pb-24">
      <PageHeader
        icon="Eye"
        accent="teal"
        title="Transparency"
        description="Access MedTech Europe transparency guidance and related disclosure resources."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {documents.map((document) => (
          <button
            key={document.id}
            type="button"
            onClick={() => onOpenDocument(document.id)}
            className="group flex flex-col text-left bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-7 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#0099A7] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0099A7] focus-visible:ring-offset-2 active:scale-[0.99]"
          >
            <span className="flex items-start justify-between gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0099A7]/10 text-[#007A86] ring-1 ring-inset ring-[#0099A7]/15 transition-colors duration-200 group-hover:bg-[#0099A7] group-hover:text-white">
                <AppIcon name={document.icon || 'FileText'} size={24} />
              </span>
              {document.publicationDate && (
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  {document.publicationDate}
                </span>
              )}
            </span>
            <span className="block mt-5 text-xl font-bold tracking-tight text-gray-900">
              {document.title}
            </span>
            {document.description && (
              <span className="block mt-2 flex-1 text-sm leading-relaxed text-gray-600">
                {document.description}
              </span>
            )}
            <span className="mt-6 flex items-center text-xs font-bold uppercase tracking-wider text-[#007A86]">
              Open document
              <AppIcon
                name="ChevronRight"
                size={14}
                className="ml-1 transition-transform group-hover:translate-x-1"
              />
            </span>
          </button>
        ))}
      </div>
    </div>
  </main>
);

export const TransparencyDocumentLandingPage = ({
  document,
  units,
  onSelectUnit,
  sourcePdfUrl,
  onBack,
}) => (
  <div className="animate-fade-in px-4 sm:px-8 py-8 sm:py-10 max-w-6xl 3xl:max-w-[96rem] mx-auto pb-24">
    <PageHeader
      icon={document.icon || 'FileText'}
      accent="teal"
      eyebrow={document.eyebrow || 'MedTech Europe Code of Ethical Business Practice'}
      title={document.title}
      description={document.publicationDate}
      back={{ label: 'Transparency', onClick: onBack }}
      className="mb-10"
      actions={sourcePdfUrl && (
        <a
          href={sourcePdfUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-bold text-[#7654A1] hover:border-[#7654A1] transition-colors"
        >
          <AppIcon name="ExternalLink" size={16} />
          View original PDF
        </a>
      )}
    />

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 3xl:grid-cols-4 gap-5">
      {units.map((unit) => (
        <button
          key={unit.id}
          type="button"
          onClick={() => onSelectUnit(unit.id)}
          className="chapter-card bg-white p-6 rounded-2xl border border-gray-200 shadow-sm text-left transition-all flex flex-col h-full active:scale-95 group"
        >
          <span className="p-3 bg-cyan-50 rounded-xl w-fit mb-4 text-[#007A86] group-hover:bg-[#0099A7] group-hover:text-white transition-colors">
            <AppIcon name={unit.icon || 'FileText'} size={26} />
          </span>
          <span className="text-lg font-bold text-gray-900 mb-2">{unit.title}</span>
          <span className="mt-auto pt-6 flex items-center text-xs font-bold text-[#7654A1] uppercase tracking-wider">
            Read
            <AppIcon
              name="ChevronRight"
              size={14}
              className="ml-1 transition-transform group-hover:translate-x-1"
            />
          </span>
        </button>
      ))}
    </div>
  </div>
);
