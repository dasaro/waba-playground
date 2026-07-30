/**
 * Hover panels for the argumentation graph.
 *
 * Design: a one-line header naming what the element is, then a row of CHIPS carrying only the
 * facts you cannot read off the graph itself.
 *
 * Two problems shaped this:
 *
 *  - vis-network's stylesheet sets `div.vis-network div.vis-tooltip { white-space: nowrap;
 *    background-color: #f5f4ed; ... }`. That selector outranks a bare `.vis-tooltip`, so panels
 *    rendered cream-on-dark in Verdana and, being unable to wrap, grew to the width of their
 *    longest line and were clipped by the viewport. style.css now loads AFTER the vis sheet and
 *    matches its specificity.
 *  - the panels were one label per line with a block `<strong>`, so every fact cost two lines,
 *    and each ended in a sentence of explanatory prose. Chips carry the same facts in a fraction
 *    of the space.
 *
 * Values are escaped here; callers pass raw atoms.
 */

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
        return null;
    }
    if (weight === Infinity || weight === '#sup') {
        return '#sup';
    }
    if (weight === -Infinity || weight === '#inf') {
        return '#inf';
    }
    return escapeHtml(weight);
}

/** A chip: a micro-label plus a value. Both escaped. Empty values drop out entirely. */
function chip(label, value, { tone = '' } = {}) {
    if (value === undefined || value === null || value === '') {
        return '';
    }
    const toneClass = tone ? ` gt-chip-${tone}` : '';
    const caption = label ? `<i>${escapeHtml(label)}</i>` : '';
    return `<span class="gt-chip${toneClass}">${caption}${value}</span>`;
}

/** Chip listing atoms, capped so a wide framework cannot produce an essay. */
function chipList(label, items, { limit = 4 } = {}) {
    if (!items || items.length === 0) {
        return '';
    }
    const deduped = [...new Set(items.map(String))].sort();
    const shown = deduped.slice(0, limit).map(escapeHtml).join(', ');
    const more = deduped.length > limit ? ` +${deduped.length - limit}` : '';
    return chip(label, `${shown}${more}`);
}

/** `r1: head ← b1, b2` — the single most useful fact about a derived element. */
function ruleChip(ruleId, body = [], head = null) {
    if (!ruleId) {
        return '';
    }
    const renderedBody = body && body.length > 0 ? body.map(escapeHtml).join(', ') : '⊤';
    const renderedHead = head ? escapeHtml(head) : '?';
    return chip(ruleId, `${renderedHead} &larr; ${renderedBody}`, { tone: 'rule' });
}

/**
 * Every panel ends with exactly `</div></div>` -- the close of the chip row, then of the panel.
 * The chip row is emitted even when empty so graph-highlighting can append a state chip by
 * slicing that suffix. The previous injector matched the first `</strong></div>`, which tied it
 * to a markup shape it did not own.
 */
export const PANEL_CHIP_SUFFIX = '</div></div>';

function panel(kind, subject, chips) {
    const body = chips.filter(Boolean).join('');
    const heading = subject
        ? `<span class="gt-kind">${escapeHtml(kind)}</span><span class="gt-subject">${escapeHtml(subject)}</span>`
        : `<span class="gt-kind">${escapeHtml(kind)}</span>`;
    return `<div class="graph-hover-panel"><div class="gt-head">${heading}</div>`
        + `<div class="gt-chips">${body}${PANEL_CHIP_SUFFIX}`;
}

/** Appends a chip to an already-built panel. Returns the input unchanged if it is not one. */
export function appendStateChip(baseTitle, label, tone) {
    if (typeof baseTitle !== 'string' || !baseTitle.endsWith(PANEL_CHIP_SUFFIX)) {
        return baseTitle;
    }
    const stateChip = chip('', escapeHtml(label), { tone });
    return baseTitle.slice(0, -PANEL_CHIP_SUFFIX.length) + stateChip + PANEL_CHIP_SUFFIX;
}

export function buildAssumptionNodeTooltip({
    assumption,
    explicitWeight,
    contrary,
    incomingSources = [],
    outgoingTargets = []
}) {
    return panel('Assumption', assumption, [
        chip('w', explicitWeight === null ? 'default' : formatWeight(explicitWeight)),
        chip('contrary', contrary ? escapeHtml(contrary) : 'none'),
        incomingSources.length > 0 ? chip('attacked by', String(incomingSources.length)) : '',
        outgoingTargets.length > 0 ? chip('attacks', String(outgoingTargets.length)) : ''
    ]);
}

export function buildTopNodeTooltip(factBasedAttacks = []) {
    return panel('⊤', 'holds with no assumption', [
        factBasedAttacks.length > 0
            ? chipList('attacks', factBasedAttacks.map((a) => a.assumption))
            : chip('attacks', 'none')
    ]);
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
    jointWith = []
}) {
    const partners = jointWith.filter((item) => item !== attacker);
    return panel(typeLabel, `${attacker} ⊳ ${target}`, [
        chip('w', formatWeight(weight), { tone: 'weight' }),
        contrary && contrary !== attacker ? chip('via', escapeHtml(contrary)) : '',
        ruleId ? ruleChip(ruleId, derivationBody, contrary) : chipList('rules', derivedBy),
        chipList('needs', partners)
    ]);
}

export function buildJunctionTooltip({ target, contrary, ruleId, derivationBody = [], weight }) {
    return panel('∧ joint attack', target, [
        chip('w', formatWeight(weight), { tone: 'weight' }),
        chip('derives', contrary ? escapeHtml(contrary) : null),
        ruleChip(ruleId, derivationBody, contrary),
        chipList('all of', derivationBody)
    ]);
}

/**
 * A derived (intermediate) claim. Its weight is usually propagated rather than declared, and the
 * rules that derive it are the fact worth showing.
 */
export function buildDerivedNodeTooltip({ atom, explicitWeight = null, derivingRules = [] }) {
    const rules = derivingRules.slice(0, 2)
        .map((rule) => ruleChip(rule.id, rule.body || [], rule.head || atom));
    const extra = derivingRules.length > 2 ? chip('', `+${derivingRules.length - 2} more`) : '';
    return panel('Derived claim', atom, [
        chip('w', explicitWeight === null || explicitWeight === undefined
            ? 'propagated'
            : formatWeight(explicitWeight)),
        ...rules,
        extra
    ]);
}

/** A support step. Takes ATOMS, never internal vis node ids. */
export function buildSupportEdgeTooltip({ fromAtom = null, toAtom, ruleId = null, body = [] }) {
    return panel('Derivation step', toAtom, [
        chip('from', fromAtom === null ? 'all premises' : escapeHtml(fromAtom)),
        ruleChip(ruleId, body, toAtom)
    ]);
}

export function buildDerivationJunctionTooltip({ head, ruleId = null, body = [] }) {
    return panel('∧ all premises', head, [
        ruleChip(ruleId, body, head),
        chipList('needs', body)
    ]);
}

export function buildSetNodeTooltip({ assumptions = [], supported = [], attacks = [] }) {
    return panel('Candidate set', assumptions.length > 0 ? assumptions.join(',') : '∅', [
        chip('accepted', String(assumptions.length)),
        chip('supports', String(supported.length)),
        attacks.length > 0
            ? chipList('attacks', attacks.map((a) => a.assumption))
            : chip('attacks', 'none')
    ]);
}

export function buildSetAttackTooltip({
    sourceSet,
    targetSet,
    targetAssumption,
    attackingElement,
    weight,
    derivedBy = []
}) {
    return panel('Set attack', `${sourceSet || '∅'} ⊳ ${targetSet || '∅'}`, [
        chip('w', formatWeight(weight), { tone: 'weight' }),
        chip('hits', escapeHtml(targetAssumption)),
        chip('via', escapeHtml(attackingElement)),
        chipList('rules', derivedBy)
    ]);
}
