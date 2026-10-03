import React from 'react';
import { Logo } from './Logo';
import { AppIcon } from './AppIcons';
import { SECTIONS } from '../config/sections';
import { WEBSITE_CHAPTERS } from '../data/codeData';
import { isPlainLinkClick } from '../utils/crossReferences';
import { buildChapterPath } from '../utils/routeUtils';

// Website pages the footer links to; every page also has an entry in the sidebar's Website group.
const FOOTER_PAGE_IDS = ['legal-notice', 'privacy'];
const FOOTER_PAGES = WEBSITE_CHAPTERS.filter((page) => FOOTER_PAGE_IDS.includes(page.id));

// Real links, so they can open in a new tab; a plain click stays inside the app.
export const HubFooter = ({ onNavigateChapter }) => (
  <footer className="mt-16 lg:mt-12 pt-6 border-t border-gray-100 text-center text-sm text-gray-500">
    <nav aria-label="About this website" className="flex flex-wrap justify-center gap-x-6 gap-y-2">
      {FOOTER_PAGES.map((page) => (
        <a
          key={page.id}
          href={buildChapterPath(page.id)}
          onClick={(event) => {
            if (!onNavigateChapter || !isPlainLinkClick(event)) return;
            event.preventDefault();
            onNavigateChapter(page.id);
          }}
          className="hover:text-[#007A86] hover:underline"
        >
          {page.title}
        </a>
      ))}
    </nav>
  </footer>
);

export const HubPage = ({ onSelectSection, onNavigateChapter }) => (
  <div className="animate-fade-in py-10 lg:py-8 px-4 max-w-5xl xl:max-w-6xl 3xl:max-w-[110rem] mx-auto overflow-y-auto h-full custom-scrollbar pb-24">
    {/* A smaller heading on laptops and desktops keeps the section cards on the first screen. */}
    <div className="text-center mb-16 lg:mb-8">
      <div className="scale-90 sm:scale-100 origin-center flex justify-center">
        <Logo size={null} className="mx-auto mb-8 lg:mb-5 h-36 lg:h-24 aspect-[26/5] max-w-full" centerImage={true} />
      </div>
      <h1 className="text-4xl font-bold text-gray-900 mb-4 tracking-tight">
        The MedTech Europe Code of Ethical Business Practice
      </h1>
      <p className="text-xl text-gray-500 max-w-2xl mx-auto font-light leading-relaxed">
        The Digital Home of the MedTech Europe Code of Ethical Business Practice
      </p>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-5 gap-8 xl:gap-6 max-w-3xl xl:max-w-none mx-auto">
      {SECTIONS.filter(s => s.available).map((section) => (
        <button
          key={section.id}
          onClick={() => onSelectSection(section.id)}
          className="hub-card group bg-white p-8 xl:p-7 rounded-2xl border border-gray-200 shadow-sm text-left transition-all flex flex-col h-full active:scale-[0.97] relative overflow-hidden"
        >
          {/* Accent bar */}
          <div
            className="absolute top-0 left-0 right-0 h-1 transition-all duration-300 group-hover:h-1.5"
            style={{ backgroundColor: section.color }}
          />

          <div
            className="p-4 rounded-xl w-fit mb-5 transition-colors duration-300"
            style={{
              backgroundColor: `${section.color}12`,
              color: section.color,
            }}
          >
            <AppIcon name={section.icon} size={36} />
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-1">
            {section.title}
          </h2>

          {section.subtitle && (
            <p className="text-xs font-semibold text-gray-400 mb-4 leading-normal uppercase tracking-wider">
              {section.subtitle}
            </p>
          )}

          <p className="text-sm text-gray-500 font-light leading-relaxed mb-6 flex-1">
            {section.description}
          </p>

          <div
            className="flex items-center text-xs font-bold uppercase tracking-wider transition-colors duration-300"
            style={{ color: section.textColor || section.color }}
          >
            Open
            <AppIcon
              name="ChevronRight"
              size={14}
              className="ml-1 transition-transform group-hover:translate-x-1"
            />
          </div>
        </button>
      ))}
    </div>

    <HubFooter onNavigateChapter={onNavigateChapter} />
  </div>
);
