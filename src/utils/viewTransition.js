import { flushSync } from 'react-dom';

/**
 * Runs a page change through the browser's View Transitions API, so the old page fades out over
 * the new one while the header and the sidebar stay in place (the styles are under "Motion" in
 * index.css). `update` must apply the change synchronously; it is wrapped in flushSync so React
 * has rendered the new page by the time the browser takes its picture of it.
 *
 * Without the API (older browsers), with "Reduce motion" set, or while the tab is hidden, the
 * change is applied at once, as before. Returns true when a transition was started.
 */
export function runViewTransition(update) {
  if (!canAnimatePageChange()) {
    update();
    return false;
  }

  try {
    const transition = document.startViewTransition(() => {
      flushSync(update);
    });
    // An error while rendering the new page is reported as usual, not lost in a promise.
    transition.updateCallbackDone?.catch((error) => console.error(error));
    // A transition cut short (a second click before the first finished) rejects these
    // promises; the page change itself has still happened.
    transition.ready?.catch(() => {});
    transition.finished?.catch(() => {});
    return true;
  } catch {
    update();
    return false;
  }
}

function canAnimatePageChange() {
  if (typeof document === 'undefined' || typeof document.startViewTransition !== 'function') {
    return false;
  }
  if (document.visibilityState === 'hidden') return false;
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
