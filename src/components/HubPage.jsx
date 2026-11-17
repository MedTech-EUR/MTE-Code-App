import React from 'react';
import { AppIcon } from './AppIcons';
import { Logo } from './Logo';
import { MenuGroup, MenuList, MenuRow, MenuTile, MenuTiles, siteName, tileSpan } from './MenuList';
import { SECTIONS } from '../config/sections';
import { FULL_CODE_DATA } from '../data/codeData';
import { getTransparencyUnit } from '../data/transparency/transparencyData';
import { describeBookmark, describeRecentPage, selectReturnVisit } from '../utils/returnVisit';

// A section with `href` opens another site in a new tab; the others open a section of the app.
const openProps = (section, onSelectSection) => (
  section.href ? { href: section.href } : { onClick: () => onSelectSection(section.id) }
);

const BOOKMARK_LOOKUPS = {
  findChapter: (id) => FULL_CODE_DATA.find((chapter) => chapter.id === id),
  findTransparencyUnit: getTransparencyUnit,
};

/**
 * For a returning reader: the pages they read last and their bookmarks, both kept in this
 * browser. Nothing is shown until there is something saved.
 */
const ReturnVisit = ({ recentHistory, bookmarks, onOpenRecentPage, onOpenBookmark }) => {
  const { pages, bookmarks: shown, moreBookmarks } = selectReturnVisit(recentHistory, bookmarks);
  if (pages.length === 0 && shown.length === 0) return null;

  return (
    <div className="mb-10 grid gap-x-6 gap-y-8 @3xl:grid-cols-2 print:hidden">
      {pages.length > 0 && (
        <MenuGroup title="Continue reading" className="min-w-0">
          <MenuList>
            {pages.map((page) => {
              const { title, note } = describeRecentPage(page);
              return (
                <MenuRow
                  key={`recent-${page.section || 'code'}-${page.documentId || ''}-${page.id}`}
                  headingLevel="h3"
                  icon={page.icon || 'BookOpen'}
                  title={title}
                  note={note}
                  onClick={() => onOpenRecentPage(page)}
                />
              );
            })}
          </MenuList>
        </MenuGroup>
      )}
      {shown.length > 0 && (
        <MenuGroup
          title="Your bookmarks"
          note={moreBookmarks > 0 ? `and ${moreBookmarks} more in the menu` : undefined}
          className="min-w-0"
        >
          <MenuList>
            {shown.map((bookmark) => {
              const { title, note } = describeBookmark(bookmark, BOOKMARK_LOOKUPS);
              return (
                <MenuRow
                  key={`bookmark-${bookmark.key || bookmark.id}`}
                  headingLevel="h3"
                  accent="purple"
                  icon="Bookmark"
                  title={title}
                  note={note}
                  onClick={() => onOpenBookmark(bookmark)}
                />
              );
            })}
          </MenuList>
        </MenuGroup>
      )}
    </div>
  );
};

// The words "Ethical Business Practice" in the welcome card: deep aubergine to MedTech purple
// to teal, each dark enough for 4.5:1 on the card. Printed and in forced colours, plain ink.
const TITLE_ACCENT = 'bg-[linear-gradient(100deg,#3a1d66_0%,#611d9d_42%,#0e6f7b_100%)] bg-clip-text text-transparent print:bg-none print:text-gray-950 forced-colors:bg-none forced-colors:text-[CanvasText]';

/**
 * What every visitor sees first: a welcome card with the app's title and a search bar. The
 * search bar is not a second search: it opens the one in the menu, as the "/" key does.
 */
const WelcomeCard = ({ onOpenSearch }) => (
  <section className="relative mb-10 overflow-hidden rounded-[1.75rem] border border-[#7654A1]/15 bg-[radial-gradient(120%_150%_at_0%_0%,#f4eefb_0%,#ffffff_46%,#ecf7f8_100%)] px-6 pt-7 pb-7 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_30px_70px_-38px_rgb(76_42_128/0.45)] @2xl:px-13 @2xl:pt-12 @2xl:pb-11 print:mb-8 print:rounded-none print:border-0 print:bg-none print:p-0 print:shadow-none">
    {/* The MedTech Europe figure, large and faint, as a watermark. */}
    <img
      src="/favicon.svg"
      alt=""
      aria-hidden="true"
      className="pointer-events-none absolute -right-20 -top-10 h-[22rem] rotate-[14deg] opacity-[0.09] select-none @2xl:-right-16 @2xl:-top-12 @2xl:h-[28rem] print:hidden"
    />
    <div className="relative">
      <p className="mb-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#007A86] @2xl:mb-5">
        <span aria-hidden="true" className="h-0.5 w-7 rounded-full bg-[#0099A7]" />
        Welcome to The Code App
      </p>
      <h1 className="max-w-[36ch] text-balance text-[2rem] font-bold leading-[1.08] tracking-[-0.03em] text-slate-900 outline-none @2xl:text-[2.875rem] @2xl:leading-[1.05]">
        The Digital Home of the MedTech Europe Code of{' '}
        <span className={TITLE_ACCENT}>Ethical Business Practice</span>
      </h1>
      {onOpenSearch && (
        <button
          type="button"
          onClick={onOpenSearch}
          className="no-print group mt-7 flex h-13 w-full max-w-[35rem] items-center gap-3 rounded-[0.875rem] border border-gray-200 bg-white pl-4.5 pr-2.5 text-left text-[0.9375rem] text-gray-500 shadow-[0_1px_2px_rgb(15_23_42/0.05),0_8px_24px_-16px_rgb(15_23_42/0.25)] transition-[border-color,box-shadow] hover:border-[#7654A1]/40 hover:shadow-[0_1px_2px_rgb(15_23_42/0.05),0_12px_28px_-14px_rgb(76_42_128/0.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7654A1] @2xl:mt-8"
        >
          <AppIcon name="Search" size={18} className="shrink-0 text-[#7654A1]" />
          <span className="min-w-0 flex-1 truncate">
            <span className="@md:hidden">Search the Code</span>
            <span className="hidden @md:inline">Search the Code, its Q&amp;As and definitions</span>
          </span>
          <kbd aria-hidden="true" className="hidden rounded-md border border-b-2 border-gray-200 bg-gray-50 px-2 py-0.5 font-sans text-xs font-semibold text-gray-500 lg:inline-block">
            /
          </kbd>
        </button>
      )}
    </div>
  </section>
);

export const HubPage = ({
  onSelectSection,
  onOpenSearch,
  recentHistory = [],
  bookmarks = [],
  onOpenRecentPage,
  onOpenBookmark,
}) => {
  const sections = SECTIONS.filter((section) => section.available);
  // The documents to read are the tiles at the top; the tools and guides are listed below them.
  const featured = sections.filter((section) => section.featured);
  const others = sections.filter((section) => !section.featured);

  return (
    <div className="animate-page-in mx-auto max-w-6xl px-4 pt-8 pb-24 sm:px-8 sm:pt-12 3xl:max-w-7xl">
      {/* Widths follow the room the page has, not the window: the sidebar beside it can be dragged. */}
      <div className="@container">
        {/* The header above already shows the logo; on paper, where the header is absent, it is printed here. */}
        <Logo size={null} className="hidden print:flex mb-6 h-16 aspect-[26/5]" />

        {/* A <section>, not a <header>: the print styles hide every <header>. */}
        <WelcomeCard onOpenSearch={onOpenSearch} />

        <ReturnVisit
          recentHistory={recentHistory}
          bookmarks={bookmarks}
          onOpenRecentPage={onOpenRecentPage}
          onOpenBookmark={onOpenBookmark}
        />

        {featured.length > 0 && (
          <MenuTiles>
            {featured.map((section, index) => (
              <MenuTile
                key={section.id}
                accent={section}
                filled={index === 0}
                icon={section.icon}
                title={section.title}
                description={section.description}
                className={tileSpan(index, featured.length)}
                {...openProps(section, onSelectSection)}
              />
            ))}
          </MenuTiles>
        )}

        {others.length > 0 && (
          <MenuList className="mt-4">
            {others.map((section) => (
              <MenuRow
                key={section.id}
                accent={section}
                icon={section.icon}
                title={section.title}
                // Where a section opens another site, its row says which.
                note={section.href ? siteName(section.href) : undefined}
                description={section.description}
                split
                {...openProps(section, onSelectSection)}
              />
            ))}
          </MenuList>
        )}
      </div>
    </div>
  );
};
