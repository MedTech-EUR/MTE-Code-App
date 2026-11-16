import React from 'react';
import { AppIcon } from './AppIcons';

export const InstallPrompt = ({ show, onClose }) => {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-800"
        >
          <AppIcon name="X" size={20} />
        </button>
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          Install on iOS
        </h3>
        <p className="text-gray-600 mb-4 text-sm leading-relaxed">
          To install this app on your iPhone or iPad:
        </p>
        <ol className="list-decimal pl-5 space-y-3 text-sm text-gray-700 mb-6">
          <li>
            Tap the <strong>Share</strong> icon (the square with an arrow
            pointing up) at the bottom of your Safari screen.
          </li>
          <li>
            Scroll down the list and tap{' '}
            <strong>"Add to Home Screen"</strong>.
          </li>
        </ol>
        <button
          onClick={onClose}
          className="w-full py-2 bg-[#7654A1] text-white rounded-lg font-bold hover:bg-[#634488] transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
};
