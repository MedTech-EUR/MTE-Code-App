import { codeReleaseLabel } from '../../src/data/codeEdition.js';
import { escapeHtml } from './prerender.mjs';

function questionBlock(qa) {
  const title = [qa.label, qa.question].filter(Boolean).join(' · ');
  return '<section><h3>' + escapeHtml(title) + '</h3>' + qa.html + '</section>';
}

// All inserted Code HTML has already passed through apiHtml at build time.
export function renderLiveEmbed({ about, chapter, section, qa }, includeQas, showVersion) {
  const item = qa ?? section;
  const title = [chapter.heading, section.title].filter(Boolean).join(' · ');
  const figure = section.figure ? '<figure><img src="' + escapeHtml(section.figure.url)
    + '" alt="' + escapeHtml(section.figure.description) + '"></figure>' : '';
  const body = qa ? questionBlock(qa) : figure + section.html + (includeQas ? section.qas.map(questionBlock).join('') : '');
  const release = showVersion ? ' · ' + escapeHtml(codeReleaseLabel(about.edition, about.version)) : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} | MedTech Europe Code</title><base target="_blank"><style>
*{box-sizing:border-box}body{margin:0;padding:1rem;font:1rem/1.55 system-ui,sans-serif;color:#172e39;background:white}article{border-inline-start:3px solid #007a86;padding-inline-start:1rem;overflow-wrap:anywhere}h1{font-size:1.15rem;margin:0 0 .65rem}h3{font-size:1rem}a{color:#006875}table{border-collapse:collapse;font-size:.9rem}td,th{border:1px solid #bccbd0;padding:.35rem;text-align:start}img{max-width:100%;height:auto}footer{margin-top:1rem;font-size:.85rem}section{margin-top:.8rem}
</style></head><body><article><h1>${escapeHtml(title)}</h1>${body}<footer><a href="${escapeHtml(item.url)}" rel="noopener noreferrer">MedTech Europe Code of Ethical Business Practice</a>${release}</footer></article></body></html>`;
}
