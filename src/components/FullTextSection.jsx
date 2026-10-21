import React, { useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { processReaderHtml, getQaAnchorId } from '../utils/textUtils';
import { copyTextToClipboard } from '../utils/clipboardUtils';
import { Highlight } from './Highlight';
import { AppIcon } from './AppIcons';
import { ReaderActions } from './ReaderActions';
import { getTreesBySection } from '../data/treeData';
import { buildCodeSectionPath } from '../utils/routeUtils';
import { resolveResourceLinks } from '../utils/resourceUtils';
import { linkCrossReferences } from '../utils/crossReferences';
import { createLinkedTextHandlers } from '../utils/linkedTextEvents';
import {
    buildQaTitle,
    CITATION_COPIED_MESSAGES,
    formatCitation,
    formatQaPlainText,
    getQaNumberLabel,
} from '../utils/citationText';

const EMPTY_RESOURCE_LINKS = Object.freeze({});

// A Code section's actions fade in when the reader points at the section or moves into it with
// the keyboard, and fade out unhurriedly after a short pause, so moving between sections reads as
// a gentle crossfade. Only keyboard focus counts (:focus-visible): a clicked button keeps focus,
// which would otherwise hold the actions in view. Only devices that can hover hide them: on
// touch screens they always show.
const ACTIONS_REVEAL_ON_HOVER = [
    'transition-opacity duration-500 delay-150 ease-in-out [@media(hover:hover)]:opacity-0',
    'group-hover/section:opacity-100 group-hover/section:duration-350 group-hover/section:delay-0',
    'group-has-[:focus-visible]/section:opacity-100 group-has-[:focus-visible]/section:duration-350 group-has-[:focus-visible]/section:delay-0',
].join(' ');

// The same for each Q&A's own actions, revealed by pointing at or moving into that Q&A.
const QA_ACTIONS_REVEAL_ON_HOVER = [
    'transition-opacity duration-500 delay-150 ease-in-out [@media(hover:hover)]:opacity-0',
    'group-hover/qa:opacity-100 group-hover/qa:duration-350 group-hover/qa:delay-0',
    'group-has-[:focus-visible]/qa:opacity-100 group-has-[:focus-visible]/qa:duration-350 group-has-[:focus-visible]/qa:delay-0',
].join(' ');

// Plain text of reader HTML, as the browser shows it.
const toPlainText = (html) => {
    const element = document.createElement('div');
    element.innerHTML = html;
    return (element.textContent || '').trim();
};

const toQaPlainText = (qa) => formatQaPlainText({
    label: qa.label,
    question: toPlainText(qa.q),
    answer: toPlainText(qa.a),
});

export const FullTextSection = ({
    id,
    section,
    showQA,
    query,
    glossaryMap,
    onTermClick,
    bookmarksControls,
    bookmarkSection = 'code',
    bookmarkDocumentId = null,
    chapterId,
    chapterPrefix,
    fallbackTitle = '',
    buildSectionPath = buildCodeSectionPath,
    citationSourceTitle = 'MedTech Europe Code of Ethical Business Practice',
    citationMarkdownLabel = 'MedTech Europe Code',
    resourceLinks = EMPTY_RESOURCE_LINKS,
    supplement = null,
    printAllQA = false,
    onNavigateTree,
    referenceContext = null,
    onOpenReference,
}) => {
    // A glossary term is linked only where it first appears in the section: the legal
    // text and then each Q&A, in reading order, share one set of linked terms.
    // The { __html } objects are memoized because React rewrites the markup whenever the
    // object changes, which would replace a focused glossary term and clear text selections.
    const { legalTextMarkup, processedQas } = useMemo(() => {
        const linkedTerms = new Set();
        const enableGlossary = !id.includes('glossary');
        // References such as "Chapter 4" become links to the chapter, section or Q&A they name.
        const linkReferences = referenceContext
            ? (html) => linkCrossReferences(html, referenceContext)
            : null;
        const processedHtml = processReaderHtml(resolveResourceLinks(section.legalText, resourceLinks), {
            query,
            highlight: Boolean(query),
            glossaryMap,
            enableGlossary,
            linkedTerms,
            linkReferences,
        });
        const processingOptions = {
            query,
            highlight: Boolean(query),
            glossaryMap,
            enableGlossary,
            linkedTerms,
            linkReferences,
        };

        return {
            legalTextMarkup: { __html: DOMPurify.sanitize(processedHtml) },
            processedQas: (section.qas || []).map((qa, index) => {
                const questionHtml = processReaderHtml(qa.q, processingOptions);
                const answerHtml = processReaderHtml(`A: ${qa.a}`, processingOptions);

                return {
                    ...qa,
                    anchorId: getQaAnchorId(id, index),
                    numberLabel: getQaNumberLabel(qa),
                    questionMarkup: { __html: DOMPurify.sanitize(questionHtml) },
                    answerMarkup: { __html: DOMPurify.sanitize(answerHtml) },
                };
            }),
        };
    }, [section.legalText, section.qas, resourceLinks, query, glossaryMap, id, referenceContext]);

    const [copyFeedback, setCopyFeedback] = useState(null);
    const copyFeedbackTimerRef = useRef(null);
    const copyRequestRef = useRef(0);
    const isMountedRef = useRef(false);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            copyRequestRef.current += 1;
            if (copyFeedbackTimerRef.current) {
                window.clearTimeout(copyFeedbackTimerRef.current);
            }
        };
    }, []);

    const showCopyFeedback = (message, kind = 'success') => {
        if (copyFeedbackTimerRef.current) {
            window.clearTimeout(copyFeedbackTimerRef.current);
        }

        setCopyFeedback({ message, kind });
        copyFeedbackTimerRef.current = window.setTimeout(() => {
            setCopyFeedback(null);
            copyFeedbackTimerRef.current = null;
        }, 2500);
    };

    const copyWithFeedback = async (text, successMessage) => {
        const requestId = ++copyRequestRef.current;

        try {
            await copyTextToClipboard(text);
            if (!isMountedRef.current || requestId !== copyRequestRef.current) {
                return false;
            }
            showCopyFeedback(successMessage);
            return true;
        } catch {
            if (!isMountedRef.current || requestId !== copyRequestRef.current) {
                return false;
            }
            showCopyFeedback('Could not access the clipboard. Please copy manually.', 'error');
            return false;
        }
    };

    const getSectionUrl = (sectionId) => (
        new URL(buildSectionPath(chapterId, sectionId), window.location.origin).href
    );

    const sectionTitle = section.title ? `${chapterPrefix || ''}${section.title}` : fallbackTitle;

    // Copies a citation of this section, or of one of its Q&As (`anchorId`), in a Cite/Link format.
    const copyCitation = (format, title, anchorId) => copyWithFeedback(
        formatCitation(format, {
            sourceTitle: citationSourceTitle,
            markdownLabel: citationMarkdownLabel,
            title,
            url: getSectionUrl(anchorId),
        }),
        CITATION_COPIED_MESSAGES[format],
    );

    const copyPlainText = async () => {
        let textToCopy = `${sectionTitle}\n\n${toPlainText(section.legalText)}`;

        if (section.qas && section.qas.length > 0) {
            textToCopy += `\n\nOfficial Q&A Guidance:\n`;
            section.qas.forEach((qa) => {
                textToCopy += `\n${toQaPlainText(qa)}`;
            });
        }

        await copyWithFeedback(textToCopy, 'Plain text copied to clipboard!');
    };

    const copyQaPlainText = (qa) => copyWithFeedback(
        `${sectionTitle}\n\n${toQaPlainText(qa)}`,
        'Plain text copied to clipboard!',
    );

    const toggleBookmark = (anchorId, title) => bookmarksControls.toggleBookmark(
        anchorId,
        title,
        chapterId,
        bookmarkSection,
        bookmarkDocumentId,
    );

    const isAnchorBookmarked = (anchorId) => Boolean(bookmarksControls?.isBookmarked(
        anchorId,
        bookmarkSection,
        bookmarkDocumentId,
        chapterId,
    ));

    // Glossary terms open their definition; references open a preview, or the Code.
    const { handleClick, handleKeyDown, handleKeyUp } = createLinkedTextHandlers({ onTermClick, onOpenReference });

    // Find related decision trees for this specific section only (no chapter fallback)
    const relatedTrees = useMemo(() => {
        return getTreesBySection(id);
    }, [id]);

    // Each Glossary section is one definition, titled with its term. The definition already
    // opens with that term in bold, so the title is kept only for screen readers and the
    // table of contents.
    const isGlossaryDefinition = bookmarkSection === 'code' && chapterId === 'glossary';

    // Only the Code reader hides the actions at rest; the Transparency reader always shows them.
    const isCodeReader = bookmarkSection === 'code';

    return (
        <div id={id} className={`group/section ${isGlossaryDefinition ? 'mb-4' : 'mb-8'} scroll-mt-24`} onKeyDown={handleKeyDown} onKeyUp={handleKeyUp} onClick={handleClick}>
            {/* The actions sit beside the title when both fit and wrap under it otherwise, so a
                long title keeps the full column width. */}
            <div className={`group flex flex-wrap items-baseline gap-x-4 gap-y-2 ${isGlossaryDefinition ? 'mb-1' : 'mb-3 mt-6'} ${section.title ? 'justify-between' : 'justify-end print:hidden'}`}>
                {section.title && (
                    <h2 className={isGlossaryDefinition ? 'sr-only' : 'min-w-0 text-xl font-bold text-gray-800 flex items-center flex-wrap gap-2'}>
                        <Highlight text={section.title} query={query} />
                        {showQA && section.qas && section.qas.length > 0 && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const qaEl = document.getElementById(`qa-block-${id}`);
                                    if (qaEl) qaEl.scrollIntoView({ behavior: 'smooth' });
                                }}
                                className="text-xs font-semibold bg-purple-50 text-[#7654A1] hover:bg-purple-100 border border-purple-100/80 px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors print:hidden"
                                title={`Jump to ${section.qas.length} official Q&A guidance note${section.qas.length > 1 ? 's' : ''}`}
                            >
                                <AppIcon name="HelpCircle" size={12} />
                                <span>{section.qas.length} Q&A{section.qas.length > 1 ? 's' : ''}</span>
                            </button>
                        )}
                    </h2>
                )}
                <ReaderActions
                    menuId={`citation-menu-${id}`}
                    reveal={isCodeReader ? ACTIONS_REVEAL_ON_HOVER : ''}
                    isBookmarked={isAnchorBookmarked(id)}
                    onToggleBookmark={bookmarksControls ? () => toggleBookmark(id, sectionTitle) : undefined}
                    onCopyCitation={(format) => copyCitation(format, sectionTitle, id)}
                    onCopyText={copyPlainText}
                    className="shrink-0 sm:ml-auto sm:justify-end"
                />
            </div>
            <div className="prose prose-slate max-w-none text-gray-800 leading-relaxed reader-content" dangerouslySetInnerHTML={legalTextMarkup} />
            {supplement}
            {onNavigateTree && relatedTrees.length > 0 && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 print:hidden">
                    <span className="text-amber-600 shrink-0 mt-0.5">
                        <AppIcon name="GitBranch" size={18} />
                    </span>
                    <div className="flex-1">
                        <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">Related Decision Tree{relatedTrees.length > 1 ? 's' : ''}</p>
                        <div className="space-y-1">
                            {relatedTrees.map(tree => (
                                <button
                                    key={tree.id}
                                    onClick={(e) => { e.stopPropagation(); onNavigateTree(tree.id); }}
                                    className="text-sm text-amber-700 hover:text-amber-900 font-medium hover:underline flex items-center gap-1 transition-colors"
                                >
                                    {tree.title}
                                    <AppIcon name="ChevronRight" size={12} />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            {copyFeedback && (
                <div
                    role={copyFeedback.kind === 'error' ? 'alert' : 'status'}
                    aria-live={copyFeedback.kind === 'error' ? 'assertive' : 'polite'}
                    aria-atomic="true"
                    className={`fixed bottom-6 right-6 text-white text-xs font-medium px-4 py-2.5 rounded-xl shadow-2xl z-50 flex items-center gap-2 animate-fade-in border print:hidden ${
                        copyFeedback.kind === 'error'
                            ? 'bg-red-700 border-red-600'
                            : 'bg-slate-900 border-slate-700/50'
                    }`}
                >
                    <AppIcon
                        name={copyFeedback.kind === 'error' ? 'AlertCircle' : 'Check'}
                        size={16}
                        className={copyFeedback.kind === 'error' ? 'text-red-100 shrink-0' : 'text-emerald-400 shrink-0'}
                    />
                    <span>{copyFeedback.message}</span>
                </div>
            )}
            {(showQA || printAllQA) && section.qas && (
                <div
                    id={`qa-block-${id}`}
                    className={`mt-4 space-y-4 scroll-mt-24 ${!showQA && printAllQA ? 'hidden print-always' : ''}`}
                >
                    {processedQas.map((qa) => {
                        const qaTitle = buildQaTitle(sectionTitle, qa);
                        return (
                            <div key={qa.anchorId} id={qa.anchorId} className="group/qa bg-gray-50 p-4 rounded-lg border border-gray-100 scroll-mt-24 print:bg-transparent print:border-none print:p-0 print:my-4">
                                {/* The actions float beside the start of the question from the
                                    sm breakpoint, so only its first line is narrower; on phones
                                    they get their own row above it. */}
                                <ReaderActions
                                    menuId={`citation-menu-${qa.anchorId}`}
                                    subject="Q&A"
                                    name={qa.numberLabel || 'Q&A'}
                                    reveal={isCodeReader ? QA_ACTIONS_REVEAL_ON_HOVER : ''}
                                    isBookmarked={isAnchorBookmarked(qa.anchorId)}
                                    onToggleBookmark={bookmarksControls ? () => toggleBookmark(qa.anchorId, qaTitle) : undefined}
                                    onCopyCitation={(format) => copyCitation(format, qaTitle, qa.anchorId)}
                                    onCopyText={() => copyQaPlainText(qa)}
                                    className="justify-end mb-2 sm:float-right sm:ml-4 sm:-my-1"
                                />
                                {qa.label && (
                                    <p className="text-xs font-bold text-[#007A86] underline underline-offset-2 mb-2 reader-content">
                                        {qa.label}
                                    </p>
                                )}
                                <p
                                    className="font-bold text-gray-900 mb-1 reader-content"
                                    dangerouslySetInnerHTML={qa.questionMarkup}
                                />
                                <div
                                    className="clear-right text-gray-700 prose prose-sm max-w-none reader-content"
                                    dangerouslySetInnerHTML={qa.answerMarkup}
                                />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
