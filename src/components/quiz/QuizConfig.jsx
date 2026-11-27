import React, { useState, useMemo } from 'react';
import { FULL_CODE_DATA } from '../../data/codeData';
import { FULL_QUIZ_DATA } from '../../data/quizData';
import { AppIcon } from '../AppIcons';
import { PageHeader } from '../PageHeader';

export const QuizConfig = ({ onStart }) => {
  // Extract unique chapters that actually have quiz questions
  const availableChapters = useMemo(() => {
    const chapterIdsWithQuestions = new Set(FULL_QUIZ_DATA.map(q => q.chapterId));
    
    return FULL_CODE_DATA.filter(ch => chapterIdsWithQuestions.has(ch.id)).map(ch => ({
      id: ch.id,
      title: ch.title,
      questionCount: FULL_QUIZ_DATA.filter(q => q.chapterId === ch.id).length
    }));
  }, []);

  const totalAvailableQuestions = availableChapters.reduce((acc, ch) => acc + ch.questionCount, 0);

  const [selectedChapters, setSelectedChapters] = useState(
    availableChapters.map(c => c.id) // Default to all selected
  );
  
  const selectedQuestionCount = FULL_QUIZ_DATA.filter(q => selectedChapters.includes(q.chapterId)).length;
  
  const [questionLimit, setQuestionLimit] = useState(Math.min(10, selectedQuestionCount));

  const handleToggleChapter = (chapterId) => {
    setSelectedChapters(prev => {
      const newSelection = prev.includes(chapterId)
        ? prev.filter(id => id !== chapterId)
        : [...prev, chapterId];
      
      return newSelection;
    });
  };

  const handleStart = () => {
    if (selectedChapters.length === 0) return;
    onStart({
      chapters: selectedChapters,
      limit: questionLimit,
    });
  };

  // Adjust limit if selection changes
  React.useEffect(() => {
    if (questionLimit > selectedQuestionCount) {
      setQuestionLimit(selectedQuestionCount);
    } else if (questionLimit === 0 && selectedQuestionCount > 0) {
      setQuestionLimit(Math.min(10, selectedQuestionCount));
    }
  }, [selectedQuestionCount, questionLimit]);

  return (
    <div className="max-w-2xl lg:max-w-6xl 3xl:max-w-[96rem] mx-auto px-4 sm:px-8 py-8 sm:py-10 animate-page-in pb-24">
      <PageHeader
        icon="BookOpen"
        accent="purple"
        title="Knowledge Quiz"
        description="Test your understanding of the Code of Ethical Business Practice."
      />

      {/* From 1024px the chapters fill a grid and the settings sit beside them, so the whole
          setup fits without a scrolling box. */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8 lg:items-start">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8 lg:mb-0">
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
              <AppIcon name="List" size={20} className="mr-2 text-gray-400" />
              1. Select Chapters
            </h2>
            <p className="text-sm text-gray-600 mt-1">Choose the topics you want to be tested on.</p>
          </div>
        
          <div className="p-4 grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 3xl:grid-cols-4 gap-2 max-h-[40vh] overflow-y-auto lg:max-h-none lg:overflow-visible">
            {availableChapters.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No questions available.</div>
            ) : (
              availableChapters.map(ch => (
                <label
                  key={ch.id}
                  className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#7654A1] has-[:focus-visible]:ring-offset-2 ${
                    selectedChapters.includes(ch.id)
                    ? 'border-[#7654A1]/60 bg-[#7654A1]/5'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium text-gray-900">{ch.title}</span>
                    <span className="block text-xs text-gray-600 mt-1">{ch.questionCount} question{ch.questionCount !== 1 ? 's' : ''} available</span>
                  </span>
                  {/* A real checkbox, hidden from sight only, so Tab and Space work as usual;
                      the box beside it shows its state. */}
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={selectedChapters.includes(ch.id)}
                    onChange={() => handleToggleChapter(ch.id)}
                  />
                  <span
                    aria-hidden="true"
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-gray-400 bg-white text-transparent transition-colors *:scale-50 *:transition-transform *:duration-300 *:ease-spring peer-checked:border-[#7654A1] peer-checked:bg-[#7654A1] peer-checked:text-white peer-checked:*:scale-100 print:border-gray-700 print:peer-checked:text-black"
                  >
                    <AppIcon name="Check" size={14} className="stroke-3" />
                  </span>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="lg:sticky lg:top-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8 lg:mb-6">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 flex items-center">
                <AppIcon name="HelpCircle" size={20} className="mr-2 text-gray-400" />
                2. Number of Questions
              </h2>
            </div>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <label htmlFor="quiz-question-count" className="text-gray-600 font-medium">How many questions?</label>
                <span className="text-2xl font-bold tabular-nums text-[#7654A1]">{questionLimit}</span>
              </div>
              <input
                id="quiz-question-count"
                type="range"
                min="1"
                max={selectedQuestionCount || 1}
                value={questionLimit}
                onChange={(e) => setQuestionLimit(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg cursor-pointer accent-[#7654A1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7654A1] focus-visible:ring-offset-4"
                disabled={selectedQuestionCount === 0}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>1</span>
                <span>Max ({selectedQuestionCount})</span>
              </div>
            </div>
          </div>

          <button
            data-tour="quiz-start"
            onClick={handleStart}
            disabled={selectedChapters.length === 0 || selectedQuestionCount === 0}
            className="w-full no-print py-3.5 bg-[#7654A1] hover:bg-[#634488] disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold rounded-xl text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7654A1] focus-visible:ring-offset-2 flex items-center justify-center transition shadow-sm enabled:active:scale-[0.99] group"
          >
            Start Quiz
            <AppIcon name="ArrowRight" size={18} className="ml-2 transition-transform duration-300 ease-out-soft group-enabled:group-hover:translate-x-1" />
          </button>
        </div>
      </div>
    </div>
  );
};
