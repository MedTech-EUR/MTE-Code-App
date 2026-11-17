import React from 'react';
import { Logo } from './Logo';
import { isPlainLinkClick } from '../utils/crossReferences';

/**
 * The date of the last change to the app: the date of the commit the build was made from
 * (vite.config.ts sets it from `git log`). Empty when the build had no Git history, and then
 * the footer leaves the line out.
 */
const LAST_UPDATED = import.meta.env.VITE_LAST_UPDATED || '';

const formatDate = (isoDate) => new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
}).format(new Date(`${isoDate}T00:00:00Z`));

/**
 * The publisher's details, in the Home page's footer, as on ethicalmedtech.eu. Belgian law asks
 * for them on the websites of a legal person (art. 2:20 of the Code of Companies and Associations).
 */
export const PUBLISHER_LINE = 'MedTech Europe AISBL · Rue Joseph II 40 box 3, 1000 Brussels, Belgium · Enterprise number 0508.570.208 · RPM Bruxelles';

const linkClass = 'text-gray-600 underline decoration-gray-300 underline-offset-2 transition-colors hover:text-[#7654A1] hover:decoration-[#7654A1]';

/**
 * The footer at the end of the Home page: the logo, a few links, the publisher's details and when
 * the app was last updated, in small print (10px links, 9px details), two lines on a wide screen.
 * On a narrow one the date follows the publisher's details in the same paragraph; from `@3xl` that
 * paragraph's parts become grid cells (`contents`), and the date moves to the right of the links.
 * Not printed.
 */
export const SiteFooter = ({ onOpenVersionHistory }) => (
  <footer className="no-print border-t border-gray-200 bg-white/80">
    <div className="@container mx-auto max-w-6xl px-4 py-4 sm:px-8 3xl:max-w-7xl">
      <div className="grid gap-y-1 text-[0.625rem] @3xl:grid-cols-[1fr_auto] @3xl:items-center @3xl:gap-x-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Logo size={null} className="h-3.5 aspect-[2305/239]" />
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-3 gap-y-1 leading-4">
              <li>
                <a
                  href="/code/changelog"
                  className={linkClass}
                  onClick={(event) => {
                    if (!onOpenVersionHistory || !isPlainLinkClick(event)) return;
                    event.preventDefault();
                    onOpenVersionHistory();
                  }}
                >
                  Version History
                </a>
              </li>
              <li>
                <a href="https://www.ethicalmedtech.eu/" target="_blank" rel="noopener noreferrer" className={linkClass}>
                  ethicalmedtech.eu<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
              <li>
                <a href="https://www.medtecheurope.org/" target="_blank" rel="noopener noreferrer" className={linkClass}>
                  medtecheurope.org<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            </ul>
          </nav>
        </div>
        <p className="text-[0.5625rem] leading-[0.875rem] text-gray-500 @3xl:contents">
          <span className="@3xl:col-span-2 @3xl:row-start-2">
            {PUBLISHER_LINE} · <a href="mailto:info@medtecheurope.org" className={linkClass}>info@medtecheurope.org</a>
          </span>
          {LAST_UPDATED && (
            <span className="@3xl:col-start-2 @3xl:row-start-1">
              <span className="@3xl:hidden"> · </span>
              <span className="whitespace-nowrap">
                Last updated: <time dateTime={LAST_UPDATED}>{formatDate(LAST_UPDATED)}</time>
              </span>
            </span>
          )}
        </p>
      </div>
    </div>
  </footer>
);

/**
 * Puts the footer at the end of a page's scrolling area, and at its foot when the page is
 * shorter than the window. `contentClassName` takes what was the area's bottom padding.
 */
export const WithFooter = ({ footer, contentClassName = '', children }) => (
  footer ? (
    <div className="flex min-h-full flex-col print:block print:min-h-0">
      <div className={`flex-1 ${contentClassName}`}>{children}</div>
      {footer}
    </div>
  ) : children
);
