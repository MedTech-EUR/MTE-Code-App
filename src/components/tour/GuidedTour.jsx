import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppIcon } from '../AppIcons';
import { lessons } from './lessons';

const focusable = 'button:not(:disabled), a[href], input:not(:disabled), textarea, select:not(:disabled), [tabindex="0"]';
const visible = (el) => el.getClientRects().length > 0;
const inside = (el) => el ? [el, ...el.querySelectorAll(focusable)].filter(node => node.matches(focusable) && visible(node)) : [];

function TourDialog({ children, onExit }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return <dialog ref={ref} className="tour-dialog" aria-labelledby="tour-title"
    onCancel={e => { e.preventDefault(); onExit(); }}>{children}</dialog>;
}

const closeButton = (onExit) => <button type="button" className="tour-close" onClick={onExit} aria-label="Close tour"><AppIcon name="X" size={18} /></button>;

const viewport = () => {
  const v = window.visualViewport;
  return { x: v?.offsetLeft || 0, y: v?.offsetTop || 0, w: v?.width || innerWidth, h: v?.height || innerHeight };
};

function measure(node, card) {
  const { x, y, w, h } = viewport();
  const r = node.getBoundingClientRect();
  const left = Math.max(x, r.left - 5);
  const top = Math.max(y, r.top - 5);
  const right = Math.min(x + w, r.right + 5);
  const bottom = Math.min(y + h, r.bottom + 5);
  const width = Math.min(328, w - 20);
  const height = card.offsetHeight;
  const clamp = (n, min, max) => Math.max(min, Math.min(n, max));
  let cardLeft = clamp(left, x + 10, x + w - width - 10);
  let cardTop;
  if (y + h - bottom >= height + 20) cardTop = bottom + 10;
  else if (top - y >= height + 20) cardTop = top - height - 10;
  else if (left - x > width + 20 || x + w - right > width + 20) {
    cardLeft = left - x > width + 20 ? left - width - 10 : right + 10;
    cardTop = clamp(top, y + 10, y + h - height - 10);
  } else cardTop = top - y > y + h - bottom ? y + 8 : y + h - height - 8;
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top),
    cardLeft, cardTop: Math.max(y + 4, cardTop), cardWidth: width };
}

function TourStep({ lesson, index, onNext, onExit, onChoose }) {
  const step = lesson.steps[index];
  const card = useRef(null);
  const nextRef = useRef(onNext);
  const [box, setBox] = useState(null);
  const [missing, setMissing] = useState(false);
  nextRef.current = onNext;

  useLayoutEffect(() => {
    let target = null;
    let frame = 0;
    let timer;
    let described = [];
    function releaseTarget() {
      if (!target) return;
      delete target.dataset.tourCurrent;
      resize.unobserve(target);
      for (const [node, previous] of described) {
        if (previous === null) node.removeAttribute('aria-describedby');
        else node.setAttribute('aria-describedby', previous);
      }
      described = [];
    }
    let advanced = false;
    let settlingUntil = performance.now() + 800;
    const resize = new ResizeObserver(schedule);
    resize.observe(card.current);
    function schedule() {
      if (!frame) frame = requestAnimationFrame(update);
    }
    function update() {
      frame = 0;
      const found = [...document.querySelectorAll(step.target)].find(visible);
      if (found !== target) {
        releaseTarget();
        target = found;
        if (target) {
          target.dataset.tourCurrent = 'true';
          target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
          resize.observe(target);
          const controls = inside(target);
          described = controls.map(node => [node, node.getAttribute('aria-describedby')]);
          for (const [node, previous] of described) {
            node.setAttribute('aria-describedby', [previous, 'tour-instruction'].filter(Boolean).join(' '));
          }
          const first = controls[0];
          // Touch users open the keyboard explicitly, after reading the instruction.
          const opensKeyboard = first?.matches('input,textarea,select') && matchMedia('(pointer: coarse)').matches;
          (first && !opensKeyboard ? first : card.current)?.focus({ preventScroll: true });
          settlingUntil = performance.now() + 800;
          setMissing(false);
        }
      }
      if (target) {
        const rect = measure(target, card.current);
        setBox(old => old && Object.keys(rect).every(k => Math.abs(rect[k] - old[k]) < 0.5) ? old : rect);
      } else setBox(null);
      if (performance.now() < settlingUntil) schedule();
    }
    function advance(e) {
      if (advanced || !target?.contains(e.target)) return;
      if (step.action && !e.target.closest(step.action)) return;
      if (step.event === 'submit' && !target.querySelector('input')?.value.trim()) return;
      advanced = true;
      // Let the actual control run its React handler before changing the spotlight.
      timer = setTimeout(() => nextRef.current(), 0);
    }
    const eventName = step.event === 'optional' ? 'click' : step.event;
    if (eventName !== 'read') document.addEventListener(eventName, advance, true);
    function guard(e) {
      if (card.current?.contains(e.target)) {
        // A tap on the coach card must not dismiss the menu it is describing.
        if (e.type === 'pointerdown') e.stopPropagation();
        return;
      }
      if (target?.contains(e.target)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    }
    function keydown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onExit();
      }
      if (e.key === '/' && !e.target.matches('input,textarea')) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      if (e.key !== 'Tab') return;
      const choices = [...inside(target), ...inside(card.current)];
      const current = choices.indexOf(document.activeElement);
      const dir = e.shiftKey ? -1 : 1;
      e.preventDefault();
      e.stopImmediatePropagation();
      choices[(current + dir + choices.length) % choices.length]?.focus();
    }
    const observer = new MutationObserver(records => {
      if (records.some(record => !record.target.closest?.('.tour-layer'))) schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'disabled', 'aria-expanded'] });
    document.addEventListener('keydown', keydown, true);
    document.addEventListener('pointerdown', guard, true);
    document.addEventListener('click', guard, true);
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    const recovery = setInterval(() => { if (!target) { setMissing(true); schedule(); } }, 3000);
    update();
    return () => {
      clearTimeout(timer); clearInterval(recovery); cancelAnimationFrame(frame);
      releaseTarget();
      observer.disconnect(); resize.disconnect();
      document.removeEventListener(eventName, advance, true);
      document.removeEventListener('keydown', keydown, true);
      document.removeEventListener('pointerdown', guard, true);
      document.removeEventListener('click', guard, true);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
    };
  }, [step, onExit]);

  const manual = step.event === 'optional' || step.event === 'read';
  return <div className="tour-layer no-print">
    {box ? <div className="tour-hole" style={{ left: box.left, top: box.top, width: box.width, height: box.height }} /> : <div className="tour-shade" />}
    <section ref={card} className={'tour-card ' + (box ? '' : 'tour-centred')} role="region" tabIndex={-1} aria-label="Guided tour" aria-describedby="tour-instruction"
      style={box ? { left: box.cardLeft, top: box.cardTop, width: box.cardWidth } : undefined}>
      <div className="tour-meta"><span>{lesson.title} · {index + 1}/{lesson.steps.length}</span>{closeButton(onExit)}</div>
      <div id="tour-instruction" aria-live="polite" aria-atomic="true"><h2>{step.title}</h2><p>{step.instruction}</p></div>
      {box && manual && <button type="button" className="tour-primary" onClick={onNext}>{index === lesson.steps.length - 1 ? 'Finish tour' : 'Continue'}</button>}
      {!box && missing && <p>This control is unavailable. <button type="button" className="tour-link" onClick={onChoose}>Choose a tour</button></p>}
    </section>
  </div>;
}

export function GuidedTour({ tour, onStart, onNext, onChoose, onExit, preserveTask }) {
  const lesson = lessons[tour.lesson];
  let content;
  if (!lesson) {
    content = <TourDialog onExit={onExit}>
      <div className="tour-meta"><AppIcon name="HelpCircle" size={23} />{closeButton(onExit)}</div>
      <h2 id="tour-title">How to use the Code App</h2>
      <p>Choose a task and follow the highlighted controls. {preserveTask ? 'Your current task stays open while the tour runs in a new tab.' : 'You can leave a tour at any point.'}</p>
      <div className="tour-lessons">{Object.entries(lessons).map(([id, entry]) =>
        <button key={id} type="button" onClick={() => onStart(id)}><AppIcon name={entry.icon} size={19} /><span>{entry.title}</span><AppIcon name="ChevronRight" size={16} /></button>)}</div>
    </TourDialog>;
  } else if (tour.index >= lesson.steps.length) {
    content = <TourDialog onExit={onExit}>
      <div className="tour-meta"><span>Tour complete</span>{closeButton(onExit)}</div>
      <h2 id="tour-title">{lesson.title}</h2><p>{lesson.finish}</p>
      <div className="tour-buttons"><button type="button" className="tour-primary" onClick={onExit}>Done</button>
        <button type="button" className="tour-link" onClick={onChoose}>Choose another tour</button></div>
    </TourDialog>;
  } else content = <TourStep key={tour.lesson + tour.index} lesson={lesson} index={tour.index} onNext={onNext} onExit={onExit} onChoose={onChoose} />;
  return createPortal(content, document.body);
}
