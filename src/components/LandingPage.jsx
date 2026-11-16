import React from 'react';
import { CODE_CHAPTERS } from '../data/codeData';
import { AppIcon } from './AppIcons';
import { Logo } from './Logo';
import { PageHeader } from './PageHeader';

export const LandingPage = ({ onSelectChapter }) => (
    <div className="animate-fade-in px-4 sm:px-8 py-8 sm:py-10 max-w-6xl 2xl:max-w-7xl 3xl:max-w-[110rem] mx-auto pb-24">
        {/* The header above already shows the logo; on paper, where the header is absent, it is printed here. */}
        <Logo size={null} className="hidden print:flex mb-6 h-16 aspect-[26/5]" />
        <PageHeader
            icon="FileText"
            accent="teal"
            title="The MedTech Europe Code of Ethical Business Practice"
            description="Code text: September 2024."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 gap-6">
            {CODE_CHAPTERS.map((item) => (
                <button 
                    key={item.id}
                    onClick={() => onSelectChapter(item.id)}
                    className="chapter-card bg-white p-6 rounded-2xl border border-gray-200 shadow-sm text-left transition-all flex flex-col h-full active:scale-95 group"
                >
                    <div className="p-3 bg-[#0099A7]/10 rounded-xl w-fit mb-4 text-[#007A86] group-hover:bg-[#0099A7] group-hover:text-white transition-colors">
                        <AppIcon name={item.icon} size={28} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h3>
                    <div className="mt-6 flex items-center text-xs font-bold text-[#7654A1] uppercase tracking-wider">
                        View Chapter <AppIcon name="ChevronRight" size={14} className="ml-1 transition-transform group-hover:translate-x-1" />
                    </div>
                </button>
            ))}
        </div>
    </div>
);
