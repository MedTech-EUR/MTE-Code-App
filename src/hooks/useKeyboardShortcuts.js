import { useEffect } from 'react';
import { updateSearchStatus } from '../data/codeData';

// Below this width the sidebar is a slide-in menu (Tailwind's lg breakpoint).
const DRAWER_SIDEBAR_QUERY = '(max-width: 1023.98px)';

/**
 * Puts the cursor in the search box, which lives in the sidebar: on small screens the
 * slide-in menu opens first. Used by the "/" key and when the Home page's search bar hands
 * its search over (Enter).
 */
export const openSearchBox = (setSidebarOpen) => {
  if (setSidebarOpen && window.matchMedia?.(DRAWER_SIDEBAR_QUERY).matches) {
    setSidebarOpen(true);
  }
  // After the menu has started to open, so the box can take the focus; the cursor goes to
  // the end of what is already typed.
  window.requestAnimationFrame(() => {
    const box = document.getElementById('searchTerm');
    if (!box) return;
    box.focus();
    const end = box.value.length;
    box.setSelectionRange?.(end, end);
  });
};

export const useKeyboardShortcuts = (setSearchTerm, setSidebarOpen) => {
  useEffect(() => {
    const handleKeydown = (e) => {
      if (
        e.key === '/' &&
        !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)
      ) {
        e.preventDefault();
        openSearchBox(setSidebarOpen);
      }
      if (e.key === 'Escape') {
        const searchInput = document.getElementById('searchTerm');
        if (searchInput && searchInput === document.activeElement) {
          setSearchTerm('');
          updateSearchStatus('Search cleared');
          searchInput.blur();
        }
      }
    };

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [setSearchTerm, setSidebarOpen]);
};
