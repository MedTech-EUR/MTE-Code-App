import treeDataJson from './treeData.json';

export const TREE_DATA = treeDataJson.trees;

/**
 * Get all unique categories from tree data.
 */
export const getTreeCategories = () => {
  const cats = new Set(TREE_DATA.map(t => t.category));
  return [...cats];
};

/**
 * A tree's related chapters or sections. treeData.json stores them as lists (the content editor's
 * layout); a single ID is accepted too.
 */
const asList = (value) => (Array.isArray(value) ? value : value ? [value] : []);

/**
 * Get trees related to a specific chapter ID.
 */
export const getTreesByChapter = (chapterId) => {
  return TREE_DATA.filter((tree) => asList(tree.relatedChapter).includes(chapterId));
};

/**
 * Get trees related to a specific section ID.
 */
export const getTreesBySection = (sectionId) => {
  return TREE_DATA.filter((tree) => asList(tree.relatedSection).includes(sectionId));
};

/**
 * True for a tree listed under particular sections; it is not listed again at the end of its
 * chapter.
 */
export const isSectionTree = (tree) => asList(tree.relatedSection).length > 0;
