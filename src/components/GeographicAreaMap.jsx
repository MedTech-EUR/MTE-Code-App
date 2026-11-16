import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AppIcon } from './AppIcons';
import { useNationalAssociations } from '../hooks/useNationalAssociations';
import { findAreaAssociations } from '../utils/nationalAssociations';
import MAP from '../data/geographicArea/map.json';
import AREAS from '../data/geographicArea/areas.json';

// The interactive map of Annex III. Closed, it shows what the published figure shows: the
// MedTech Europe Geographic Area in teal. Choosing a country, on the map or in the list above
// it, lifts the country off the map and lists its National Associations with links to their
// Codes on ethicalmedtech.eu. "Countries covered by Mecomed" is one entry of Annex III and
// opens as one area.
//
// The drawing (data/geographicArea/map.json) is made by scripts/build-geographic-area-map.mjs;
// the areas and their names (data/geographicArea/areas.json) follow the country lists of
// Annex III, which `npm run validate:data` checks. The associations come from
// ethicalmedtech.eu (hooks/useNationalAssociations.js). See docs/geographic-area-map.md.
//
// The reader shows this map in place of the published figure, which stays in the Code's text
// for print and for readers without the map (config/readerEmbeds.js).

const [, , MAP_WIDTH, MAP_HEIGHT] = MAP.viewBox;
const WHOLE_MAP = MAP.viewBox;
const OPEN_MS = 650;
const CLOSE_MS = 450;
// Room kept free around an opened country, as parts of the map's size; the top leaves space
// for the "Whole map" button.
const MARGIN = { top: 0.13, right: 0.06, bottom: 0.06, left: 0.06 };

const LISTS = AREAS.lists.map((list) => ({
  heading: list.heading,
  areas: list.areas.map((area) => ({
    ...area,
    // "Countries covered by Mecomed*": the asterisk points to the note, which the card shows.
    label: area.name.replace(/\*+$/, ''),
    heading: list.heading,
    shape: MAP.areas.find((shape) => shape.id === area.id),
  })),
}));
const ALL_AREAS = LISTS.flatMap((list) => list.areas).filter((area) => area.shape);
const AREA_BY_ID = new Map(ALL_AREAS.map((area) => [area.id, area]));

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const easeOut = (t) => 1 - (1 - t) ** 3;
const easeInOut = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

// The view that shows `box` as large as the margins allow.
const fitView = ([x, y, w, h]) => {
  const innerWidth = MAP_WIDTH * (1 - MARGIN.left - MARGIN.right);
  const innerHeight = MAP_HEIGHT * (1 - MARGIN.top - MARGIN.bottom);
  const zoom = Math.min(innerWidth / w, innerHeight / h);
  return [
    x - (MAP_WIDTH * MARGIN.left + (innerWidth - w * zoom) / 2) / zoom,
    y - (MAP_HEIGHT * MARGIN.top + (innerHeight - h * zoom) / 2) / zoom,
    MAP_WIDTH / zoom,
    MAP_HEIGHT / zoom,
  ];
};

// Moves the view so that `box` travels on screen in a straight line from its place in view
// `from` to its place in view `to`, growing or shrinking steadily: the country lifts off the map.
function animateView(svg, from, to, box, ms, ease, onDone) {
  const set = (view) => svg.setAttribute('viewBox', view.join(' '));
  if (ms <= 0 || prefersReducedMotion()) {
    set(to);
    onDone();
    return () => {};
  }
  const place = (view) => {
    const scale = MAP_WIDTH / view[2];
    return [(box[0] - view[0]) * scale, (box[1] - view[1]) * scale, box[2] * scale];
  };
  const start = place(from);
  const end = place(to);
  const startedAt = performance.now();
  let frame = requestAnimationFrame(function step(now) {
    const t = Math.min(1, (now - startedAt) / ms);
    const [px, py, width] = start.map((value, i) => value + (end[i] - value) * ease(t));
    const scale = width / box[2];
    set([box[0] - px / scale, box[1] - py / scale, MAP_WIDTH / scale, MAP_HEIGHT / scale]);
    if (t < 1) frame = requestAnimationFrame(step);
    else {
      set(to);
      onDone();
    }
  });
  return () => cancelAnimationFrame(frame);
}

const ExternalLink = ({ href, children, className = '' }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className={`font-semibold text-[#007A86] underline decoration-[#0099A7]/40 underline-offset-2 hover:decoration-current ${className}`}
  >
    {children}
    <span className="sr-only"> (opens in a new tab)</span>
  </a>
);

// What the map says about the opened area: where Annex III lists it, its National Associations
// and their Codes.
const AreaCard = ({ area, entry, onClose, cardRef }) => (
  <section
    ref={cardRef}
    aria-label={area.label}
    className="mt-3 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm sm:p-5"
  >
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold leading-snug text-gray-600">{area.heading}</p>
        <h3 className="mt-1 text-lg font-bold leading-tight text-gray-900">{area.label}</h3>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close and show the whole map"
        className="-mr-1 -mt-1 shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7654A1]"
      >
        <AppIcon name="X" size={18} />
      </button>
    </div>

    {entry ? (
      <>
        <ul className="mt-4 space-y-4">
          {entry.associations.map((association) => (
            <li key={association.name}>
              <p className="text-sm font-bold text-gray-900">
                {association.name}
                {association.website && (
                  <>
                    {' '}
                    <ExternalLink href={association.website} className="ml-1 text-xs font-medium">
                      Website
                    </ExternalLink>
                  </>
                )}
              </p>
              {association.codes.length > 0 && (
                <ul className="mt-1.5 space-y-1.5">
                  {association.codes.map((code) => (
                    <li key={code.url} className="flex items-start gap-2 text-sm leading-snug">
                      <AppIcon name="FileText" size={15} className="mt-0.5 shrink-0 text-[#0099A7]" />
                      <ExternalLink href={code.url}>{code.label}</ExternalLink>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
        {entry.url && (
          <p className="mt-4 border-t border-gray-100 pt-3 text-sm">
            <a
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-semibold text-[#7654A1] hover:underline"
            >
              National Associations’ Codes on ethicalmedtech.eu
              <AppIcon name="ExternalLink" size={14} />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </p>
        )}
      </>
    ) : (
      area.heading === LISTS[0].heading && (
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          ethicalmedtech.eu lists no National Association Code for this country.
        </p>
      )
    )}

    {area.note && <p className="mt-4 text-xs italic leading-relaxed text-gray-600">{area.note}</p>}
  </section>
);

export default function GeographicAreaMap() {
  const id = useId();
  const countries = useNationalAssociations();
  // `openId` is the chosen area; `raised` stays true until the area has settled back into the map.
  const [openId, setOpenId] = useState(null);
  const [shownId, setShownId] = useState(null);
  const [settled, setSettled] = useState(false);
  const [tip, setTip] = useState(null);
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const zoomRef = useRef(null);
  const cardRef = useRef(null);
  const viewRef = useRef(WHOLE_MAP);

  const openArea = openId ? AREA_BY_ID.get(openId) : null;
  const shownArea = shownId ? AREA_BY_ID.get(shownId) : null;
  const entry = useMemo(() => (openArea ? findAreaAssociations(openArea, countries) : null), [openArea, countries]);

  const open = useCallback((areaId) => {
    setTip(null);
    setSettled(false);
    setOpenId(areaId);
    if (areaId) setShownId(areaId);
  }, []);
  const close = useCallback(() => open(null), [open]);

  // Opening: the area starts exactly over its place on the map and grows to fill the frame.
  // Closing: it goes back, then its drawing is removed. Choosing another area while one is
  // open starts from the whole map again.
  useEffect(() => {
    const svg = zoomRef.current;
    if (!svg || !shownArea) return undefined;
    const box = shownArea.shape.box;
    if (openId) {
      const target = fitView(box);
      viewRef.current = WHOLE_MAP;
      return animateView(svg, WHOLE_MAP, target, box, OPEN_MS, easeInOut, () => {
        viewRef.current = target;
        setSettled(true);
      });
    }
    return animateView(svg, viewRef.current, WHOLE_MAP, box, CLOSE_MS, easeOut, () => {
      viewRef.current = WHOLE_MAP;
      setShownId(null);
    });
  }, [openId, shownArea]);

  // On a phone the card can open below the screen: bring it into view.
  useEffect(() => {
    const card = cardRef.current;
    if (!openId || !card) return;
    if (card.getBoundingClientRect().bottom > window.innerHeight) {
      card.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
  }, [openId]);

  // Escape goes back to the whole map, unless another control outside the map has focus.
  useEffect(() => {
    if (!openId) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const active = document.activeElement;
      if (active && active !== document.body && !rootRef.current?.contains(active)) return;
      event.preventDefault();
      close();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [openId, close]);

  const showTip = (event, area) => {
    if (event.pointerType === 'touch') return;
    const stage = stageRef.current.getBoundingClientRect();
    setTip({ label: area.label, x: event.clientX - stage.left, y: event.clientY - stage.top, width: stage.width });
  };
  const areaHandlers = (area) => ({
    onClick: () => open(area.id),
    onPointerMove: (event) => showTip(event, area),
    onPointerLeave: () => setTip(null),
  });

  return (
    <div ref={rootRef} className="no-print mx-auto my-8 w-full max-w-[560px]">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <label htmlFor={`${id}-area`} className="text-sm font-semibold text-gray-900">
          Country
        </label>
        <select
          id={`${id}-area`}
          value={openId || ''}
          onChange={(event) => open(event.target.value || null)}
          aria-describedby={`${id}-hint`}
          className="min-w-0 max-w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7654A1]"
        >
          <option value="">Whole map</option>
          {LISTS.map((list) => (
            <optgroup key={list.heading} label={list.heading}>
              {list.areas
                .filter((area) => area.shape)
                .sort((a, b) => a.label.replace(/^The /, '').localeCompare(b.label.replace(/^The /, '')))
                .map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.label}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <p id={`${id}-hint`} className="basis-full text-xs leading-relaxed text-gray-600">
          Select a country on the map, or choose it in this list, to see its National Associations and their Codes.
        </p>
      </div>

      <div ref={stageRef} className="relative w-full overflow-hidden rounded-xl" style={{ aspectRatio: `${MAP_WIDTH} / ${MAP_HEIGHT}` }}>
        <svg
          viewBox={WHOLE_MAP.join(' ')}
          role="img"
          aria-label="Map of the MedTech Europe Geographic Area: the countries of the two lists of Annex III, and the countries covered by Mecomed in the Middle East and Africa."
          className="block h-full w-full"
        >
          <path d={MAP.outside} fill="#AFEDEC" stroke="#fff" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
          {ALL_AREAS.map((area) => (
            <path
              key={area.id}
              d={area.shape.d}
              stroke="#fff"
              strokeWidth="0.6"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className="cursor-pointer fill-[#0099A7] transition-colors hover:fill-[#007A86]"
              {...areaHandlers(area)}
            />
          ))}
          {MAP.lines.map((line) => (
            <path key={line.area} d={line.d} fill="none" stroke="#fff" strokeOpacity="0.4" strokeWidth="0.6" vectorEffect="non-scaling-stroke" className="pointer-events-none" />
          ))}
          {/* Countries too small to see or click get a ring. */}
          {ALL_AREAS.filter((area) => area.shape.marker).map((area) => (
            <circle
              key={area.id}
              cx={area.shape.marker[0]}
              cy={area.shape.marker[1]}
              r="6"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              className="cursor-pointer fill-white/80 stroke-[#0099A7] transition-colors hover:stroke-[#007A86]"
              {...areaHandlers(area)}
            />
          ))}
        </svg>

        {shownArea && (
          <>
            <div
              onClick={close}
              className={`absolute inset-0 bg-white transition-opacity duration-500 ${openId ? 'opacity-80' : 'opacity-0'}`}
            />
            <svg
              ref={zoomRef}
              viewBox={WHOLE_MAP.join(' ')}
              aria-hidden="true"
              focusable="false"
              onClick={close}
              className="absolute inset-0 h-full w-full cursor-zoom-out drop-shadow-[0_6px_14px_rgb(0_0_0/0.28)]"
            >
              {/* A country has its own, finer drawing for this size. */}
              <path d={shownArea.shape.opened || shownArea.shape.d} fill="#0099A7" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              {MAP.lines
                .filter((line) => line.area === shownArea.id)
                .map((line) => (
                  <path key={line.area} d={line.d} fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
                ))}
            </svg>
            {openId && (
              <button
                type="button"
                onClick={close}
                className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-lg border border-[#7654A1] bg-white px-3 py-1.5 text-sm font-semibold text-[#7654A1] shadow-sm transition-opacity duration-300 hover:bg-[#7654A1] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7654A1] ${settled ? 'opacity-100' : 'opacity-0'}`}
              >
                <AppIcon name="ChevronLeft" size={16} />
                Whole map
              </button>
            )}
          </>
        )}

        {tip && !openId && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute z-10 max-w-[14rem] rounded-md bg-gray-900 px-2 py-1 text-xs font-semibold text-white shadow"
            style={{
              top: Math.max(0, tip.y - 34),
              ...(tip.x > tip.width / 2 ? { right: tip.width - tip.x + 8 } : { left: tip.x + 8 }),
            }}
          >
            {tip.label}
          </div>
        )}
      </div>

      <div aria-live="polite">
        {openArea && <AreaCard key={openArea.id} area={openArea} entry={entry} onClose={close} cardRef={cardRef} />}
      </div>
    </div>
  );
}
