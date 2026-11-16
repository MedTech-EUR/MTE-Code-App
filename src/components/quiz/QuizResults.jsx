import React, { useState } from 'react';
import { AppIcon } from '../AppIcons';
import { FULL_CODE_DATA } from '../../data/codeData';
import { buildQuizPath } from '../../utils/routeUtils';

export const QuizResults = ({ results, onRestart, onExit, config }) => {
  const [copied, setCopied] = useState(false);
  const { score, total, incorrectQuestions } = results;
  const percentage = Math.round((score / total) * 100);

  let message = '';
  let color = '';
  let badgeColor = '';
  let icon = '';

  // Full class names only: Tailwind cannot generate classes built at runtime.
  if (percentage >= 90) {
    message = 'Excellent!';
    color = 'text-green-700';
    badgeColor = 'bg-green-100';
    icon = 'Award';
  } else if (percentage >= 70) {
    message = 'Great Job!';
    color = 'text-[#007A86]';
    badgeColor = 'bg-[#0099A7]/10';
    icon = 'ThumbsUp';
  } else if (percentage >= 50) {
    message = 'Good Effort!';
    color = 'text-amber-700';
    badgeColor = 'bg-amber-100';
    icon = 'Star';
  } else {
    message = 'Keep Learning!';
    color = 'text-red-700';
    badgeColor = 'bg-red-100';
    icon = 'BookOpen';
  }

  const handleShare = () => {
    let scopeText = 'Specific Challenge';

    if (config && !config.isShared) {
      const isAllChapters = config.chapters.length >= FULL_CODE_DATA.filter(c => c.sections).length; 
      scopeText = isAllChapters ? 'General Knowledge' : 'Specific Chapters';
      
      if (!isAllChapters && config.chapters.length <= 3) {
        const chapterTitles = config.chapters.map(id => FULL_CODE_DATA.find(c => c.id === id)?.title).filter(Boolean);
        scopeText = chapterTitles.join(', ');
      }
    }
    
    // Determine the precise shared URL based on the exact sequence of questions played
    const questionIds = results.questions ? results.questions.map(q => q.id).join(',') : (config.sharedIds ? config.sharedIds.join(',') : '');
    const quizUrl = new URL(buildQuizPath(`#quiz?q=${questionIds}`), window.location.origin).href;

    const shareText = `I scored ${score}/${total} (${percentage}%) on the MedTech Code Quiz!\nScope: ${scopeText}\n\nCan you beat my score?\nTake the challenge: ${quizUrl}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'MedTech Code Quiz Results',
        text: shareText,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8 sm:py-10 animate-fade-in pb-24 min-h-full flex flex-col">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex-1 overflow-y-auto custom-scrollbar">
        
        {/* Score Header */}
        <div className="p-8 sm:p-12 text-center border-b border-gray-100">
          <div className="mb-6 flex justify-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${badgeColor} ${color}`}>
              <AppIcon name={icon} size={40} />
            </div>
          </div>
          <h2 className="text-3xl sm:text-[2rem] font-bold tracking-tight text-gray-900 mb-2 whitespace-nowrap">
            {message}
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            You scored <span className={`font-bold ${color}`}>{score}</span> out of {total}
          </p>

          <div className="no-print flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleShare}
              className="px-6 py-3 bg-white border border-gray-300 hover:border-[#7654A1] hover:text-[#7654A1] text-gray-800 font-bold rounded-xl flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7654A1] focus-visible:ring-offset-2"
            >
              {copied ? (
                <><AppIcon name="Check" size={18} className="mr-2 text-green-600" /> Copied!</>
              ) : (
                <><AppIcon name="Share2" size={18} className="mr-2" /> Share Result</>
              )}
            </button>
            <button
              onClick={onRestart}
              className="px-6 py-3 bg-[#7654A1] hover:bg-[#634488] text-white font-bold rounded-xl flex items-center justify-center transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7654A1] focus-visible:ring-offset-2"
            >
              <AppIcon name="RotateCcw" size={18} className="mr-2" /> Try Again
            </button>
          </div>
        </div>

        {/* Incorrect Questions Review */}
        {incorrectQuestions.length > 0 && (
          <div className="p-6 sm:p-8">
            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
              <AppIcon name="FileText" size={20} className="mr-2 text-gray-400" />
              Areas for Review ({incorrectQuestions.length})
            </h3>
            
            <div className="space-y-6">
              {incorrectQuestions.map((item, idx) => (
                <div key={idx} className="bg-red-50 border border-red-100 rounded-xl p-5">
                  <div className="flex items-start mb-3">
                    <span className="text-red-500 font-bold mr-3 mt-0.5">{idx + 1}.</span>
                    <h4 className="font-medium text-gray-900 leading-snug">
                      {item.question.question}
                    </h4>
                  </div>
                  
                  <div className="ml-7 space-y-3 mt-4">
                    <div className="flex items-start">
                      <AppIcon name="XCircle" size={16} className="text-red-500 mr-2 mt-0.5 flex-none" />
                      <p className="text-sm text-red-900">
                        <span className="font-semibold">You selected:</span> {
                          item.question.options.find(o => o.id === item.selectedOption)?.text || "Unknown"
                        }
                      </p>
                    </div>
                    <div className="flex items-start">
                      <AppIcon name="CheckCircle" size={16} className="text-green-600 mr-2 mt-0.5 flex-none" />
                      <p className="text-sm text-green-900">
                        <span className="font-semibold">Correct answer:</span> {
                          item.question.options.find(o => o.isCorrect)?.text
                        }
                      </p>
                    </div>
                    
                    <div className="bg-white/60 p-3 rounded-lg text-sm text-gray-700 mt-2">
                      <span className="font-bold text-gray-900">Explanation:</span> {item.question.explanation}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 text-center">
        <button 
          onClick={onExit}
          className="no-print px-1 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider text-[#007A86] hover:text-[#7654A1] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7654A1]/50"
        >
          Return to Hub Menu
        </button>
      </div>
    </div>
  );
};
