import React, { useEffect, useState } from 'react';
import { AppIcon } from './AppIcons';

export const TableOfContents = ({ sections, showSummary, collapsed = false, onExpand }) => {
  const [activeSection, setActiveSection] = useState(null);

  useEffect(() => {
    if (!sections || sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // We want the highest intersecting element
        const intersecting = entries.filter((e) => e.isIntersecting);
        if (intersecting.length > 0) {
          // If multiple, pick the first one visible
          setActiveSection(intersecting[0].target.id);
        }
      },
      { rootMargin: '-10% 0px -80% 0px' }
    );

    sections.forEach((s) => {
      const el = document.getElementById(s.computedId);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sections]);

  // If there's only 1 section and no summary, a TOC is useless
  if (!sections || (sections.length < 2 && !showSummary)) return null;

  // While the side panel shows a definition or preview, the list shrinks to one line naming
  // the section being read; selecting it closes the panel and brings the list back.
  if (collapsed) {
    const currentTitle = activeSection === 'summary-top' || (!activeSection && showSummary)
      ? 'Summary'
      : sections.find((s) => s.computedId === activeSection)?.title || sections[0]?.title;

    return (
      <div className="font-sans no-print mb-5">
        <h2 className="text-[10px] font-bold text-[#007A86] uppercase tracking-widest">On This Page</h2>
        <button
          type="button"
          onClick={onExpand}
          className="mt-1.5 flex max-w-full items-center gap-1 text-left text-xs text-gray-600 hover:text-gray-900 transition-colors"
          title="Close the side panel and show all sections"
        >
          <AppIcon name="ChevronRight" size={12} className="shrink-0" />
          <span className="line-clamp-1">{currentTitle}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-sans no-print animate-rise-in [animation-delay:200ms]">
      <h2 className="text-[10px] font-bold text-[#007A86] uppercase tracking-widest mb-4">On This Page</h2>
      <ul className="space-y-3 pl-2 border-l-2 border-gray-200">
        {showSummary && (
          <li>
            <button
              onClick={() => {
                const el = document.getElementById('summary-top');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                setActiveSection('summary-top');
              }}
              className={`block pl-4 text-xs leading-relaxed transition-all text-left ${
                activeSection === 'summary-top' || !activeSection
                  ? 'text-[#007A86] font-bold border-l-2 border-[#0099A7] -ml-[2px]'
                  : 'text-gray-500 hover:text-gray-900 border-l-2 border-transparent -ml-[2px]'
              }`}
            >
              Summary
            </button>
          </li>
        )}
        {sections.map((s) => (
          <li key={s.computedId}>
            <button
              onClick={() => {
                const el = document.getElementById(s.computedId);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className={`block pl-4 text-xs leading-relaxed transition-all text-left ${
                activeSection === s.computedId
                  ? 'text-[#007A86] font-bold border-l-2 border-[#0099A7] -ml-[2px]'
                  : 'text-gray-500 hover:text-gray-900 border-l-2 border-transparent -ml-[2px]'
              }`}
            >
              {s.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
