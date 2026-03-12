function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatWeight(weight) {
    if (weight === undefined || weight === null || weight === '?') {
        return 'not available';
    }
    if (weight === Infinity || weight === '#sup') {
        return '#sup';
    }
    if (weight === -Infinity || weight === '#inf') {
        return '#inf';
    }
    return escapeHtml(weight);
}

function formatItemList(items, { empty = 'none', limit = 6 } = {}) {
    if (!items || items.length === 0) {
        return empty;
    }

    const deduped = [...new Set(items.map((item) => String(item)))].sort();
    const visible = deduped.slice(0, limit).map(escapeHtml);
    if (deduped.length > limit) {
        visible.push(`... (+${deduped.length - limit} more)`);
    }
    return visible.join(', ');
}

function formatRule(ruleId, body, head) {
    const renderedBody = body && body.length > 0 ? body.map(escapeHtml).join(', ') : 'top';
    const renderedHead = head ? escapeHtml(head) : '?';
    return `${escapeHtml(ruleId)}: ${renderedHead} &larr; ${renderedBody}`;
}

function buildTooltip(title, rows, note = '') {
    const renderedRows = rows
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([label, value]) => `<div><strong>${escapeHtml(label)}:</strong> ${value}</div>`)
        .join('');

    const renderedNote = note ? `<div><em>${note}</em></div>` : '';
    return `<div class="graph-hover-panel"><div><strong>${escapeHtml(title)}</strong></div>${renderedRows}${renderedNote}</div>`;
}

export function buildAssumptionNodeTooltip({
    assumption,
    explicitWeight,
    contrary,
    incomingSources = [],
    outgoingTargets = [],
    outgoingContraries = []
}) {
    const weightLabel = explicitWeight === null ? 'undeclared (default policy applies)' : formatWeight(explicitWeight);
    return buildTooltip(`Assumption ${assumption}`, [
        ['Explicit weight', weightLabel],
        ['Contrary', contrary ? escapeHtml(contrary) : 'not declared'],
        ['Attacked by', formatItemList(incomingSources)],
        ['Can attack', formatItemList(outgoingTargets)],
        ['Via derived contraries', formatItemList(outgoingContraries)]
    ], 'Assumptions are the selectable commitments in the current framework.');
}

export function buildTopNodeTooltip(factBasedAttacks = []) {
    const targets = factBasedAttacks.map((attack) => attack.assumption);
    const contraries = factBasedAttacks.map((attack) => attack.contrary);
    return buildTooltip('Fact-based attacker top', [
        ['Meaning', 'Encodes attacks derived from facts or empty-body rules'],
        ['Targets', formatItemList(targets)],
        ['Contraries derived as facts', formatItemList(contraries)]
    ], 'This node is synthetic: it summarizes attacks that do not require any assumption in the body.');
}

export function buildAttackEdgeTooltip({
    typeLabel,
    attacker,
    target,
    contrary,
    weight,
    ruleId,
    derivationBody = [],
    derivedBy = [],
    jointWith = [],
    note
}) {
    const ruleSummary = ruleId ? formatRule(ruleId, derivationBody, contrary) : (derivedBy.length > 0 ? derivedBy.map((id) => escapeHtml(id)).join(', ') : 'direct support');
    const partners = jointWith.filter((item) => item !== attacker);
    return buildTooltip(`${typeLabel}: ${attacker} -> ${target}`, [
        ['Weight', formatWeight(weight)],
        ['Target assumption', escapeHtml(target)],
        ['Attacking element', escapeHtml(attacker)],
        ['Contrary produced', contrary ? escapeHtml(contrary) : 'not specified'],
        ['Rule / derivation', ruleSummary],
        ['Other required contributors', formatItemList(partners)]
    ], note);
}

export function buildJunctionTooltip({
    target,
    contrary,
    ruleId,
    derivationBody = [],
    weight
}) {
    return buildTooltip(`Joint attack node for ${target}`, [
        ['Derived contrary', escapeHtml(contrary)],
        ['Target assumption', escapeHtml(target)],
        ['Rule', formatRule(ruleId, derivationBody, contrary)],
        ['Required contributors', formatItemList(derivationBody)],
        ['Attack weight', formatWeight(weight)]
    ], 'The final attack only fires when all contributors to this junction are supported.');
}

export function buildSetNodeTooltip({
    setId,
    assumptions = [],
    supported = [],
    attacks = []
}) {
    const attackedAssumptions = attacks.map((attack) => attack.assumption);
    const attackingElements = attacks.map((attack) => attack.attackingElement);
    const weightLabels = attacks.map((attack) => formatWeight(attack.weight));
    return buildTooltip(`Extension candidate ${setId}`, [
        ['Accepted assumptions', assumptions.length > 0 ? formatItemList(assumptions, { limit: 10 }) : 'empty set'],
        ['Supported atoms', formatItemList(supported, { limit: 10 })],
        ['Launched attacks', String(attacks.length)],
        ['Attacked assumptions', formatItemList(attackedAssumptions)],
        ['Attacking atoms', formatItemList(attackingElements)],
        ['Attack weight labels', formatItemList(weightLabels)]
    ], 'This node represents one candidate extension in the powerset exploration used by the standard graph.');
}

export function buildSetAttackTooltip({
    sourceSet,
    targetSet,
    targetAssumption,
    attackingElement,
    weight,
    derivedBy = []
}) {
    return buildTooltip(`Set attack ${sourceSet} -> ${targetSet}`, [
        ['Weight', formatWeight(weight)],
        ['Attacked assumption', escapeHtml(targetAssumption)],
        ['Supported attacking atom', escapeHtml(attackingElement)],
        ['Source extension', escapeHtml(sourceSet)],
        ['Target extension', escapeHtml(targetSet)],
        ['Derivation rules', formatItemList(derivedBy)]
    ], 'This edge exists because the source extension supports an atom that is the contrary of an assumption accepted by the target extension.');
}
