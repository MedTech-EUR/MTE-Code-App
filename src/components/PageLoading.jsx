import React from 'react';

/**
 * Shown while a part of the app that loads on demand (the TPPT Checker, the event support
 * checker) is fetched: the outline of a page, with a soft sheen passing over it (`skeleton`,
 * index.css). It waits a moment before appearing, so a quick load shows no flash at all.
 */
export const PageLoading = ({ label }) => (
  <main className="flex-1 h-full overflow-y-auto bg-gray-50/50 custom-scrollbar">
    <div
      role="status"
      className="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-10 animate-fade-in [animation-delay:150ms]"
    >
      <div className="flex items-start gap-4" aria-hidden="true">
        <div className="skeleton h-12 w-12 shrink-0 rounded-xl" />
        <div className="flex-1 space-y-3 pt-1">
          <div className="skeleton h-7 w-2/3 rounded-lg" />
          <div className="skeleton h-4 w-5/6 rounded-md" />
        </div>
      </div>
      <div className="mt-10 space-y-4" aria-hidden="true">
        <div className="skeleton h-32 rounded-2xl" />
        <div className="skeleton h-20 rounded-2xl [animation-delay:120ms]" />
        <div className="skeleton h-20 rounded-2xl [animation-delay:240ms]" />
      </div>
      <p className="mt-6 text-sm font-medium text-gray-500">{label}</p>
    </div>
  </main>
);
