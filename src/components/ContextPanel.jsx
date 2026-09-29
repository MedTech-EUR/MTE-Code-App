import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { AppIcon } from './AppIcons';
import { isPlainLinkClick } from '../utils/crossReferences';
import { resolveResourceLinks } from '../utils/resourceUtils';

const EMPTY_RESOURCE_LINKS = Object.freeze({});

// The panel's text wraps at whatever width the panel is dragged to: long words break, and a
// wide table scrolls sideways inside the panel instead of widening it.
const TEXT_CLASSES = 'text-sm leading-relaxed break-words space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mt-1 [&_strong]:font-semibold [&_strong]:text-gray-900 [&_a]:text-[#007A86] [&_a]:underline [&_img]:max-w-full [&_img]:rounded-md [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_th]:p-2 [&_th]:text-left [&_th]:align-top [&_td]:p-2 [&_td]:align-top [&_td]:border-t [&_td]:border-gray-200';

const countQas = (qas) => (
  qas?.length ? `${qas.length} Q&A${qas.length > 1 ? 's' : ''}` : null
);

// Sanitized once per text, so a re-render (such as the end of a resize) keeps a text selection.
const PanelText = ({ html, resourceLinks, className = 'text-gray-700' }) => {
  const markup = useMemo(
    () => ({ __html: DOMPurify.sanitize(resolveResourceLinks(html, resourceLinks)) }),
    [html, resourceLinks],
  );
  return <div className={`${TEXT_CLASSES} ${className}`} dangerouslySetInnerHTML={markup} />;
};

// A section's Q&As, laid out as in the reader.
const QaList = ({ qas, resourceLinks }) => (
  <div className="space-y-3">
    {qas.map((qa, index) => (
      <div key={index} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
        {qa.label && <p className="mb-1 text-[11px] font-bold text-[#007A86]">{qa.label}</p>}
        <PanelText html={qa.questionHtml} resourceLinks={resourceLinks} className="font-semibold text-gray-900" />
        <PanelText html={`A: ${qa.answerHtml}`} resourceLinks={resourceLinks} className="mt-1 text-gray-700" />
      </div>
    ))}
  </div>
);

// Opens a chapter, section or Q&A in the reader; a modified click opens it in a new tab.
const TargetLink = ({ href, target, onOpenTarget, children }) => (
  <a
    href={href}
    onClick={(event) => {
      if (!isPlainLinkClick(event)) return;
      event.preventDefault();
      onOpenTarget?.(target);
    }}
    className="inline-flex items-center gap-1 text-xs font-bold text-[#007A86] hover:text-[#7654A1] focus-visible:outline-2 focus-visible:outline-[#7654A1] rounded"
  >
    {children}
    <AppIcon name="ArrowRight" size={12} />
  </a>
);

// One expandable row. While it is open its heading stays at the top of the panel as the text
// scrolls past, so a long section can be closed from anywhere in it.
const Disclosure = ({ title, detail, open, onToggle, headingLevel: Heading = 'h4', children }) => {
  const contentId = useId();
  const headingRef = useRef(null);

  return (
    <>
      <Heading
        ref={headingRef}
        className={open ? 'sticky top-0 z-10 border-b border-gray-100 bg-white' : ''}
      >
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? contentId : undefined}
          onClick={() => onToggle(headingRef.current)}
          className="flex w-full items-start gap-2 px-4 py-2.5 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#7654A1] transition-colors"
        >
          <AppIcon
            name="ChevronRight"
            size={14}
            className={`mt-0.5 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`}
          />
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold leading-snug text-gray-800 break-words">
              {title}
            </span>
            {detail && (
              <span className="mt-0.5 block text-[11px] font-medium text-gray-500">
                <span className="sr-only">, </span>
                {detail}
              </span>
            )}
          </span>
        </button>
      </Heading>
      {open && (
        <div id={contentId} className="px-4 pt-3 pb-4">
          {children}
        </div>
      )}
    </>
  );
};

// A long section may be closed from its heading at the top of the panel: once its text is
// gone, bring the heading back into view.
const keepInView = (heading) => {
  window.requestAnimationFrame(() => heading?.scrollIntoView({ block: 'nearest' }));
};

// A chapter's summary and each of its sections, one row each. The summary starts open (the
// first section when there is no summary), so the panel always shows some of the text.
const ChapterContents = ({ item, resourceLinks, onOpenTarget }) => {
  const rows = useMemo(() => [
    ...(item.html ? [{ key: 'summary', title: 'Summary', html: item.html, qas: [] }] : []),
    ...item.sections,
  ], [item]);
  const [openKeys, setOpenKeys] = useState(() => new Set(rows.slice(0, 1).map((row) => row.key)));
  const allOpen = rows.every((row) => openKeys.has(row.key));

  const toggleRow = (key, heading) => {
    const closing = openKeys.has(key);
    setOpenKeys((current) => {
      const next = new Set(current);
      if (closing) next.delete(key);
      else next.add(key);
      return next;
    });
    if (closing) keepInView(heading);
  };

  return (
    <div className="mt-3 border-t border-gray-100 pb-1">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 pt-3 pb-1">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500">In this chapter</h3>
        {rows.length > 1 && (
          <button
            type="button"
            onClick={() => setOpenKeys(allOpen ? new Set() : new Set(rows.map((row) => row.key)))}
            className="text-[11px] font-bold text-[#007A86] hover:text-[#7654A1] focus-visible:outline-2 focus-visible:outline-[#7654A1] rounded"
          >
            {allOpen ? 'Collapse all' : 'Expand all'}
          </button>
        )}
      </div>
      <ul>
        {rows.map((row) => (
          <li key={row.key} className="border-t border-gray-100 first:border-t-0">
            <Disclosure
              title={row.title}
              detail={countQas(row.qas)}
              open={openKeys.has(row.key)}
              onToggle={(heading) => toggleRow(row.key, heading)}
            >
              <PanelText html={row.html} resourceLinks={resourceLinks} />
              {row.qas.length > 0 && (
                <div className="mt-4">
                  <QaList qas={row.qas} resourceLinks={resourceLinks} />
                </div>
              )}
              {/* A chapter's only section opens with "Open this chapter" above. */}
              {row.target && item.sections.length > 1 && (
                <p className="mt-3">
                  <TargetLink href={row.href} target={row.target} onOpenTarget={onOpenTarget}>
                    Go to this section
                  </TargetLink>
                </p>
              )}
            </Disclosure>
          </li>
        ))}
      </ul>
    </div>
  );
};

// A section's Q&As, shown on request below its text.
const SectionQas = ({ qas, resourceLinks }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-gray-100 pb-1">
      <Disclosure
        title={countQas(qas)}
        open={open}
        headingLevel="h3"
        onToggle={(heading) => {
          setOpen(!open);
          if (open) keepInView(heading);
        }}
      >
        <QaList qas={qas} resourceLinks={resourceLinks} />
      </Disclosure>
    </div>
  );
};

/**
 * ContextPanel — shown in the side panel beside the reader text on wide screens. It shows one
 * item at a time and only opens when the reader asks for it: a definition, a Q&A, a section (its
 * text, and its Q&As on request) or a chapter (its summary and sections, each expandable to its
 * full text). The side panel scrolls on its own and can be resized, so nothing is cut short.
 *
 * item: { key, label, title, location?, html, href?, target?, actionLabel?, sections?, qas? }
 * (see describeReferenceTarget in utils/crossReferences.js). Render it with key={item.key}, so
 * each item opens with its rows in their starting state.
 */
export const ContextPanel = ({ item, onClose, onOpenTarget, resourceLinks = EMPTY_RESOURCE_LINKS }) => {
  const headingRef = useRef(null);

  // Move focus to the new item so screen readers announce it; closing returns focus to the
  // term or link that opened it.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [item?.key]);

  if (!item) return null;

  // A chapter with a summary or several sections lists them as rows. A chapter that is a single
  // section without a summary has nothing to choose from, so it shows its text as a section does.
  const onlySection = item.sections?.length === 1 && !item.html ? item.sections[0] : null;
  const qas = onlySection ? onlySection.qas : item.qas;

  return (
    <section
      aria-labelledby="context-panel-title"
      className="rounded-xl border border-gray-200 bg-white no-print animate-fade-in"
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        onClose?.();
      }}
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#007A86]">
          {item.label}
        </span>
        <button
          type="button"
          onClick={() => onClose?.()}
          className="-mr-1 p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-[#7654A1] transition-colors"
          aria-label="Close side panel"
          title="Close (Esc)"
        >
          <AppIcon name="X" size={16} />
        </button>
      </div>
      <h2
        id="context-panel-title"
        ref={headingRef}
        tabIndex={-1}
        className="px-4 pt-1 text-[15px] font-bold leading-snug text-gray-900 break-words focus:outline-none"
      >
        {item.title}
      </h2>
      {item.location && (
        <p className="px-4 mt-0.5 text-[11px] font-medium text-gray-500">{item.location}</p>
      )}
      {/* Above the text, so it stays at hand when the text is long. */}
      {item.target && item.actionLabel && (
        <p className="px-4 mt-2">
          <TargetLink href={item.href} target={item.target} onOpenTarget={onOpenTarget}>
            {item.actionLabel}
          </TargetLink>
        </p>
      )}
      {item.sections && !onlySection ? (
        <ChapterContents item={item} resourceLinks={resourceLinks} onOpenTarget={onOpenTarget} />
      ) : (
        <>
          <div className="mt-2 border-t border-gray-100 px-4 pt-3 pb-4">
            <PanelText html={onlySection ? onlySection.html : item.html} resourceLinks={resourceLinks} />
          </div>
          {qas?.length > 0 && <SectionQas qas={qas} resourceLinks={resourceLinks} />}
        </>
      )}
    </section>
  );
};
