import { useCallback, useEffect, useRef } from 'react';
import { getPageForUrl } from '../config/pages';
import { parseAppLocation } from '../config/routes';
import { setDocumentPageMeta } from '../utils/pageMeta';
import { createRouteEffectScheduler } from '../utils/routeEffects';
import {
  buildChapterPath,
  buildCodeHomePath,
  buildCodeSectionPath,
  buildEventSupportPath,
  buildHomePath,
  buildQuizPath,
  buildTpptPath,
  buildTransparencyDocumentPath,
  buildTransparencyHomePath,
  buildTransparencySectionPath,
  buildTransparencyUnitPath,
  buildTreePath,
  buildTreesHomePath,
} from '../utils/routeUtils';

function currentRouteUrl() {
  return `${window.location.pathname}${window.location.hash}`;
}

export const useAppRouting = ({
  setActiveId,
  setActiveDocumentId,
  setActiveSection,
  setShowSummary,
  setShowFullText,
  setShowQA,
  scrollRef,
}) => {
  const routeEffectsRef = useRef(null);
  if (!routeEffectsRef.current) {
    routeEffectsRef.current = createRouteEffectScheduler();
  }

  const applyRoute = useCallback((route) => {
    setActiveSection(route.activeSection);
    setActiveId(route.activeId);
    setActiveDocumentId?.(route.activeDocumentId ?? null);
    setDocumentPageMeta(getPageForUrl(route.canonicalUrl));

    if (route.anchor) {
      setShowSummary(true);
      setShowFullText(true);
      if (route.anchorType === 'qa') {
        setShowQA?.(true);
      }
    }

    routeEffectsRef.current.schedule({
      anchor: route.anchor,
      findAnchor: (anchor) => document.getElementById(anchor),
      scrollToTop: () => {
        scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
      },
    });
  }, [
    scrollRef,
    setActiveDocumentId,
    setActiveId,
    setActiveSection,
    setShowFullText,
    setShowQA,
    setShowSummary,
  ]);

  const syncFromBrowser = useCallback(() => {
    const route = parseAppLocation(window.location.pathname, window.location.hash);

    if (currentRouteUrl() !== route.canonicalUrl) {
      window.history.replaceState(null, '', route.canonicalUrl);
    }

    applyRoute(route);
  }, [applyRoute]);

  useEffect(() => {
    syncFromBrowser();
    window.addEventListener('popstate', syncFromBrowser);
    window.addEventListener('hashchange', syncFromBrowser);

    return () => {
      window.removeEventListener('popstate', syncFromBrowser);
      window.removeEventListener('hashchange', syncFromBrowser);
      routeEffectsRef.current?.cancel();
    };
  }, [syncFromBrowser]);

  const navigateTo = useCallback((requestedUrl, { replace = false } = {}) => {
    const target = new URL(requestedUrl, window.location.origin);
    const route = parseAppLocation(target.pathname, target.hash);

    if (currentRouteUrl() !== route.canonicalUrl) {
      const historyMethod = replace ? 'replaceState' : 'pushState';
      window.history[historyMethod](null, '', route.canonicalUrl);
    }

    applyRoute(route);
  }, [applyRoute]);

  const navigateHome = useCallback(() => navigateTo(buildHomePath()), [navigateTo]);
  const navigateCodeHome = useCallback(() => navigateTo(buildCodeHomePath()), [navigateTo]);
  const navigateChapter = useCallback((chapterId) => {
    navigateTo(buildChapterPath(chapterId));
  }, [navigateTo]);
  const navigateCodeSection = useCallback((chapterId, sectionId) => {
    navigateTo(buildCodeSectionPath(chapterId, sectionId));
  }, [navigateTo]);
  const navigateTreesHome = useCallback(() => navigateTo(buildTreesHomePath()), [navigateTo]);
  const navigateTree = useCallback((treeId) => navigateTo(buildTreePath(treeId)), [navigateTo]);
  const navigateQuiz = useCallback(() => navigateTo(buildQuizPath()), [navigateTo]);
  const navigateTppt = useCallback(() => navigateTo(buildTpptPath()), [navigateTo]);
  const navigateEventSupport = useCallback(() => navigateTo(buildEventSupportPath()), [navigateTo]);
  const navigateTransparencyHome = useCallback(() => {
    navigateTo(buildTransparencyHomePath());
  }, [navigateTo]);
  const navigateTransparencyDocument = useCallback((documentId) => {
    navigateTo(buildTransparencyDocumentPath(documentId));
  }, [navigateTo]);
  const navigateTransparencyUnit = useCallback((documentId, unitId) => {
    navigateTo(buildTransparencyUnitPath(documentId, unitId));
  }, [navigateTo]);
  const navigateTransparencySection = useCallback((documentId, unitId, sectionId) => {
    navigateTo(buildTransparencySectionPath(documentId, unitId, sectionId));
  }, [navigateTo]);

  return {
    navigateHome,
    navigateCodeHome,
    navigateChapter,
    navigateCodeSection,
    navigateTreesHome,
    navigateTree,
    navigateQuiz,
    navigateTppt,
    navigateEventSupport,
    navigateTransparencyHome,
    navigateTransparencyDocument,
    navigateTransparencyUnit,
    navigateTransparencySection,
  };
};
