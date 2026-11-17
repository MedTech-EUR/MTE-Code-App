import React from 'react';
import { AppIcon } from './AppIcons';
import { firstLetter, matchesTerm } from '../utils/glossaryIndex';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/**
 * Above the Glossary's definitions: a box that narrows them to the terms that match, and an
 * A–Z bar that jumps to the first term under a letter. Letters with no term are shown dimmed.
 */
export const GlossaryIndex = ({ sections = [], query, onQueryChange }) => {
  const letters = new Set(sections.map((section) => firstLetter(section.title)));
  const shown = query ? sections.filter((section) => matchesTerm(section.title, query)).length : sections.length;

  const jumpTo = (letter) => {
    onQueryChange('');
    const target = sections.find((section) => firstLetter(section.title) === letter);
    if (!target) return;
    // After the filter clears, so the definition is on the page.
    window.requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      document.getElementById(target.computedId)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    });
  };

  return (
    <div className="no-print mb-8 rounded-xl border border-gray-200 bg-white p-4">
      <label className="relative block">
        <span className="sr-only">Find a term</span>
        <AppIcon name="Search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Find a term"
          className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm focus:border-[#7654A1] focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-200"
        />
      </label>
      <nav aria-label="Terms by first letter" className="mt-3 flex flex-wrap gap-0.5">
        {ALPHABET.map((letter) => (
          letters.has(letter) ? (
            <button
              key={letter}
              type="button"
              onClick={() => jumpTo(letter)}
              className="h-7 w-6 rounded-md text-xs font-semibold text-[#007A86] transition-colors hover:bg-[#0099A7]/10 focus-visible:outline-2 focus-visible:outline-[#7654A1]"
            >
              {letter}
            </button>
          ) : (
            <span key={letter} aria-hidden="true" className="flex h-7 w-6 items-center justify-center text-xs text-gray-300">
              {letter}
            </span>
          )
        ))}
      </nav>
      <p aria-live="polite" className={`mt-2 text-xs text-gray-500 ${query ? '' : 'sr-only'}`}>
        {shown === 0 ? 'No term matches.' : `${shown} of ${sections.length} terms`}
      </p>
    </div>
  );
};
