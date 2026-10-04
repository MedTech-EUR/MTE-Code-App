import React from 'react';
import { CODE_CHAPTERS } from '../data/codeData';
import { AppIcon } from './AppIcons';
import { Logo } from './Logo';

// Where MedTech Europe publishes the official text (the PDF this app's text was built from).
export const OFFICIAL_CODE_URL = 'https://www.medtecheurope.org/resource-library/medtech-europe-code-of-ethical-business-practice/';

export const LandingPage = ({ onSelectChapter }) => (
    <div className="animate-fade-in py-10 lg:py-8 px-4 max-w-6xl 2xl:max-w-7xl 3xl:max-w-[110rem] mx-auto overflow-y-auto h-full custom-scrollbar pb-24">
        <div className="text-center mb-16 lg:mb-10">
            <div className="scale-90 sm:scale-100 origin-center flex justify-center">
                <Logo size={null} className="mx-auto mb-8 lg:mb-5 h-36 lg:h-24 aspect-[26/5] max-w-full" centerImage={true} />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4 tracking-tight">The MedTech Europe Code of Ethical Business Practice</h1>
            <p className="text-xl text-gray-500 max-w-2xl mx-auto font-light leading-relaxed">
                Code text: September 2024.
            </p>
            <p className="mt-3 text-sm text-gray-500 max-w-2xl mx-auto leading-relaxed">
                The official text is the PDF that MedTech Europe publishes on{' '}
                <a
                    href={OFFICIAL_CODE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[#007A86] hover:underline"
                >
                    its website
                </a>
                . This app reproduces it for easier reading, with a few editorial corrections; if the two differ, the PDF prevails.
            </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 gap-6">
            {CODE_CHAPTERS.map((item) => (
                <button 
                    key={item.id}
                    onClick={() => onSelectChapter(item.id)}
                    className="chapter-card bg-white p-6 rounded-2xl border border-gray-200 shadow-sm text-left transition-all flex flex-col h-full active:scale-95 group"
                >
                    <div className="p-3 bg-purple-50 rounded-xl w-fit mb-4 text-[#007A86] group-hover:bg-[#0099A7] group-hover:text-white transition-colors">
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
