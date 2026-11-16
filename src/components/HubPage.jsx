import React from 'react';
import { Logo } from './Logo';
import { AppIcon } from './AppIcons';
import { SECTIONS } from '../config/sections';

const accentStyle = (section) => ({
  '--accent': section.color,
  '--accent-text': section.textColor || section.color,
});

// "www.ethicalmedtech.eu" -> "ethicalmedtech.eu", shown beside a section that opens another site.
const siteName = (href) => new URL(href).hostname.replace(/^www\./, '');

/**
 * The control inside a section's heading. Its ::after covers the whole tile or row, so all of it
 * opens the section while the heading stays a heading and the description stays plain text.
 * A section with `href` opens another site in a new tab; the others open a section of the app.
 */
const SectionLink = ({ section, onSelectSection }) => {
  const className = 'cursor-pointer text-left outline-none after:absolute after:inset-0';
  if (section.href) {
    return (
      <a href={section.href} target="_blank" rel="noopener noreferrer" className={className}>
        {section.title}
        <span className="sr-only"> (opens {siteName(section.href)} in a new tab)</span>
      </a>
    );
  }
  return (
    <button type="button" onClick={() => onSelectSection(section.id)} className={className}>
      {section.title}
    </button>
  );
};

/** A document to read. The first one is filled with its accent; the others are white. */
const FeaturedSection = ({ section, filled, onSelectSection, className = '' }) => (
  <li
    style={accentStyle(section)}
    className={`group relative flex flex-col justify-between gap-6 rounded-xl border p-6 @xl:min-h-[13rem] @xl:gap-8 transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--accent)] has-[:focus-visible]:ring-offset-2 @2xl:p-7 print:min-h-0 print:border-gray-300 print:bg-transparent print:text-gray-900 ${
      filled
        ? 'border-transparent bg-[var(--accent-text)] text-white hover:bg-[color-mix(in_srgb,var(--accent-text)_88%,black)]'
        : 'border-gray-200 bg-white text-gray-900 hover:border-[var(--accent)]'
    } ${className}`}
  >
    <div className="flex items-start justify-between" aria-hidden="true">
      <AppIcon
        name={section.icon}
        size={28}
        className={filled ? 'print:text-[var(--accent-text)]' : 'text-[var(--accent-text)]'}
      />
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors duration-150 print:hidden ${
          filled
            ? 'border-white/40 group-hover:border-white group-hover:bg-white group-hover:text-[var(--accent-text)]'
            : 'border-gray-300 text-gray-500 group-hover:border-[var(--accent-text)] group-hover:bg-[var(--accent-text)] group-hover:text-white'
        }`}
      >
        <AppIcon name={section.href ? 'ExternalLink' : 'ArrowRight'} size={18} />
      </span>
    </div>

    <div>
      <h2 className="text-2xl font-semibold tracking-tight">
        <SectionLink section={section} onSelectSection={onSelectSection} />
      </h2>
      <p className={`mt-2 max-w-md text-[0.9375rem] leading-relaxed print:text-gray-700 ${filled ? '' : 'text-gray-600'}`}>
        {section.description}
      </p>
    </div>
  </li>
);

/** A tool or guide: one row of the list under the documents. */
const SectionRow = ({ section, onSelectSection }) => (
  <li
    style={accentStyle(section)}
    className="group relative flex items-start gap-4 px-5 py-4 transition-colors duration-150 hover:bg-gray-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-inset has-[:focus-visible]:ring-[var(--accent)] @2xl:px-6 @2xl:py-5"
  >
    <AppIcon name={section.icon} size={22} className="mt-0.5 shrink-0 text-[var(--accent-text)]" />

    <div className="min-w-0 flex-1 @2xl:grid @2xl:grid-cols-[12rem_minmax(0,1fr)] @2xl:gap-x-6">
      <div>
        <h2 className="text-[1.0625rem] font-semibold leading-6 tracking-tight text-gray-900 transition-colors group-hover:text-[var(--accent-text)]">
          <SectionLink section={section} onSelectSection={onSelectSection} />
        </h2>
        {/* Where a section opens another site, its row says which. */}
        {section.href && (
          <p className="hidden text-xs leading-5 text-gray-500 @2xl:block" aria-hidden="true">{siteName(section.href)}</p>
        )}
      </div>
      <p className="mt-1 text-sm leading-6 text-gray-600 @2xl:mt-0">
        {section.description}
      </p>
    </div>

    <AppIcon
      name={section.href ? 'ExternalLink' : 'ArrowRight'}
      size={18}
      className={`mt-0.5 shrink-0 text-gray-400 transition duration-150 group-hover:text-[var(--accent-text)] print:hidden ${
        section.href ? '' : 'group-hover:translate-x-0.5'
      }`}
    />
  </li>
);

export const HubPage = ({ onSelectSection }) => {
  const sections = SECTIONS.filter((section) => section.available);
  const featured = sections.filter((section) => section.featured);
  const others = sections.filter((section) => !section.featured);

  return (
    <div className="animate-fade-in mx-auto max-w-5xl px-4 pt-8 pb-24 sm:px-8 sm:pt-12 3xl:max-w-6xl">
      {/* Widths follow the room the page has, not the window: the sidebar beside it can be dragged. */}
      <div className="@container">
        {/* The header above already shows the logo; on paper, where the header is absent, it is printed here. */}
        <Logo size={null} className="hidden print:flex mb-6 h-16 aspect-[26/5]" />

        {/* A <div>, not a <header>: the print styles hide every <header>. */}
        <div className="mb-8 @2xl:mb-10">
          <h1 className="max-w-[21ch] text-balance text-[2rem] font-semibold leading-[1.12] tracking-[-0.022em] text-gray-950 outline-none @2xl:text-[2.75rem] @2xl:leading-[1.08]">
            The MedTech Europe Code of Ethical Business Practice
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-gray-600 @2xl:text-lg">
            The Digital Home of the MedTech Europe Code of Ethical Business Practice
          </p>
        </div>

        {featured.length > 0 && (
          <ul className="grid gap-4 @xl:grid-cols-5">
            {featured.map((section, index) => (
              <FeaturedSection
                key={section.id}
                section={section}
                filled={index === 0}
                onSelectSection={onSelectSection}
                className={
                  featured.length === 2 ? (index === 0 ? '@xl:col-span-3' : '@xl:col-span-2') : '@xl:col-span-5'
                }
              />
            ))}
          </ul>
        )}

        {others.length > 0 && (
          <ul className="mt-4 divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white print:border-gray-300">
            {others.map((section) => (
              <SectionRow key={section.id} section={section} onSelectSection={onSelectSection} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
