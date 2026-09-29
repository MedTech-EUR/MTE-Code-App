import { useEffect } from 'react';

// Where the reader is: the character at the reading point, a quarter of the way down the box
// (below the headings that stay pinned at its top), or the element there when it is not text.
const readingPoint = (box) => ({ x: box.left + box.width / 2, y: box.top + box.height / 4 });

const caretAt = (x, y) => {
  if (document.caretPositionFromPoint) {
    const position = document.caretPositionFromPoint(x, y);
    return position ? { node: position.offsetNode, offset: position.offset } : null;
  }
  const range = document.caretRangeFromPoint?.(x, y);
  return range ? { node: range.startContainer, offset: range.startOffset } : null;
};

const characterTop = (node, offset) => {
  if (!node.isConnected || node.length === 0) return null;
  const range = document.createRange();
  const start = Math.min(offset, node.length - 1);
  range.setStart(node, start);
  range.setEnd(node, start + 1);
  const rect = range.getClientRects()[0];
  return rect ? rect.top : null;
};

const nodeTop = ({ node, offset }) => {
  if (offset !== null) return characterTop(node, offset);
  return node.isConnected ? node.getBoundingClientRect().top : null;
};

const readPosition = (scroller) => {
  const box = scroller.getBoundingClientRect();
  const { x, y } = readingPoint(box);
  const caret = caretAt(x, y);
  if (caret?.node?.nodeType === Node.TEXT_NODE && scroller.contains(caret.node)) {
    const top = characterTop(caret.node, caret.offset);
    if (top !== null) return { node: caret.node, offset: caret.offset, top: top - box.top };
  }
  const element = document.elementFromPoint(x, y);
  if (!element || element === scroller || !scroller.contains(element)) return null;
  return { node: element, offset: null, top: element.getBoundingClientRect().top - box.top };
};

/**
 * Keeps the reader's place in a scrolling box when its width changes, for example while the
 * side panel or the sidebar is dragged wider or narrower: the text at the reading point stays
 * where it was as the lines rewrap. Browsers' own scroll anchoring holds the top of the first
 * visible block instead, which drifts inside a long paragraph, and Safari has none.
 */
export const useKeepReadingPosition = (scrollRef, enabled = true) => {
  useEffect(() => {
    const scroller = scrollRef?.current;
    if (!enabled || !scroller || typeof ResizeObserver === 'undefined') return undefined;

    let position = null;
    // True when the reader may have moved since their place was read: they scrolled, or did
    // something that can change the text.
    let stale = true;
    let frame = null;
    let width = scroller.clientWidth;
    // The scroll offset this hook set, so its own adjustment isn't read as the reader moving.
    let adjustedTop = null;

    const remember = () => {
      // A reading still waiting for the next frame could come after a resize; this one replaces it.
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
        frame = null;
      }
      position = readPosition(scroller);
      stale = false;
    };
    const rememberSoon = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        remember();
      });
    };

    const handleScroll = () => {
      // The browser's own adjustment to a new width, which the observer below corrects.
      if (scroller.clientWidth !== width) return;
      if (adjustedTop !== null && Math.abs(scroller.scrollTop - adjustedTop) < 1) return;
      adjustedTop = null;
      stale = true;
      rememberSoon();
    };
    // Just before a resize handle changes the width, read the place if it isn't known. A series
    // of drags and key presses keeps the first reading, so the place doesn't creep along a line.
    const handlePointerOrKey = (event) => {
      if (!event.target.closest?.('[role="separator"]')) stale = true;
      else if (stale) remember();
    };

    const observer = new ResizeObserver(() => {
      if (scroller.clientWidth === width) return;
      width = scroller.clientWidth;
      const top = !stale && position ? nodeTop(position) : null;
      if (top === null) return;
      scroller.scrollTop += top - scroller.getBoundingClientRect().top - position.top;
      adjustedTop = scroller.scrollTop;
    });

    remember();
    scroller.addEventListener('scroll', handleScroll, { passive: true });
    // Opening or closing something in the box moves its text without scrolling it.
    scroller.addEventListener('click', rememberSoon);
    scroller.addEventListener('keyup', rememberSoon);
    window.addEventListener('pointerdown', handlePointerOrKey, true);
    window.addEventListener('keydown', handlePointerOrKey, true);
    observer.observe(scroller);

    return () => {
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
      scroller.removeEventListener('scroll', handleScroll);
      scroller.removeEventListener('click', rememberSoon);
      scroller.removeEventListener('keyup', rememberSoon);
      window.removeEventListener('pointerdown', handlePointerOrKey, true);
      window.removeEventListener('keydown', handlePointerOrKey, true);
    };
  }, [scrollRef, enabled]);
};
