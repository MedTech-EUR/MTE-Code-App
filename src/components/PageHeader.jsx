import React from 'react';
import { AppIcon } from './AppIcons';

/**
 * The accents a page outside the reader can take. Reading sections are teal, guided checks
 * (the decision trees) amber, and tools purple. `text` is the shade that meets AA on white.
 * Full class names only: Tailwind cannot generate classes built at runtime.
 */
export const PAGE_ACCENTS = {
  teal: { tile: 'bg-[#0099A7]/10 text-[#007A86] ring-[#0099A7]/15', text: 'text-[#007A86]' },
  amber: { tile: 'bg-amber-50 text-amber-700 ring-amber-600/15', text: 'text-amber-700' },
  purple: { tile: 'bg-[#7654A1]/10 text-[#7654A1] ring-[#7654A1]/15', text: 'text-[#7654A1]' },
};

/** The small link above a page's heading that leads one level up. */
export const PageBackLink = ({ onClick, children, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`group no-print -ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-xs font-bold uppercase tracking-wider text-[#007A86] transition-colors hover:text-[#7654A1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7654A1]/50 ${className}`}
  >
    <AppIcon name="ChevronLeft" size={14} className="transition-transform duration-300 ease-out-soft group-hover:-translate-x-0.5" />
    {children}
  </button>
);

/**
 * The heading every page outside the reader starts with: an optional link back, the section's
 * icon beside the title, and one line of description. `actions` sit to the right of the title
 * (below it on phones). `headingProps` reach the <h1>, for pages that move focus to it.
 */
export const PageHeader = ({
  icon = undefined,
  accent = 'purple',
  eyebrow = undefined,
  title,
  description = undefined,
  back = undefined,
  actions = undefined,
  size = 'lg',
  headingProps = undefined,
  className = 'mb-8',
  children = undefined,
}) => {
  const tone = PAGE_ACCENTS[accent] || PAGE_ACCENTS.purple;
  const compact = size === 'md';

  return (
    // A <div>, not a <header>: the print styles hide every <header> with the app bar.
    <div className={className}>
      {back && (
        <PageBackLink onClick={back.onClick} className="mb-5">
          {back.label}
        </PageBackLink>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        {/* On a phone the description runs the full width, under the icon and the title. */}
        <div className={`grid min-w-0 items-start ${icon ? 'grid-cols-[auto_minmax(0,1fr)] gap-x-4' : 'grid-cols-1'}`}>
          {icon && (
            <span
              aria-hidden="true"
              className={`flex shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${tone.tile} ${
                compact ? 'h-11 w-11' : 'h-12 w-12'
              }`}
            >
              <AppIcon name={icon} size={compact ? 22 : 24} />
            </span>
          )}
          <div className={`min-w-0 ${icon ? 'self-center sm:self-start' : ''}`}>
            {eyebrow && (
              <p className={`mb-1.5 text-xs font-bold uppercase tracking-widest ${tone.text}`}>{eyebrow}</p>
            )}
            <h1
              {...headingProps}
              className={`font-bold tracking-tight text-gray-900 outline-none ${
                compact ? 'text-[1.75rem] leading-9 sm:text-3xl' : 'text-3xl leading-9 sm:text-[2rem] sm:leading-10'
              } ${icon && !eyebrow ? 'sm:pt-1' : ''}`}
            >
              {title}
            </h1>
          </div>
          {description && (
            <p
              className={`mt-3 max-w-2xl leading-relaxed text-gray-600 sm:mt-2 ${compact ? 'text-sm' : 'text-base'} ${
                icon ? 'col-span-2 sm:col-span-1 sm:col-start-2' : ''
              }`}
            >
              {description}
            </p>
          )}
        </div>
        {actions && <div className="no-print flex shrink-0 flex-wrap items-center gap-2 sm:pt-1.5">{actions}</div>}
      </div>
      {children}
    </div>
  );
};
