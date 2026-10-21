/**
 * Checks a decision tree the way an editor thinks about it: does every answer lead to a step that
 * exists, and is every step reached from "start"? Used by the content editor's trees preview
 * (cms-fields.js); `npm run validate:data` checks the same rules before publishing.
 */

/** Outcome labels as the app shows them (src/components/TreeResultCard.jsx). */
export const OUTCOME_LABELS = {
  compliant: 'Compliant', 'non-compliant': 'Non-Compliant', conditional: 'Conditional', 'consult-legal': 'Consult Legal',
  'not-required': 'CVS Assessment Not Required', 'out-of-scope': 'Out of Scope', 'not-applicable': 'Not Applicable',
  'prior-review': 'Prior Review Required', 'in-scope': 'In Scope of the Code', 'more-info': 'More Information Needed',
};

/** Problems in one tree, in plain words, and the order its steps are reached from "start". */
export function inspectTree(tree) {
  const nodes = tree.nodes ?? [];
  const byId = new Map();
  const problems = [];
  for (const node of nodes) {
    if (!node.id) problems.push('A step has no ID.');
    else if (byId.has(node.id)) problems.push(`Two steps have the ID “${node.id}”.`);
    else byId.set(node.id, node);
  }
  if (!byId.has('start')) problems.push('There is no step with the ID “start”, where the tree begins.');
  const order = [];
  const seen = new Set();
  const queue = byId.has('start') ? ['start'] : [];
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    const node = byId.get(id);
    order.push(node);
    for (const option of node.type === 'question' ? node.options ?? [] : []) {
      if (!option.next) problems.push(`In “${node.id}”, the answer “${option.label || '(no label)'}” leads to no step.`);
      else if (!byId.has(option.next)) problems.push(`In “${node.id}”, the answer “${option.label || '(no label)'}” leads to “${option.next}”, which does not exist.`);
      else queue.push(option.next);
    }
    if (node.type === 'question' && !(node.options ?? []).length) problems.push(`The question “${node.id}” has no answers.`);
    if (node.type === 'result' && !OUTCOME_LABELS[node.outcome]) problems.push(`The result “${node.id}” has no outcome.`);
  }
  const unreached = nodes.filter((node) => node.id && !seen.has(node.id));
  return { order, unreached, problems, byId };
}
