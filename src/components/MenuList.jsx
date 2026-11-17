import React from 'react';
import { AppIcon } from './AppIcons';

/**
 * The menus of the app: the Home page, the Code's chapters, the Transparency publications and
 * the decision trees. A menu is made of tiles (`MenuTile`, for the few main entries) and lists
 * of rows (`MenuList` with `MenuRow`), optionally under a heading (`MenuGroup`).
 *
 * The accents match PageHeader's: teal for the reading sections, amber for the decision trees,
 * purple for the tools. `color` fills icons and borders; `textColor` is the shade that meets AA
 * for text on white.
 */
export const MENU_ACCENTS = {
  teal: { color: '#0099A7', textColor: '#007A86' },
  amber: { color: '#D97706', textColor: '#B45309' },
  purple: { color: '#7654A1', textColor: '#7654A1' },
};

// An accent is one of the names above, or a { color, textColor } of its own.
const accentStyle = (accent = 'teal') => {
  const tone = typeof accent === 'string' ? MENU_ACCENTS[accent] || MENU_ACCENTS.teal : accent;
  return { '--accent': tone.color, '--accent-text': tone.textColor || tone.color };
};

// "www.ethicalmedtech.eu" -> "ethicalmedtech.eu", for an entry that opens another site.
export const siteName = (href) => new URL(href).hostname.replace(/^www\./, '');

/**
 * The control inside an entry's heading. Its ::after covers the whole tile or row, so all of it
 * opens the entry while the heading stays a heading and the description stays plain text.
 * An entry with `href` opens another site in a new tab; the others call `onClick`.
 */
const MenuAction = ({ onClick, href, children }) => {
  const className = 'cursor-pointer text-left outline-none after:absolute after:inset-0';
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
        <span className="sr-only"> (opens {siteName(href)} in a new tab)</span>
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );
};

// A chapter's number is shown as a figure; anything else is an icon from the registry.
const isNumber = (icon) => icon !== undefined && icon !== null && icon !== '' && !Number.isNaN(Number(icon));

/**
 * One of a menu's main entries. `filled` paints it with its accent (the page's first entry);
 * otherwise it is white. `note` is a short fact beside the arrow, such as a publication date.
 * `children` sit under the description and stay usable on their own (a search box, links).
 */
export const MenuTile = ({
  as: Element = 'li',
  headingLevel: Heading = 'h2',
  accent = 'teal',
  filled = false,
  icon,
  note = undefined,
  title,
  description = undefined,
  onClick = undefined,
  href = undefined,
  className = '',
  children = undefined,
}) => (
  <Element
    style={accentStyle(accent)}
    className={`group relative flex flex-col justify-between gap-6 rounded-xl border p-6 transition-[background-color,border-color,box-shadow,translate,scale] duration-300 ease-out-soft hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] active:duration-100 has-[h2>:focus-visible,h3>:focus-visible]:ring-2 has-[h2>:focus-visible,h3>:focus-visible]:ring-[var(--accent)] has-[h2>:focus-visible,h3>:focus-visible]:ring-offset-2 @xl:min-h-[13rem] @xl:gap-8 @2xl:p-7 print:min-h-0 print:border-gray-300 print:bg-transparent print:text-gray-900 ${
      filled
        ? 'border-transparent bg-[var(--accent-text)] text-white shadow-[0_1px_2px_rgb(15_23_42/0.08)] hover:bg-[color-mix(in_srgb,var(--accent-text)_90%,black)] hover:shadow-[0_18px_40px_-18px_color-mix(in_srgb,var(--accent-text)_70%,transparent)]'
        : 'border-gray-200 bg-white text-gray-900 shadow-[0_1px_2px_rgb(15_23_42/0.04)] hover:border-[var(--accent)] hover:shadow-[0_18px_40px_-20px_rgb(15_23_42/0.22)]'
    } ${className}`}
  >
    <div className="flex items-start justify-between gap-4" aria-hidden={note ? undefined : 'true'}>
      <AppIcon
        name={icon}
        size={28}
        className={filled ? 'print:text-[var(--accent-text)]' : 'text-[var(--accent-text)]'}
      />
      <span className="flex items-center gap-3">
        {note && (
          <span className={`text-sm font-medium print:text-gray-700 ${filled ? '' : 'text-gray-600'}`}>{note}</span>
        )}
        <span
          aria-hidden="true"
          className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors duration-300 ease-out-soft print:hidden ${
            filled
              ? 'border-white/40 group-hover:border-white group-hover:bg-white group-hover:text-[var(--accent-text)]'
              : 'border-gray-300 text-gray-500 group-hover:border-[var(--accent-text)] group-hover:bg-[var(--accent-text)] group-hover:text-white'
          }`}
        >
          <AppIcon
            name={href ? 'ExternalLink' : 'ArrowRight'}
            size={18}
            className={`transition-transform duration-300 ease-out-soft ${
              href ? 'group-hover:-translate-y-px group-hover:translate-x-px' : 'group-hover:translate-x-0.5'
            }`}
          />
        </span>
      </span>
    </div>

    <div>
      <Heading className="text-2xl font-semibold tracking-tight">
        <MenuAction onClick={onClick} href={href}>{title}</MenuAction>
      </Heading>
      {description && (
        <p className={`mt-2 max-w-md text-[0.9375rem] leading-relaxed print:text-gray-700 ${filled ? '' : 'text-gray-600'}`}>
          {description}
        </p>
      )}
      {/* Above the heading control's ::after, so these stay clickable. */}
      {children && <div className="relative z-10 mt-5">{children}</div>}
    </div>
  </Element>
);

/**
 * The grid a page's tiles sit in: side by side where there is room, the first one wider. The
 * tiles rise in one after another as the page opens (`stagger`, index.css).
 */
export const MenuTiles = ({ children, className = '' }) => (
  <ul className={`stagger grid gap-4 @xl:grid-cols-5 ${className}`}>{children}</ul>
);

// Two tiles share a row 3:2; one, or more than two, each take a full row.
export const tileSpan = (index, count) => (
  count === 2 ? (index === 0 ? '@xl:col-span-3' : '@xl:col-span-2') : '@xl:col-span-5'
);

// Full class names only: Tailwind cannot generate classes built at runtime.
const LIST_COLUMNS = {
  1: '',
  // Down the first column, then the second, so numbered entries read 1 to 5 and 6 to 10.
  2: '@2xl:grid-flow-col @2xl:grid-cols-2 @2xl:grid-rows-[repeat(var(--menu-rows),auto)]',
  3: '@3xl:grid-cols-3',
};

/**
 * A list of rows in one outlined box, in one, two or three columns where there is room. Widths
 * follow the list's own width, not the window's: the panes beside a page can be dragged.
 */
export const MenuList = ({ columns = 1, className = '', children }) => {
  const count = React.Children.count(children);

  return (
    <div className={`@container overflow-hidden rounded-xl border border-gray-200 bg-white print:border-gray-300 ${className}`}>
      {/* Each row draws its top and left line; the list is shifted so the outer ones are cut off.
          The rows rise in one after another as the list appears (`stagger`, index.css). */}
      <ul
        style={{ '--menu-rows': Math.ceil(count / 2) }}
        className={`stagger -ml-px -mt-px grid ${LIST_COLUMNS[columns] || ''}`}
      >
        {children}
        {/* An odd number of rows leaves the second column one short: an empty cell closes its lines. */}
        {columns === 2 && count % 2 === 1 && (
          <li aria-hidden="true" className="hidden border-l border-t border-gray-200 @2xl:block" />
        )}
      </ul>
    </div>
  );
};

/**
 * One entry of a `MenuList`. `icon` is an icon name or a chapter number. `note` is a short fact
 * under the title. With `split`, the description sits beside the title where the list is wide
 * (for one-column lists); otherwise under it. `titleWidth` is the title column's width then.
 * `clamp` cuts a long description off after three lines.
 */
export const MenuRow = ({
  headingLevel: Heading = 'h2',
  accent = 'teal',
  icon,
  title,
  note = undefined,
  description = undefined,
  split = false,
  titleWidth = '12rem',
  clamp = false,
  onClick = undefined,
  href = undefined,
}) => (
  <li
    style={{ ...accentStyle(accent), '--menu-title-width': titleWidth }}
    className="group relative flex items-start gap-4 border-l border-t border-gray-200 px-5 py-4 transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--accent)_5%,white)] active:bg-[color-mix(in_srgb,var(--accent)_9%,white)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-inset has-[:focus-visible]:ring-[var(--accent)] @2xl:px-6 @2xl:py-5 print:break-inside-avoid"
  >
    {isNumber(icon) ? (
      <span aria-hidden="true" className="w-[1.375rem] shrink-0 text-center text-lg font-semibold leading-6 tabular-nums text-[var(--accent-text)]">
        {icon}
      </span>
    ) : (
      <AppIcon name={icon} size={22} className="mt-0.5 shrink-0 text-[var(--accent-text)]" />
    )}

    <div className={`min-w-0 flex-1 ${split ? '@2xl:grid @2xl:grid-cols-[var(--menu-title-width)_minmax(0,1fr)] @2xl:gap-x-6' : ''}`}>
      <div>
        <Heading className="text-[1.0625rem] font-semibold leading-6 tracking-tight text-gray-900 transition-colors group-hover:text-[var(--accent-text)]">
          <MenuAction onClick={onClick} href={href}>{title}</MenuAction>
        </Heading>
        {note && <p className="text-xs leading-5 text-gray-500">{note}</p>}
      </div>
      {description && (
        <p className={`mt-1 text-sm leading-6 text-gray-600 ${split ? '@2xl:mt-0' : ''} ${clamp ? 'line-clamp-3 print:line-clamp-none' : ''}`}>
          {description}
        </p>
      )}
    </div>

    <AppIcon
      name={href ? 'ExternalLink' : 'ArrowRight'}
      size={18}
      className={`mt-0.5 shrink-0 text-gray-400 transition duration-300 ease-out-soft group-hover:text-[var(--accent-text)] print:hidden ${
        href ? 'group-hover:-translate-y-px group-hover:translate-x-px' : 'group-hover:translate-x-1'
      }`}
    />
  </li>
);

/** A heading over part of a menu, with an optional short fact after it and a link on the right. */
export const MenuGroup = ({ title, note = undefined, action = undefined, className = 'mt-9', children }) => (
  <section className={className}>
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
      <h2 className="text-base font-semibold tracking-tight text-gray-900">
        {title}
        {note && <span className="ml-2.5 text-sm font-normal text-gray-500">{note}</span>}
      </h2>
      {action}
    </div>
    {children}
  </section>
);
