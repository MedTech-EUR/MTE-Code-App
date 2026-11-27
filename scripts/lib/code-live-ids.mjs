// The registry holds identifiers only. Withdrawing an item reserves its ID permanently.
export function* liveRecords(chapters) {
  for (const chapter of chapters.filter((chapter) => chapter.part !== 'website')) {
    for (const section of chapter.sections) {
      yield { record: section, chapter, kind: 'section' };
      for (const qa of section.qas) yield { record: qa, chapter, kind: 'qa' };
    }
  }
}

export function validateLiveIds(chapters, registry) {
  const active = new Set(registry.active);
  const withdrawn = new Set(registry.withdrawn);
  const seen = new Set();
  if (active.size !== registry.active.length || withdrawn.size !== registry.withdrawn.length) {
    throw new Error('Duplicate permanent ID in the registry');
  }
  for (const id of [...active, ...withdrawn]) {
    if (!/^[a-z0-9][a-z0-9-]{0,199}$/.test(id) || (active.has(id) && withdrawn.has(id))) {
      throw new Error('Invalid or reused permanent ID: ' + id);
    }
  }
  for (const { record, chapter } of liveRecords(chapters)) {
    const id = record.liveId;
    if (!active.has(id) || seen.has(id)) {
      throw new Error(chapter.id + ': missing, unregistered or duplicate permanent ID: ' + id);
    }
    seen.add(id);
  }
  for (const id of active) {
    if (!seen.has(id)) throw new Error('Missing published record. Reconcile or explicitly withdraw: ' + id);
  }
}
