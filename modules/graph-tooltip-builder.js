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
    const rows = factBasedAttacks.length > 0
        ? factBasedAttacks.slice(0, 8).map((attack) => `${escapeHtml(attack.contrary)} &rhd; ${escapeHtml(attack.assumption)} (w: ${formatWeight(attack.weight)})`).join('<br>')
        : null;
    return buildTooltip('⊤ (unconditional support)', [
        ['Meaning', 'Stands for what holds with no assumption in the body — facts and empty-body rules'],
        [rows ? 'Attacks it launches' : 'Attacks it launches', rows || 'none — it only feeds a derivation here']
    ], 'Synthetic node: it groups everything derivable without committing to any assumption.');
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

/**
 * A derived (intermediate) claim node in the assumption views.
 *
 * Previously these borrowed buildAttackEdgeTooltip with `target: ''`, which rendered a panel
 * titled "Derived claim: x -> " with an empty "Target assumption" row and always claimed
 * "Rule / derivation: direct support" because no caller passed a rule. The deriving rules are
 * available at the call site, so show them.
 */
export function buildDerivedNodeTooltip({ atom, explicitWeight = null, derivingRules = [] }) {
    const weightLabel = explicitWeight === null || explicitWeight === undefined
        ? 'none declared — propagated from its premises by the semiring'
        : formatWeight(explicitWeight);
    const ruleRows = derivingRules.length > 0
        ? derivingRules.map((rule) => formatRule(rule.id, rule.body || [], rule.head || atom)).join('<br>')
        : 'no rule derives this atom';
    return buildTooltip(`Derived claim ${atom}`, [
        ['Declared weight', weightLabel],
        [derivingRules.length > 1 ? 'Derived by (any of)' : 'Derived by', ruleRows]
    ], 'An intermediate claim built by rules from the assumptions — a step in the reasoning, not itself an assumption.');
}

/**
 * A derivation (support) step in the assumption views.
 *
 * Previously this borrowed buildAttackEdgeTooltip and was handed vis NODE IDS, so it displayed
 * internal identifiers such as `arg_chimerism` and `junction_chimerism_r3` to the reader.
 * Takes atoms instead; a junction end is described rather than named.
 */
export function buildSupportEdgeTooltip({ fromAtom = null, toAtom, ruleId = null, body = [], viaJunction = false }) {
    const source = fromAtom === null
        ? 'all premises of the rule (via the ∧ junction)'
        : escapeHtml(fromAtom);
    return buildTooltip('Derivation step', [
        ['Supports', escapeHtml(toAtom)],
        ['From', source],
        ['Rule', ruleId ? formatRule(ruleId, body, toAtom) : 'not recorded'],
        [viaJunction ? 'Feeds the junction for' : null, viaJunction ? escapeHtml(toAtom) : null]
    ].filter(([label]) => label !== null), 'A support step, not an attack: the source helps establish the target.');
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

/**
 * The ∧ node in Assumption-Branching, which marks a rule with several premises. Distinct from
 * buildJunctionTooltip, which describes a joint ATTACK: this one is a derivation step, so
 * calling its head a "target assumption" (as the attack wording does) is simply wrong.
 */
export function buildDerivationJunctionTooltip({ head, ruleId = null, body = [] }) {
    return buildTooltip('∧ all premises required', [
        ['Derives', escapeHtml(head)],
        ['Rule', ruleId ? formatRule(ruleId, body, head) : 'not recorded'],
        [body.length === 1 ? 'Premise' : `Premises (all ${body.length} needed)`, formatItemList(body, { limit: 8 })]
    ], 'A rule with more than one premise. The step fires only when every premise above is supported.');
}

export function buildSetNodeTooltip({
    setId,
    assumptions = [],
    supported = [],
    attacks = []
}) {
    // One row per attack. The previous 'Attack weight labels' row deduped and sorted the
    // weights, so it could not be matched back to the attack it belonged to.
    const attackRows = attacks.length > 0
        ? attacks.slice(0, 8).map((attack) => `${escapeHtml(attack.attackingElement)} &rhd; ${escapeHtml(attack.assumption)} (w: ${formatWeight(attack.weight)})`).join('<br>')
            + (attacks.length > 8 ? `<br>... (+${attacks.length - 8} more)` : '')
        : 'none';
    return buildTooltip(`Extension candidate ${setId}`, [
        ['Accepted assumptions', assumptions.length > 0 ? formatItemList(assumptions, { limit: 10 }) : 'empty set'],
        ['Supported atoms', formatItemList(supported, { limit: 10 })],
        [attacks.length === 1 ? 'Attack it launches' : `Attacks it launches (${attacks.length})`, attackRows]
    ], 'One candidate set of assumptions. The Standard view draws every such set, so it is bounded to small frameworks.');
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
