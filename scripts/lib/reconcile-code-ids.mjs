import { liveRecords } from './code-live-ids.mjs';
import { htmlToPlainText } from '../../src/utils/htmlTextUtils.js';

// A suggestion requires a unique wording match in both publications. Never use a
// chapter number, section number or position as evidence of identity after an import.
export function suggestLiveIds(previous, next) {
  const key = ({ record, kind }) => {
    const plain = (value) => htmlToPlainText(value).replace(/\s+/g, ' ').trim();
    return kind === 'section'
      ? JSON.stringify([kind, plain(record.legalText)])
      : JSON.stringify([kind, plain(record.q).replace(/^Q&A\s+\d+\s*[:.]?\s*/i, ''), plain(record.a)]);
  };
  const group = (chapters) => {
    const map = new Map();
    for (const item of liveRecords(chapters)) {
      const k = key(item);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(item);
    }
    return map;
  };
  const old = group(previous);
  const used = new Set([...liveRecords(next)].map(({ record }) => record.liveId).filter(Boolean));
  const matches = [];
  for (const [k, records] of group(next)) {
    const candidates = old.get(k);
    if (records.length !== 1 || candidates?.length !== 1) continue;
    const id = candidates[0].record.liveId;
    const item = records[0];
    if (id && !used.has(id) && !item.record.liveId) matches.push({ ...item, id });
  }
  return matches;
}
