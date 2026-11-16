import React from 'react';
import { Logo } from './Logo';
import { AppIcon } from './AppIcons';
import { PageHeader } from './PageHeader';
import { SECTIONS } from '../config/sections';

export const HubPage = ({ onSelectSection }) => (
  <div className="animate-fade-in px-4 sm:px-8 py-8 sm:py-10 max-w-5xl xl:max-w-6xl 3xl:max-w-[96rem] mx-auto pb-24">
    {/* The header above already shows the logo; on paper, where the header is absent, it is printed here. */}
    <Logo size={null} className="hidden print:flex mb-6 h-16 aspect-[26/5]" />

    <PageHeader
      title="The MedTech Europe Code of Ethical Business Practice"
      description="The Digital Home of the MedTech Europe Code of Ethical Business Practice"
      className="mb-8 sm:mb-10"
    />

    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 xl:gap-6">
      {SECTIONS.filter(s => s.available).map((section) => (
        <button
          key={section.id}
          type="button"
          onClick={() => onSelectSection(section.id)}
          style={{ '--accent': section.color, '--accent-text': section.textColor || section.color }}
          className="group flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-6 sm:p-7 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 active:scale-[0.99]"
        >
          <span
            aria-hidden="true"
            className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--accent)_10%,white)] text-[var(--accent-text)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--accent)_18%,white)] transition-colors duration-200 group-hover:bg-[var(--accent)] group-hover:text-white group-hover:ring-[var(--accent)]"
          >
            <AppIcon name={section.icon} size={24} />
          </span>

          <h2 className="text-xl font-bold tracking-tight text-gray-900">
            {section.title}
          </h2>

          {section.subtitle && (
            <p className="mt-1 text-[11px] font-semibold uppercase leading-normal tracking-wider text-gray-500">
              {section.subtitle}
            </p>
          )}

          <p className="mt-3 mb-6 flex-1 text-sm leading-relaxed text-gray-600">
            {section.description}
          </p>

          <span className="flex items-center text-xs font-bold uppercase tracking-wider text-[var(--accent-text)]">
            Open
            <AppIcon
              name="ChevronRight"
              size={14}
              className="ml-1 transition-transform group-hover:translate-x-1"
            />
          </span>
        </button>
      ))}
    </div>
  </div>
);
