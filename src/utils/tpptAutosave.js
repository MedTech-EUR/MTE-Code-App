// The TPPT Checker keeps the agenda and answers in the browser between visits. An empty checker
// leaves nothing behind, so "Start over" removes what was saved.
export const TPPT_AUTOSAVE_KEY = 'tppt_autosave_state';

export function isEmptyTpptState({ inputText, sessions, qVenue, qStandalone, qSize }) {
  return !String(inputText || '').trim()
    && !(sessions && sessions.length)
    && qVenue == null && qStandalone == null && qSize == null;
}

export function saveTpptState(storage, state) {
  if (isEmptyTpptState(state)) storage.removeItem(TPPT_AUTOSAVE_KEY);
  else storage.setItem(TPPT_AUTOSAVE_KEY, JSON.stringify(state));
}
