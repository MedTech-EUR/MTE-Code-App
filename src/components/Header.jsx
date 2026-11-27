import React, { useEffect, useRef, useState } from 'react';
import { AppIcon } from './AppIcons';
import { CompactLogo, Logo } from './Logo';
import { SuggestionModal } from './SuggestionModal';
import {
  READER_FONT_SIZES,
  READER_LINE_HEIGHTS,
  READER_LINE_LENGTHS,
  READER_PARAGRAPH_SPACINGS,
  READER_SIDE_PANEL_OPTIONS,
} from '../config/readerSettings';

export const Header = ({
  activeId,
  onOpenTour,
  activeSection,
  setSidebarOpen,
  onGoHome,
  showSummary,
  setShowSummary,
  showFullText,
  setShowFullText,
  showQA,
  setShowQA,
  readerOpen,
  setReaderOpen,
  readerSize,
  setReaderSize,
  readerLine,
  setReaderLine,
  readerSpace,
  setReaderSpace,
  readerLineLength,
  setReaderLineLength,
  readerSidePanel,
  setReaderSidePanel,
  readerMode = activeSection === 'code' && activeId !== 'home',
  showSummaryControl = true,
  showFullTextControl = true,
  showQAControl = true,
}) => {
  const [suggestionModalOpen, setSuggestionModalOpen] = useState(false);
  const readerMenuRef = useRef(null);
  const readerTriggerRef = useRef(null);

  useEffect(() => {
    if (!readerOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!readerMenuRef.current?.contains(event.target)) {
        setReaderOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setReaderOpen(false);
      readerTriggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [readerOpen, setReaderOpen]);

  return (
    <>
      <header className="h-20 flex-none border-b border-gray-200 flex items-center justify-between px-2 sm:px-4 md:px-8 bg-white/95 backdrop-blur-sm z-30 shadow-sm relative [view-transition-name:app-header]">
        <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-3 z-10">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 sm:p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
            aria-label="Open navigation"
          >
            <AppIcon name="Menu" size={24} />
          </button>

          <button
            onClick={onGoHome}
            className={`min-w-0 hover:opacity-80 transition-opacity items-center gap-2 ${readerMode ? 'hidden md:flex' : 'flex'}`}
          >
            {/* On a phone the logo shrinks to the room left beside the buttons. */}
            <Logo size={60} className={readerMode ? 'shrink-0' : 'min-w-0'} />
          </button>
          {/* A phone's reader header has room for the compact logo only, beside its two buttons. */}
          {readerMode && (
            <button onClick={onGoHome} className="@container/logo flex md:hidden min-w-8 flex-1 items-center hover:opacity-80 transition-opacity">
              <CompactLogo className="[&>span:last-child]:sr-only @min-[9.5rem]/logo:[&>span:last-child]:not-sr-only" />
            </button>
          )}
        </div>

        <button type="button" id="app-tour-launch" className="tour-launch no-print ml-auto mr-1 sm:mr-3"
          title="How to use the Code App" aria-label="How to use the Code App" aria-haspopup="dialog" onClick={onOpenTour}>
          <strong aria-hidden="true">?</strong><span aria-hidden="true"><b>How to use the Code App</b></span>
        </button>

        {/* Document reader toolbar */}
        {readerMode && (
          // On a phone only the suggestion and "Aa Menu" buttons show; the menu holds the rest.
          <div className="flex md:bg-slate-100 md:p-1.5 text-xs md:rounded-lg md:border md:border-slate-200 gap-1.5 shrink-0 items-center animate-slide-in-right z-10 no-print">
            
            <button
              type="button"
              onClick={() => setSuggestionModalOpen(true)}
              className="h-9 md:h-auto px-2.5 md:px-3 md:py-1.5 text-xs font-bold rounded-lg transition-all active:scale-95 flex items-center gap-1 md:gap-2 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 shadow-sm"
              title="Send a Suggestion"
              aria-label="Send a suggestion"
              aria-haspopup="dialog"
            >
              <AppIcon name="Lightbulb" size={16} className="text-amber-600 shrink-0" />
              <span className="hidden lg:inline">Send a Suggestion</span>
            </button>

            <div className="hidden md:block w-px h-4 bg-gray-300 mx-0.5"></div>

            {showSummaryControl && (
              <button
                type="button"
                onClick={() => setShowSummary(!showSummary)}
                className={`hidden md:flex px-3 py-1.5 text-xs font-bold rounded-lg transition-all active:scale-95 items-center gap-2 h-full ${
                  showSummary
                    ? 'bg-white text-[#7654A1] shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
                title="Toggle Summary"
                aria-pressed={showSummary}
              >
                <AppIcon name="List" size={16} />
                <span className="hidden lg:inline">Summary</span>
              </button>
            )}
            
            {showFullTextControl && (
              <button
                type="button"
                onClick={() => setShowFullText(!showFullText)}
                className={`hidden md:flex px-3 py-1.5 text-xs font-bold rounded-lg transition-all active:scale-95 items-center gap-2 h-full ${
                  showFullText
                    ? 'bg-white text-[#7654A1] shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
                title="Toggle Full Text"
                aria-pressed={showFullText}
              >
                <AppIcon name="FileText" size={16} />
                <span className="hidden lg:inline">Full Text</span>
              </button>
            )}
            
            {showQAControl && (
              <button
                type="button"
                onClick={() => setShowQA(!showQA)}
                className={`hidden md:flex px-3 py-1.5 text-xs font-bold rounded-lg transition-all active:scale-95 items-center gap-2 h-full ${
                  showQA
                    ? 'bg-white text-[#7654A1] shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
                title="Toggle Q&A"
                aria-pressed={showQA}
              >
                <AppIcon name="Eye" size={16} />
                <span className="hidden lg:inline">Q&A</span>
              </button>
            )}

            <div className="hidden md:block w-px h-4 bg-gray-300 mx-0.5"></div>

            <div ref={readerMenuRef} className="relative">
              <button
                ref={readerTriggerRef}
                type="button"
                onClick={() => setReaderOpen((v) => !v)}
                className="h-9 md:h-auto px-2.5 md:px-3 md:py-1.5 text-[13px] md:text-xs font-bold rounded-lg transition-all active:scale-95 flex items-center gap-1.5 bg-white text-[#7654A1] border border-gray-200 md:border-transparent shadow-sm hover:opacity-80"
                title="Reading settings"
                aria-expanded={readerOpen}
                aria-controls={readerOpen ? 'reader-settings-panel' : undefined}
              >
                Aa<span className="md:hidden">Menu</span>
                <span className="sr-only">: reading settings</span>
              </button>

              {readerOpen && (
                <div
                  id="reader-settings-panel"
                  role="group"
                  aria-label="Reading settings"
                  className="absolute right-0 mt-2 w-64 md:w-60 max-h-[calc(100dvh-6rem)] overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-xl shadow-slate-900/10 p-3 animate-pop-in origin-top-right z-50"
                >
                  {/* On a phone the toolbar has no room for these, so the menu holds them. */}
                  <div className="md:hidden mb-3 border-b border-gray-100 pb-3">
                    <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Show</div>
                    {[
                      showSummaryControl && { label: 'Summary', value: showSummary, onChange: setShowSummary },
                      showFullTextControl && { label: 'Full text', value: showFullText, onChange: setShowFullText },
                      showQAControl && { label: 'Q&As', value: showQA, onChange: setShowQA },
                    ].filter(Boolean).map((toggle) => (
                      <button
                        key={toggle.label}
                        type="button"
                        role="switch"
                        aria-checked={toggle.value}
                        onClick={() => toggle.onChange(!toggle.value)}
                        className="flex w-full items-center justify-between rounded-md py-1.5 text-sm font-semibold text-gray-700"
                      >
                        {toggle.label}
                        <span
                          aria-hidden="true"
                          className={`relative h-[18px] w-8 shrink-0 rounded-full transition-colors ${toggle.value ? 'bg-[#7654A1]' : 'bg-gray-300'}`}
                        >
                          <span
                            className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-[left] ${toggle.value ? 'left-[calc(100%-1rem)]' : 'left-0.5'}`}
                          />
                        </span>
                      </button>
                    ))}
                  </div>
                  {[
                    { heading: 'Font size', options: READER_FONT_SIZES, value: readerSize, onChange: setReaderSize },
                    { heading: 'Line spacing', options: READER_LINE_HEIGHTS, value: readerLine, onChange: setReaderLine },
                    { heading: 'Paragraph spacing', options: READER_PARAGRAPH_SPACINGS, value: readerSpace, onChange: setReaderSpace },
                    { heading: 'Line length', options: READER_LINE_LENGTHS, value: readerLineLength, onChange: setReaderLineLength },
                    {
                      heading: 'Side panel',
                      note: 'Contents, definitions and references beside the text on wide screens',
                      options: READER_SIDE_PANEL_OPTIONS,
                      value: readerSidePanel,
                      onChange: setReaderSidePanel,
                    },
                  ].map((setting, index, settings) => (
                    <div key={setting.heading}>
                      <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                        {setting.heading}
                      </div>
                      {setting.note && (
                        <p className="-mt-1.5 mb-2 text-[11px] leading-snug text-gray-500">{setting.note}</p>
                      )}
                      <div className={`flex gap-2 ${index < settings.length - 1 ? 'mb-3' : ''}`}>
                        {setting.options.map((option) => {
                          const selected = setting.value === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setting.onChange(option.value)}
                              className={`px-2 py-1 rounded border text-xs font-semibold transition-colors ${
                                selected
                                  ? 'bg-[#7654A1] border-[#7654A1] text-white'
                                  : 'bg-white border-gray-300 text-gray-700 hover:border-[#7654A1] hover:text-[#7654A1]'
                              }`}
                              aria-pressed={selected}
                              aria-label={`${setting.heading}: ${option.name}`}
                              title={option.name}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setReaderOpen(false);
                      window.print();
                    }}
                    className="md:hidden mt-3 flex w-full items-center gap-2 border-t border-gray-100 pt-3 text-sm font-bold text-[#7654A1]"
                  >
                    <AppIcon name="Printer" size={16} />
                    Print this page
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => window.print()}
              className="hidden md:flex px-3 py-1.5 text-xs font-bold rounded-lg transition-all active:scale-95 items-center gap-2 h-full bg-white text-[#7654A1] shadow-sm hover:opacity-80"
              title="Print Current View"
            >
              <AppIcon name="Printer" size={16} />
              <span className="hidden lg:inline">Print</span>
            </button>

          </div>
        )}

        {/* Other sections header button */}
        {!readerMode && (
          <div className="flex shrink-0 items-center gap-2 pl-2 z-10 no-print">
            <button
              type="button"
              onClick={() => setSuggestionModalOpen(true)}
              className="px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all active:scale-95 flex items-center gap-1.5 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 shadow-sm"
              title="Send a Suggestion"
              aria-label="Send a suggestion"
              aria-haspopup="dialog"
            >
              <AppIcon name="Lightbulb" size={16} className="text-amber-600 shrink-0" />
              <span className="hidden md:inline">Send a Suggestion</span>
            </button>
          </div>
        )}
      </header>

      <SuggestionModal
        isOpen={suggestionModalOpen}
        onClose={() => setSuggestionModalOpen(false)}
      />
    </>
  );
};
