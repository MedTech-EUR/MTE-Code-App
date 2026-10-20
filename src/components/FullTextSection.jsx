import React, { useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { processReaderHtml, getQaAnchorId } from '../utils/textUtils';
import { copyTextToClipboard } from '../utils/clipboardUtils';
import { Highlight } from './Highlight';
import { AppIcon } from './AppIcons';
import { getTreesBySection } from '../data/treeData';
import { buildCodeSectionPath } from '../utils/routeUtils';
import { resolveResourceLinks } from '../utils/resourceUtils';
import { linkCrossReferences } from '../utils/crossReferences';
import { createLinkedTextHandlers } from '../utils/linkedTextEvents';

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
            processedQas: (section.qas || []).map((qa) => {
                const questionHtml = processReaderHtml(qa.q, processingOptions);
                const answerHtml = processReaderHtml(`A: ${qa.a}`, processingOptions);

                return {
                    ...qa,
                    questionMarkup: { __html: DOMPurify.sanitize(questionHtml) },
                    answerMarkup: { __html: DOMPurify.sanitize(answerHtml) },
                };
            }),
        };
    }, [section.legalText, section.qas, resourceLinks, query, glossaryMap, id, referenceContext]);

    const [copyFeedback, setCopyFeedback] = useState(null);
    const [citeMenuOpen, setCiteMenuOpen] = useState(false);
    const citeContainerRef = useRef(null);
    const citeTriggerRef = useRef(null);
    const copyFeedbackTimerRef = useRef(null);
    const copyRequestRef = useRef(0);
    const isMountedRef = useRef(false);
    const citeMenuId = `citation-menu-${id}`;

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

    useEffect(() => {
        if (!citeMenuOpen) return undefined;

        const closeCiteMenu = (restoreFocus = false) => {
            setCiteMenuOpen(false);
            if (restoreFocus) {
                window.requestAnimationFrame(() => citeTriggerRef.current?.focus());
            }
        };

        const handlePointerDown = (event) => {
            if (!citeContainerRef.current?.contains(event.target)) {
                closeCiteMenu();
            }
        };

        const handleKeyDown = (event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            closeCiteMenu(true);
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [citeMenuOpen]);

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

    const copyCitationFormat = async (format) => {
        const url = getSectionUrl(id);
        const prefix = chapterPrefix ? chapterPrefix : '';
        const fullTitle = section.title ? `${prefix}${section.title}` : fallbackTitle;
        const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        let textToCopy = '';

        if (format === 'formal') {
            textToCopy = `${citationSourceTitle}, ${fullTitle}. (Accessed ${today}). Available at: ${url}`;
        } else if (format === 'markdown') {
            textToCopy = `[${fullTitle} - ${citationMarkdownLabel}](${url})`;
        } else if (format === 'url') {
            textToCopy = url;
        }

        const successMessage = (
            format === 'formal' ? 'Formal citation copied!' :
            format === 'markdown' ? 'Markdown link copied!' : 'Direct link copied!'
        );

        if (await copyWithFeedback(textToCopy, successMessage)) {
            setCiteMenuOpen(false);
            window.requestAnimationFrame(() => citeTriggerRef.current?.focus());
        }
    };

    const copyPlainText = async () => {
        const prefix = chapterPrefix ? chapterPrefix : '';
        const fullTitle = section.title ? `${prefix}${section.title}` : fallbackTitle;
        
        const tempEl = document.createElement('div');
        tempEl.innerHTML = section.legalText;
        const plainLegalText = tempEl.textContent || tempEl.innerText || '';

        let textToCopy = `${fullTitle}\n\n${plainLegalText.trim()}`;

        if (section.qas && section.qas.length > 0) {
            textToCopy += `\n\nOfficial Q&A Guidance:\n`;
            section.qas.forEach(qa => {
                const tempQ = document.createElement('div');
                tempQ.innerHTML = qa.q;
                const tempA = document.createElement('div');
                tempA.innerHTML = qa.a;
                const questionText = (tempQ.textContent || '').trim();
                const answerText = (tempA.textContent || '').trim();
                const questionPrefix = /^Q:/i.test(questionText) ? '' : 'Q: ';
                const answerPrefix = /^A:/i.test(answerText) ? '' : 'A: ';
                textToCopy += `\n${qa.label ? `${qa.label}\n` : ''}${questionPrefix}${questionText}\n${answerPrefix}${answerText}\n`;
            });
        }

        await copyWithFeedback(textToCopy, 'Plain text copied to clipboard!');
    };

    // Glossary terms open their definition; references open a preview, or the Code.
    const { handleClick, handleKeyDown, handleKeyUp } = createLinkedTextHandlers({ onTermClick, onOpenReference });

    const isBookmarked = bookmarksControls?.isBookmarked(
        id,
        bookmarkSection,
        bookmarkDocumentId,
        chapterId,
    );

    // Find related decision trees for this specific section only (no chapter fallback)
    const relatedTrees = useMemo(() => {
        return getTreesBySection(id);
    }, [id]);

    // Each Glossary section is one definition, titled with its term. The definition already
    // opens with that term in bold, so the title is kept only for screen readers and the
    // table of contents.
    const isGlossaryDefinition = bookmarkSection === 'code' && chapterId === 'glossary';

    // The actions stay in view while the Cite/Link menu is open, and a bookmarked section keeps
    // its star, so the bookmark can be seen while reading.
    const actionsReveal = bookmarkSection === 'code' && !citeMenuOpen ? ACTIONS_REVEAL_ON_HOVER : '';

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
                <div className="flex flex-wrap gap-x-2 gap-y-1 shrink-0 sm:ml-auto sm:justify-end print:hidden">
                        {bookmarksControls && (
                            <div className={isBookmarked ? undefined : actionsReveal}>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                            bookmarksControls.toggleBookmark(
                                                id,
                                                section.title
                                                    ? (chapterPrefix || '') + section.title
                                                    : fallbackTitle,
                                            chapterId,
                                            bookmarkSection,
                                            bookmarkDocumentId,
                                        );
                                    }}
                                    className={`text-sm border rounded px-2 py-1 transition-colors ${isBookmarked ? 'bg-purple-100 text-purple-700 border-purple-200' : 'text-gray-500 hover:text-purple-600 border-transparent hover:border-purple-100'}`}
                                    title={isBookmarked ? 'Remove bookmark' : 'Bookmark this section'}
                                >
                                    {isBookmarked ? '★ Bookmarked' : '☆ Bookmark'}
                                </button>
                            </div>
                        )}
                        <div ref={citeContainerRef} className={`relative ${actionsReveal}`}>
                            <button
                                ref={citeTriggerRef}
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setCiteMenuOpen(!citeMenuOpen); }}
                                className="text-sm text-[#007A86] hover:text-[#005F68] border border-transparent hover:border-cyan-100 rounded px-2 py-1 flex items-center gap-1 font-medium transition-colors"
                                title="Copy citation or reference link for this section"
                                aria-expanded={citeMenuOpen}
                                aria-controls={citeMenuOpen ? citeMenuId : undefined}
                            >
                                <span>Cite/Link</span>
                                <AppIcon name={citeMenuOpen ? "ChevronUp" : "ChevronDown"} size={12} />
                            </button>
                            {citeMenuOpen && (
                                <div
                                    id={citeMenuId}
                                    role="group"
                                    aria-label="Copy reference"
                                    onClick={(e) => e.stopPropagation()}
                                    className="absolute right-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-xl p-2 z-50 animate-fade-in text-left"
                                >
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1">Copy Reference</div>
                                    <button
                                        type="button"
                                        onClick={() => copyCitationFormat('formal')}
                                        className="w-full text-left px-2.5 py-1.5 text-xs text-gray-700 hover:bg-cyan-50 hover:text-[#007A86] rounded-lg transition-colors flex items-center justify-between group"
                                    >
                                        <div>
                                            <div className="font-semibold">Formal Citation</div>
                                            <div className="text-[10px] text-gray-400 group-hover:text-cyan-700">Includes date & full title</div>
                                        </div>
                                        <AppIcon name="Copy" size={14} className="text-gray-400 group-hover:text-[#007A86]" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => copyCitationFormat('markdown')}
                                        className="w-full text-left px-2.5 py-1.5 text-xs text-gray-700 hover:bg-purple-50 hover:text-purple-700 rounded-lg transition-colors flex items-center justify-between group"
                                    >
                                        <div>
                                            <div className="font-semibold">Markdown Link</div>
                                            <div className="text-[10px] text-gray-400 group-hover:text-purple-600">[Title](URL) format</div>
                                        </div>
                                        <AppIcon name="Link" size={14} className="text-gray-400 group-hover:text-purple-600" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => copyCitationFormat('url')}
                                        className="w-full text-left px-2.5 py-1.5 text-xs text-gray-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors flex items-center justify-between group"
                                    >
                                        <div>
                                            <div className="font-semibold">Direct Link URL</div>
                                            <div className="text-[10px] text-gray-400">Raw web link</div>
                                        </div>
                                        <AppIcon name="ExternalLink" size={14} className="text-gray-400 group-hover:text-slate-700" />
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className={actionsReveal}>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); copyPlainText(); }}
                                className="text-sm text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-200 rounded px-2 py-1 font-medium transition-colors"
                                title="Copy clean plain text of this section"
                            >
                                Copy Text
                            </button>
                        </div>
                </div>
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
                    {processedQas.map((qa, idx) => (
                        <div key={idx} id={getQaAnchorId(id, idx)} className="bg-gray-50 p-4 rounded-lg border border-gray-100 scroll-mt-24 print:bg-transparent print:border-none print:p-0 print:my-4">
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
                                className="text-gray-700 prose prose-sm max-w-none reader-content"
                                dangerouslySetInnerHTML={qa.answerMarkup}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
