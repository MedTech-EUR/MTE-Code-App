// Release metadata shared by every provision and Q&A. Set an edition name when
// formally designated. Only an adopted substantive change advances the version.
export const CODE_EDITION = null;
export const CODE_VERSION = 'September 2024';
export const CODE_PDF = 'https://www.medtecheurope.org/wp-content/uploads/2017/06/code-september-2024.pdf';

export function codeReleaseLabel(edition, version) {
  return [edition, 'Version ' + version].filter(Boolean).join(' · ');
}
