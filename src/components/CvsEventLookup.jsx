import React from 'react';
import { AppIcon } from './AppIcons';

// Finds an Event in the public Conference Vetting System and shows its current status. The
// search runs through this app's Worker (cvs-api.js); nothing entered in the checker is sent.

const inputClass = 'w-full rounded-xl border border-slate-200 p-3 outline-none focus:ring-2 focus:ring-[#7654A1]';

// `showSelected={false}` leaves the selected Event to the caller (a decision tree shows it in its answer).
export default function CvsEventLookup({ lookup, showSelected = true }) {
  const { filters, search, selected, busy, error, updateFilter, searchEvents, selectEvent } = lookup;
  return <div>
        <form onSubmit={searchEvents} aria-busy={busy === 'search'} className="no-print mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="cvs-name" className="mb-1 block text-sm font-medium text-slate-700">Event name</label>
              <input id="cvs-name" required maxLength={200} value={filters.name} onChange={(e) => updateFilter('name', e.target.value)} className={inputClass} placeholder="e.g. Heart Rhythm Meeting" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="cvs-country" className="mb-1 block text-sm font-medium text-slate-700">Country <span className="font-normal text-slate-500">(optional)</span></label>
              <input id="cvs-country" maxLength={100} value={filters.country} onChange={(e) => updateFilter('country', e.target.value)} className={inputClass} placeholder="e.g. Belgium" />
            </div>
            {['from', 'to'].map((key) => (
              <div key={key}>
                <label htmlFor={`cvs-${key}`} className="mb-1 block text-sm font-medium text-slate-700">{key === 'from' ? 'From date' : 'To date'} <span className="font-normal text-slate-500">(optional)</span></label>
                <input id={`cvs-${key}`} type="date" value={filters[key]} onChange={(e) => updateFilter(key, e.target.value)} className={inputClass} />
              </div>
            ))}
          </div>
          <button type="submit" disabled={busy === 'search' || !filters.name.trim()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#7654A1] px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            <AppIcon name={busy === 'search' ? 'Loader2' : 'Search'} size={18} className={busy === 'search' ? 'animate-spin' : ''} />
            {busy === 'search' ? 'Searching CVS…' : 'Search CVS'}
          </button>
        </form>

        <div aria-live="polite" aria-atomic="true" className="mt-4 text-sm text-slate-600">
          {busy === 'search' && 'Searching CVS…'}
          {search?.results.length === 0 && <p>No Event in CVS matches this search. Try another name, or remove the country or dates. No match does not show that the Event is outside CVS scope.</p>}
        </div>
        {error && (
          <div role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p>{error.message}</p>
            <p className="mt-1 font-medium">The Event’s CVS status is unknown.</p>
            {error.kind === 'status' && selected && <button type="button" onClick={() => selectEvent(selected)} className="no-print mt-2 font-semibold underline">Try again</button>}
          </div>
        )}

        {search?.results.length > 0 && (
          <fieldset className="no-print mt-6 space-y-3">
            <legend className="mb-3 text-lg font-semibold text-slate-800">Events found in CVS ({search.results.length})</legend>
            {search.mayBeLimited && <p className="mb-3 text-sm text-amber-800">CVS shows at most 50 Events per search. If yours is missing, narrow the name, country or dates.</p>}
            {search.results.map((event) => (
              <label key={event.emtId} className={`flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-4 ${selected?.emtId === event.emtId ? 'border-[#7654A1]' : 'border-slate-200'}`}>
                <input type="radio" name="cvs-event" value={event.emtId} checked={selected?.emtId === event.emtId} onChange={() => selectEvent(event)} className="mt-1 accent-[#7654A1]" />
                <span>
                  <span className="block font-semibold text-slate-800">{event.name}</span>
                  <span className="mt-1 block text-sm text-slate-600">{event.from}{event.to !== event.from ? ` – ${event.to}` : ''} · {[event.city, event.country].filter(Boolean).join(', ')}</span>
                  <span className="mt-1 block text-xs text-slate-500">{event.emtId}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}

        {showSelected && <CvsSelectedEvent lookup={lookup} />}
  </div>;
}

const SELECTED_STYLES = {
  full: {
    box: 'mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:shadow-none',
    name: 'text-lg font-semibold text-slate-800',
    emtId: 'mt-1 text-sm text-slate-500',
    status: 'mt-4 text-slate-700',
    checked: 'mt-2 text-xs text-slate-500',
    actions: 'no-print mt-4 flex flex-wrap items-center gap-4',
  },
  compact: {
    box: 'mb-4 rounded-xl border border-white/80 bg-white/60 p-4',
    name: 'text-sm font-semibold text-gray-900',
    emtId: 'text-xs text-gray-500',
    status: 'mt-2 text-sm text-gray-700',
    checked: 'mt-1 text-xs text-gray-500',
    actions: 'no-print mt-3 flex flex-wrap items-center gap-4',
  },
};

// The selected Event and its current status. `compact` fits it inside a decision tree's answer.
export function CvsSelectedEvent({ lookup, compact = false }) {
  const { selected, status, busy, selectEvent } = lookup;
  if (!selected) return null;
  const styles = compact ? SELECTED_STYLES.compact : SELECTED_STYLES.full;
  const Name = compact ? 'p' : 'h2';
  return (
    <section aria-live="polite" aria-busy={busy === 'status'} className={styles.box}>
      <Name className={styles.name}>{status?.name || selected.name}</Name>
      <p className={styles.emtId}>{selected.emtId}</p>
      <p className={styles.status}>Status in CVS: <strong>{busy === 'status' ? 'Checking the current status…' : status?.status.raw || 'Unknown'}</strong></p>
      {status && <p className={styles.checked}>Checked {new Date(status.retrievedAt).toLocaleString()}. The status can change after this check.</p>}
      <div className={styles.actions}>
        <a href={selected.detailUrl || status?.detailUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-[#007A86] hover:underline">View this Event in CVS <AppIcon name="ExternalLink" size={14} /></a>
        {status && <button type="button" onClick={() => selectEvent(selected)} className="text-sm font-semibold text-[#7654A1] hover:underline">Check again</button>}
      </div>
    </section>
  );
}
