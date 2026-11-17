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
 * The publisher's details on every page, as on ethicalmedtech.eu. Belgian law asks for them on
 * the websites of a legal person (art. 2:20 of the Code of Companies and Associations).
 */
export const PUBLISHER_LINE = 'MedTech Europe AISBL · Rue Joseph II 40 box 3, 1000 Brussels, Belgium · Enterprise number 0508.570.208 · RPM Bruxelles';

const linkClass = 'text-gray-600 underline decoration-gray-300 underline-offset-4 transition-colors hover:text-[#7654A1] hover:decoration-[#7654A1]';

/**
 * The footer at the end of every page: the logo, a few links, the publisher's details and when
 * the app was last updated. Not printed.
 */
export const SiteFooter = ({ onOpenVersionHistory }) => (
  <footer className="no-print border-t border-gray-200 bg-white/80">
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <Logo size={null} className="h-7 aspect-[2305/239]" />
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
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
      <div className="space-y-1 text-xs leading-5 text-gray-500">
        <p>
          {PUBLISHER_LINE} · <a href="mailto:info@medtecheurope.org" className={linkClass}>info@medtecheurope.org</a>
        </p>
        {LAST_UPDATED && (
          <p>
            Last updated: <time dateTime={LAST_UPDATED}>{formatDate(LAST_UPDATED)}</time>
          </p>
        )}
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
