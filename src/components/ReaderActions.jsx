import React, { useEffect, useRef, useState } from 'react';
import { AppIcon } from './AppIcons';

// The Bookmark, Cite/Link and Copy Text actions of a reader section, or of one of its Q&As.
// `reveal` holds the classes that hide them until the reader points at or moves into the text
// (see FullTextSection); they stay in view while the Cite/Link menu is open, and a bookmarked
// item keeps its star in view. `name` (e.g. "Q&A 31") is added to each button's accessible
// name, so a screen reader can tell the many Q&A buttons apart.
export const ReaderActions = ({
    menuId,
    subject = 'section',
    name = '',
    reveal = '',
    isBookmarked = false,
    onToggleBookmark,
    onCopyCitation,
    onCopyText,
    className = '',
}) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const containerRef = useRef(null);
    const triggerRef = useRef(null);

    useEffect(() => {
        if (!menuOpen) return undefined;

        const closeMenu = (restoreFocus = false) => {
            setMenuOpen(false);
            if (restoreFocus) {
                window.requestAnimationFrame(() => triggerRef.current?.focus());
            }
        };

        const handlePointerDown = (event) => {
            if (!containerRef.current?.contains(event.target)) {
                closeMenu();
            }
        };

        const handleKeyDown = (event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            closeMenu(true);
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [menuOpen]);

    const copyCitation = async (format) => {
        if (await onCopyCitation(format)) {
            setMenuOpen(false);
            window.requestAnimationFrame(() => triggerRef.current?.focus());
        }
    };

    const actionsReveal = menuOpen ? '' : reveal;
    const labelled = (visibleLabel) => (name ? `${visibleLabel} ${name}` : undefined);

    return (
        <div className={`flex flex-wrap gap-x-2 gap-y-1 print:hidden ${className}`}>
            {onToggleBookmark && (
                <div className={isBookmarked ? undefined : actionsReveal}>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onToggleBookmark(); }}
                        className={`text-sm border rounded px-2 py-1 transition-colors ${isBookmarked ? 'bg-purple-100 text-purple-700 border-purple-200' : 'text-gray-500 hover:text-purple-600 border-transparent hover:border-purple-100'}`}
                        title={isBookmarked ? 'Remove bookmark' : `Bookmark this ${subject}`}
                        aria-label={labelled(isBookmarked ? 'Bookmarked' : 'Bookmark')}
                    >
                        {isBookmarked ? '★ Bookmarked' : '☆ Bookmark'}
                    </button>
                </div>
            )}
            <div ref={containerRef} className={`relative ${actionsReveal}`}>
                <button
                    ref={triggerRef}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
                    className="text-sm text-[#007A86] hover:text-[#005F68] border border-transparent hover:border-cyan-100 rounded px-2 py-1 flex items-center gap-1 font-medium transition-colors"
                    title={`Copy citation or reference link for this ${subject}`}
                    aria-label={labelled('Cite/Link')}
                    aria-expanded={menuOpen}
                    aria-controls={menuOpen ? menuId : undefined}
                >
                    <span>Cite/Link</span>
                    <AppIcon name={menuOpen ? "ChevronUp" : "ChevronDown"} size={12} />
                </button>
                {menuOpen && (
                    <div
                        id={menuId}
                        role="group"
                        aria-label="Copy reference"
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-xl p-2 z-50 animate-fade-in text-left"
                    >
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1">Copy Reference</div>
                        <button
                            type="button"
                            onClick={() => copyCitation('formal')}
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
                            onClick={() => copyCitation('markdown')}
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
                            onClick={() => copyCitation('url')}
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
                    onClick={(e) => { e.stopPropagation(); onCopyText(); }}
                    className="text-sm text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-200 rounded px-2 py-1 font-medium transition-colors"
                    title={`Copy clean plain text of this ${subject}`}
                    aria-label={labelled('Copy Text')}
                >
                    Copy Text
                </button>
            </div>
        </div>
    );
};
