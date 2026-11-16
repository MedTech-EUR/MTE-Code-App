import React, { useState, useEffect } from 'react';
import { QuizConfig } from './QuizConfig';
import { QuizSession } from './QuizSession';
import { QuizResults } from './QuizResults';
import { FULL_QUIZ_DATA } from '../../data/quizData';
import { buildQuizPath } from '../../utils/routeUtils';

export const QuizContent = ({ onExit }) => {
  const [phase, setPhase] = useState('config'); // 'config', 'session', 'results'
  const [config, setConfig] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [results, setResults] = useState(null);

  useEffect(() => {
    const syncSharedQuiz = () => {
      const hash = window.location.hash;
      const qParams = hash.includes('#quiz?q=') ? hash.split('?q=')[1].split('&')[0] : '';
      const sharedQuestionIds = qParams.split(',').filter(Boolean);
      const sharedQuestions = sharedQuestionIds
        .map(id => FULL_QUIZ_DATA.find(q => q.id === id))
        .filter(Boolean);

      if (sharedQuestions.length > 0) {
        setConfig({
          chapters: [],
          limit: sharedQuestions.length,
          isShared: true,
          sharedIds: sharedQuestionIds
        });
        setQuestions(sharedQuestions);
        setResults(null);
        setPhase('session');
        return;
      }

      setConfig(null);
      setQuestions([]);
      setResults(null);
      setPhase('config');
    };

    syncSharedQuiz();
    window.addEventListener('popstate', syncSharedQuiz);
    window.addEventListener('hashchange', syncSharedQuiz);

    return () => {
      window.removeEventListener('popstate', syncSharedQuiz);
      window.removeEventListener('hashchange', syncSharedQuiz);
    };
  }, []);

  const handleStartQuiz = (newConfig) => {
    setConfig(newConfig);
    
    // Filter questions by selected chapters
    let potentialQuestions = FULL_QUIZ_DATA.filter(q => newConfig.chapters.includes(q.chapterId));
    
    // Shuffle questions
    potentialQuestions = potentialQuestions.sort(() => 0.5 - Math.random());
    
    // Limit to requested number
    const selectedQuestions = potentialQuestions.slice(0, newConfig.limit);
    
    setQuestions(selectedQuestions);
    setPhase('session');
  };

  const handleComplete = (quizResults) => {
    setResults({ ...quizResults, questions });
    setPhase('results');
  };

  const handleRestart = () => {
    if (window.location.hash.includes('?q=')) {
      window.history.replaceState(null, '', buildQuizPath());
    }
    setPhase('config');
    setResults(null);
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-slate-50/60 custom-scrollbar">
      {phase === 'config' && (
        <QuizConfig onStart={handleStartQuiz} />
      )}
      
      {phase === 'session' && (
        <QuizSession 
          questions={questions} 
          onComplete={handleComplete} 
          onExit={onExit}
        />
      )}
      
      {phase === 'results' && (
        <QuizResults 
          results={results} 
          config={config}
          onRestart={handleRestart}
          onExit={onExit}
        />
      )}
    </div>
  );
};
