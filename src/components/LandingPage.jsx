import React from 'react';
import { CODE_CHAPTERS, CODE_PARTS } from '../data/codeData';
import { CODE_EDITION, CODE_VERSION, codeReleaseLabel } from '../data/codeEdition';
import { summarizeHtml } from '../utils/pageMeta';
import { Logo } from './Logo';
import { MenuGroup, MenuList, MenuRow } from './MenuList';
import { PageHeader } from './PageHeader';

// Three chapters share one row; a longer part runs down two columns; a single chapter gets the
// full width, with its summary beside its title.
const columnsFor = (count) => (count === 1 ? 1 : count === 3 ? 3 : 2);

// A row shows how its chapter's summary opens: its first paragraph or list item, as plain text.
const summaryLead = (summary) => {
    const lead = String(summary || '').match(/^[\s\S]*?<\/(?:p|li)>/i)?.[0] || summary;
    return summarizeHtml(lead, 200);
};

export const LandingPage = ({ onSelectChapter }) => (
    <div className="animate-page-in px-4 sm:px-8 py-8 sm:py-10 max-w-6xl 3xl:max-w-7xl mx-auto pb-24">
        {/* The header above already shows the logo; on paper, where the header is absent, it is printed here. */}
        <Logo size={null} className="hidden print:flex mb-6 h-16 aspect-[26/5]" />
        <PageHeader
            icon="FileText"
            accent="teal"
            title="The MedTech Europe Code of Ethical Business Practice"
            description={`Code text: ${codeReleaseLabel(CODE_EDITION, CODE_VERSION)}.`}
            className="mb-0"
        />
        {CODE_PARTS.map((part) => {
            const chapters = CODE_CHAPTERS.filter((chapter) => chapter.part === part.id);
            if (chapters.length === 0) return null;
            const columns = columnsFor(chapters.length);

            return (
                <MenuGroup key={part.id} title={part.label}>
                    <MenuList columns={columns}>
                        {chapters.map((chapter) => (
                            <MenuRow
                                key={chapter.id}
                                tourId={`chapter-${chapter.id}`}
                                headingLevel="h3"
                                icon={chapter.icon}
                                title={chapter.title}
                                description={summaryLead(chapter.summary)}
                                split={columns === 1}
                                titleWidth="19rem"
                                clamp
                                onClick={() => onSelectChapter(chapter.id)}
                            />
                        ))}
                    </MenuList>
                </MenuGroup>
            );
        })}
    </div>
);
