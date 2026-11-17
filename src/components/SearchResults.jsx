import React from 'react';
import { AppIcon } from './AppIcons';

// Type badge -> icon + Tailwind classes. Provision/Q&A/Definition are Code(/Guidelines) text;
// summary, app-info and publication are app-authored content, never Code or Guidelines text.
const TYPE_BADGES = {
  provision: { icon: 'FileText', className: 'bg-white text-[#007A86] border border-[#0099A7]/40' },
  qa: { icon: 'HelpCircle', className: 'bg-cyan-100 text-cyan-800' },
  definition: { icon: 'BookOpen', className: 'bg-purple-100 text-purple-800' },
  summary: { icon: 'Info', className: 'bg-gray-100 text-gray-600' },
  'app-info': { icon: 'Info', className: 'bg-gray-100 text-gray-600' },
  publication: { icon: 'Eye', className: 'bg-gray-100 text-gray-600' },
};
const DEFAULT_BADGE = { icon: 'FileText', className: 'bg-gray-100 text-gray-600' };

const DEFAULT_TYPE_FILTER = new Set(['provision', 'qa', 'definition']);
const MAX_INTERPRETATION_MEMBERS = 6;

const APP_RESULTS_HEADING = {
  code: 'App content — not Code text',
  transparency: 'Publication details — not Guidelines text',
};

const SCOPE_NAMES = {
  code: 'the Code',
  transparency: 'the Guidelines',
};

const formatDebugNumber = (value) => (
  value === Infinity ? '∞' : Number(value ?? 0).toFixed(2)
);

// Renders a snippet's highlighted ranges as real <mark> elements built from plain text offsets.
// snippet.text is plain text (not HTML), so this never touches dangerouslySetInnerHTML.
const renderSnippetText = (snippet) => {
  if (!snippet?.text) return null;
  const { text, highlights } = snippet;
  if (!highlights || highlights.length === 0) return text;

  const nodes = [];
  let cursor = 0;
  highlights.forEach(([start, end], index) => {
    if (start > cursor) nodes.push(text.slice(cursor, start));
    nodes.push(
      <mark key={`mark-${index}`} className="bg-yellow-200 text-black rounded px-0.5">
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
};

const formatMatchedEntry = (entry) => {
  if (entry.concept == null) return null;
  if (entry.source === 'query') return entry.text;
  if (entry.source === 'spelling') return `${entry.text} (spelling)`;
  if (entry.source === 'glossary') return `${entry.text} (Glossary, for “${entry.concept}”)`;
  return `${entry.text} (for “${entry.concept}”)`;
};

// A concept "used an expansion" when it has at least one matched member whose source isn't the
// user's own typed word (spelling/completion/phrasebook/abbreviation/glossary).
const expandedMembers = (concept) => (
  (concept?.members || []).filter((member) => member.matched && member.source !== 'query')
);

// The typed word or phrase itself appears nowhere in this scope, but similar terms do: "wife" is
// not in the Code, yet "spouse" and "Guests" are.
const isNotInScope = (concept) => (
  !concept.quoted
  && concept.members?.[0]?.source === 'query'
  && concept.members[0].matched === false
  && expandedMembers(concept).length > 0
);

const joinLabels = (labels) => (
  labels.length > 1 ? `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}` : labels[0]
);

const buildNotInScopeLine = (concepts, scope) => {
  const missing = (concepts || []).filter(isNotInScope);
  if (missing.length === 0) return null;
  const fragments = [];
  let remaining = MAX_INTERPRETATION_MEMBERS;
  for (const concept of missing) {
    if (remaining <= 0) break;
    const texts = expandedMembers(concept).slice(0, remaining).map((member) => member.text);
    remaining -= texts.length;
    fragments.push(missing.length > 1 ? `${texts.join(', ')} (for “${concept.label}”)` : texts.join(', '));
  }
  const labels = joinLabels(missing.map((concept) => `“${concept.label}”`));
  const verb = missing.length > 1 ? 'are' : 'is';
  return `${labels} ${verb} not in ${SCOPE_NAMES[scope] || SCOPE_NAMES.code}. `
    + `Showing similar terms that may help: ${fragments.join('; ')}.`;
};

// Extra terms searched alongside words that ARE in the text (words that are not get the line
// above instead).
const buildInterpretationLine = (concepts) => {
  const fragments = [];
  let remaining = MAX_INTERPRETATION_MEMBERS;
  for (const concept of concepts || []) {
    if (remaining <= 0) break;
    if (isNotInScope(concept)) continue;
    const members = expandedMembers(concept);
    if (members.length === 0) continue;
    const texts = members.slice(0, remaining).map((member) => member.text);
    remaining -= texts.length;
    fragments.push(`${texts.join(', ')} (for “${concept.label}”)`);
  }
  return fragments.length > 0 ? `Also searching: ${fragments.join('; ')}` : null;
};

const buildSpellingLine = (corrections) => (
  corrections && corrections.length > 0
    ? `Spelling: ${corrections.map((c) => `${c.from} → ${c.to}`).join(', ')}`
    : null
);

// Words (or quoted phrases) that appear nowhere in this scope. The engine leaves them out of
// the ranking, so say so rather than silently searching the other words.
const buildUnmatchedLine = (concepts) => {
  const labels = (concepts || []).filter((concept) => !concept.matched).map((concept) => `“${concept.label}”`);
  return labels.length > 0 ? `No match for ${labels.join(', ')}; showing results for your other words.` : null;
};

const usedExpansionsOrCorrections = (response) => (
  (response.corrections && response.corrections.length > 0)
  || (response.concepts || []).some((concept) => expandedMembers(concept).length > 0)
);

const ResultRow = ({
  hit, rank, isStale, debug, onSelect, onPreview,
}) => {
  const badge = TYPE_BADGES[hit.type] || DEFAULT_BADGE;
  const matchedLine = (hit.matched || []).map(formatMatchedEntry).filter(Boolean).join(' · ');
  const snippetNodes = renderSnippetText(hit.snippet);

  return (
    <li className="relative">
      <button
        type="button"
        disabled={isStale}
        onClick={() => onSelect(hit, rank)}
        className={`w-full text-left px-3 py-2.5 rounded-xl border border-gray-100 hover:border-[#0099A7]/50 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-wait ${
          onPreview ? 'pr-9' : ''
        }`}
      >
        <div className="flex items-center gap-2 mb-1 min-w-0">
          <span className={`inline-flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${badge.className}`}>
            <AppIcon name={badge.icon} size={10} />
            {hit.label}
          </span>
          <span className="truncate flex-1 min-w-0 text-[10px] text-gray-400">{hit.location}</span>
        </div>
        <p className="font-semibold text-sm text-gray-900 line-clamp-2">{hit.title}</p>
        {snippetNodes && (
          <p className="text-xs text-gray-500 line-clamp-3 mt-1">{snippetNodes}</p>
        )}
        {matchedLine && (
          <p className="text-[10px] text-gray-400 mt-1">Matched: {matchedLine}</p>
        )}
        {debug && (
          <div className="mt-1 pt-1 border-t border-dashed border-gray-200 text-[10px] text-gray-400 font-mono space-y-0.5">
            <div>{`id: ${hit.id}`}</div>
            <div>
              {`score: ${formatDebugNumber(hit.score)} · coverage: ${formatDebugNumber(hit.coverage)} · proximity: ${formatDebugNumber(hit.proximity)}`}
            </div>
            {hit.matched?.length > 0 && (
              <div>{`sources: ${hit.matched.map((m) => m.source).join(', ')}`}</div>
            )}
          </div>
        )}
      </button>
      {/* A sibling of the result button (buttons cannot be nested): shows the result in the
          side panel without leaving the page. */}
      {onPreview && (
        <button
          type="button"
          disabled={isStale}
          onClick={(event) => onPreview(hit, event.currentTarget)}
          className="absolute top-2 right-2 p-1 rounded-md text-gray-400 hover:text-[#007A86] hover:bg-cyan-50 focus-visible:outline-2 focus-visible:outline-[#0099A7] transition-colors disabled:opacity-50"
          aria-label={`Preview “${hit.title}” beside the text`}
          title="Preview beside the text"
        >
          <AppIcon name="Eye" size={14} />
        </button>
      )}
    </li>
  );
};

/**
 * Presentational ranked search results list for the sidebar. Pure render of a runSearch()
 * response: no fetching, no state. Selecting a result is entirely the caller's responsibility
 * via onSelect(hit, rank) -- this component only renders and reports what was clicked.
 */
export const SearchResults = ({
  response,
  scope = 'code',
  typeFilter = DEFAULT_TYPE_FILTER,
  isStale = false,
  debug = false,
  onSelect,
  onSearch,
  onPreview,
  canPreview,
}) => {
  if (!response) return null;
  const previewFor = (hit) => (onPreview && (!canPreview || canPreview(hit)) ? onPreview : undefined);

  const filteredResults = response.results.filter((hit) => typeFilter.has(hit.type));
  const appResults = response.appResults || [];
  const isZeroResults = filteredResults.length === 0 && appResults.length === 0;

  const notInScopeLine = buildNotInScopeLine(response.concepts, scope);
  const interpretationLine = buildInterpretationLine(response.concepts);
  const spellingLine = buildSpellingLine(response.corrections);
  const unmatchedLine = isZeroResults ? null : buildUnmatchedLine(response.concepts);
  const showPartialCoverageNotice = response.results.length > 0 && !response.allTermsMatched;
  const phraseSuggestion = typeof response.phraseSuggestion === 'string' ? response.phraseSuggestion : null;
  const showTip = !phraseSuggestion && usedExpansionsOrCorrections(response);

  return (
    <div className="no-print space-y-3">
      <p className="text-xs text-gray-400">
        {`${filteredResults.length} result${filteredResults.length === 1 ? '' : 's'}`}
      </p>

      {notInScopeLine && (
        <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
          {notInScopeLine}
        </p>
      )}

      {interpretationLine && (
        <p className="text-xs text-gray-500">{interpretationLine}</p>
      )}

      {spellingLine && (
        <p className="text-xs text-gray-500">{spellingLine}</p>
      )}

      {unmatchedLine && (
        <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
          {unmatchedLine}
        </p>
      )}

      {showPartialCoverageNotice && (
        <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
          No result contains all your words; showing closest matches.
        </p>
      )}

      {phraseSuggestion && (
        <p className="text-xs text-gray-500">
          {'Looking for the exact phrase? '}
          <button
            type="button"
            onClick={() => onSearch?.(phraseSuggestion)}
            className="font-semibold text-[#007A86] underline underline-offset-2 hover:text-[#005f69]"
          >
            {`Search ${phraseSuggestion}`}
          </button>
        </p>
      )}

      {showTip && (
        <p className="text-xs text-gray-400 italic">
          {'Use "quotes" for exact wording.'}
        </p>
      )}

      {isZeroResults ? (
        <div className="px-2 py-6 text-center">
          <p className="text-sm font-semibold text-gray-600">{`No results for “${response.query}”.`}</p>
          <p className="text-xs text-gray-400 mt-1">
            Try other words, check the spelling, or browse the chapters.
          </p>
        </div>
      ) : (
        filteredResults.length > 0 && (
          // Keyed by the query, so each new set of results cascades in.
          <ul key={response.query} aria-label="Search results" className="stagger space-y-2">
            {filteredResults.map((hit, index) => (
              <ResultRow
                key={hit.id}
                hit={hit}
                rank={index}
                isStale={isStale}
                debug={debug}
                onSelect={onSelect}
                onPreview={previewFor(hit)}
              />
            ))}
          </ul>
        )
      )}

      {appResults.length > 0 && (
        <div className="pt-2 border-t border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-0.5">
            {APP_RESULTS_HEADING[scope] || APP_RESULTS_HEADING.code}
          </p>
          <ul key={response.query} aria-label="App content results" className="stagger space-y-2 opacity-70">
            {appResults.map((hit, index) => (
              <ResultRow
                key={hit.id}
                hit={hit}
                rank={index}
                isStale={isStale}
                debug={debug}
                onSelect={onSelect}
                onPreview={previewFor(hit)}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
