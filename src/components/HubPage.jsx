import React from 'react';
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

export const HubPage = ({
  onSelectSection,
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
    <div className="animate-page-in mx-auto max-w-5xl px-4 pt-8 pb-24 sm:px-8 sm:pt-12 3xl:max-w-6xl">
      {/* Widths follow the room the page has, not the window: the sidebar beside it can be dragged. */}
      <div className="@container">
        {/* The header above already shows the logo; on paper, where the header is absent, it is printed here. */}
        <Logo size={null} className="hidden print:flex mb-6 h-16 aspect-[26/5]" />

        {/* A <div>, not a <header>: the print styles hide every <header>. */}
        <div className="mb-8 @2xl:mb-10">
          <h1 className="max-w-[24ch] text-balance text-[2rem] font-semibold leading-[1.12] tracking-[-0.022em] text-gray-950 outline-none @2xl:text-[2.75rem] @2xl:leading-[1.08]">
            The Digital Home of the MedTech Europe Code of Ethical Business Practice
          </h1>
        </div>

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
