import React from 'react';
import { Logo } from './Logo';
import { MenuList, MenuRow, MenuTile, MenuTiles, siteName, tileSpan } from './MenuList';
import { SECTIONS } from '../config/sections';

// A section with `href` opens another site in a new tab; the others open a section of the app.
const openProps = (section, onSelectSection) => (
  section.href ? { href: section.href } : { onClick: () => onSelectSection(section.id) }
);

export const HubPage = ({ onSelectSection }) => {
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
          <h1 className="max-w-[21ch] text-balance text-[2rem] font-semibold leading-[1.12] tracking-[-0.022em] text-gray-950 outline-none @2xl:text-[2.75rem] @2xl:leading-[1.08]">
            The MedTech Europe Code of Ethical Business Practice
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-gray-600 @2xl:text-lg">
            The Digital Home of the MedTech Europe Code of Ethical Business Practice
          </p>
        </div>

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
