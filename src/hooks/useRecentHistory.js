import { useState, useCallback } from 'react';
import { FULL_CODE_DATA } from '../data/codeData';
import { getTransparencyUnit } from '../data/transparency/transparencyData';

export const useRecentHistory = (maxItems = 5) => {
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('mte_recent_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Error loading history', e);
      return [];
    }
  });

  const addHistory = useCallback((chapterId, section = 'code', documentId = null) => {
    if (!chapterId || chapterId === 'home') return;
    
    setHistory(prev => {
      const chapter = section === 'transparency'
        ? getTransparencyUnit(documentId, chapterId)
        : FULL_CODE_DATA.find(c => c.id === chapterId);
      if (!chapter) return prev;

      const newEntry = {
        id: chapter.id,
        title: chapter.title,
        icon: chapter.icon,
        part: chapter.part,
        section: section || 'code',
        documentId,
        timestamp: Date.now()
      };

      // IDs are only unique inside their publication, so retain similarly named
      // entries from other Code/Transparency documents.
      const filtered = prev.filter((item) => !(
        item.id === chapterId
        && (item.section || 'code') === (section || 'code')
        && (item.documentId || null) === (documentId || null)
      ));
      
      const newHistory = [newEntry, ...filtered].slice(0, maxItems);
      
      try {
        localStorage.setItem('mte_recent_history', JSON.stringify(newHistory));
      } catch (e) {
        console.error('Error saving history', e);
      }
      return newHistory;
    });
  }, [maxItems]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem('mte_recent_history');
    } catch (e) {
      console.error('Error clearing history', e);
    }
  }, []);

  return { history, addHistory, clearHistory };
};

