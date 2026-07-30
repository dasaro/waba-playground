import test from 'node:test';
import assert from 'node:assert/strict';

import {
    appendStateChip,
    buildAssumptionNodeTooltip,
    buildAttackEdgeTooltip,
    buildDerivationJunctionTooltip,
    buildDerivedNodeTooltip,
    buildJunctionTooltip,
    buildSetAttackTooltip,
    buildSetNodeTooltip,
    buildSupportEdgeTooltip,
    buildTopNodeTooltip
} from '../../modules/graph-tooltip-builder.js';

// Every panel is a header plus a chip row. These assert the FACTS reach the panel and that it
// stays compact -- the previous panels printed one label per line plus a sentence of prose,
// which is what made them fill the screen.
const chips = (html) => [...html.matchAll(/<span class="gt-chip[^"]*">(.*?)<\/span>/g)]
    .map((m) => m[1].replace(/<\/?i>/g, '|'));
const subject = (html) => {
    const m = html.match(/<span class="gt-subject">(.*?)<\/span>/);
    return m ? m[1] : '';
};

test('assumption panel: weight, contrary and attack counts', () => {
    const html = buildAssumptionNodeTooltip({
        assumption: 'a', explicitWeight: 50, contrary: 'not_a',
        incomingSources: ['b', 'c'], outgoingTargets: ['d']
    });
    assert.equal(subject(html), 'a');
    const c = chips(html).join(' ');
    assert.match(c, /\|w\|50/);
    assert.match(c, /\|contrary\|not_a/);
    assert.match(c, /\|attacked by\|2/);
    assert.match(c, /\|attacks\|1/);
});

test('assumption panel names the default when no weight was declared', () => {
    const html = buildAssumptionNodeTooltip({ assumption: 'a', explicitWeight: null, contrary: 'not_a' });
    assert.match(chips(html).join(' '), /\|w\|default/);
});

test('attack panel: a proper attack sign, the weight and the rule', () => {
    const html = buildAttackEdgeTooltip({
        typeLabel: 'Derived attack', attacker: 'not_c', target: 'c', contrary: 'not_c',
        weight: 40, ruleId: 'r1', derivationBody: ['a', 'b']
    });
    // The old titles used an ASCII "->" in user-visible text.
    assert.equal(subject(html), 'not_c ⊳ c');
    assert.ok(!html.includes('->'));
    const c = chips(html).join(' ');
    assert.match(c, /\|w\|40/);
    assert.match(c, /\|r1\|not_c &larr; a, b/);
});

test('derived-claim panel shows the deriving rules, capped', () => {
    const html = buildDerivedNodeTooltip({
        atom: 'x', explicitWeight: null,
        derivingRules: [
            { id: 'r1', head: 'x', body: ['a'] },
            { id: 'r2', head: 'x', body: ['b'] },
            { id: 'r3', head: 'x', body: ['c'] }
        ]
    });
    const c = chips(html);
    assert.match(c.join(' '), /\|w\|propagated/);
    assert.match(c.join(' '), /\|r1\|x &larr; a/);
    // capped rather than unbounded
    assert.ok(!c.join(' ').includes('r3'));
    assert.match(c.join(' '), /\+1 more/);
});

test('support edge takes atoms, never internal node ids', () => {
    const html = buildSupportEdgeTooltip({ fromAtom: 'obs', toAtom: 'arg_x', ruleId: 'r5', body: ['obs'] });
    assert.equal(subject(html), 'arg_x');
    assert.match(chips(html).join(' '), /\|from\|obs/);
    assert.ok(!html.includes('junction_'));
});

test('junction panels describe derivation and joint attack differently', () => {
    const derivation = buildDerivationJunctionTooltip({ head: 'x', ruleId: 'r6', body: ['a', 'b'] });
    assert.match(derivation, /∧ all premises/);
    assert.match(chips(derivation).join(' '), /\|needs\|a, b/);

    const attack = buildJunctionTooltip({ target: 'c', contrary: 'not_c', ruleId: 'r7', derivationBody: ['a'] });
    assert.match(attack, /∧ joint attack/);
    assert.match(chips(attack).join(' '), /\|derives\|not_c/);
});

test('set panels: counts, and no ASCII arrow', () => {
    const node = buildSetNodeTooltip({
        assumptions: ['a', 'b'], supported: ['a', 'b', 'x'],
        attacks: [{ assumption: 'c', attackingElement: 'x', weight: 40 }]
    });
    assert.equal(subject(node), 'a,b');
    assert.match(chips(node).join(' '), /\|accepted\|2/);
    assert.match(chips(node).join(' '), /\|supports\|3/);

    const edge = buildSetAttackTooltip({
        sourceSet: 'a,b', targetSet: 'c', targetAssumption: 'c',
        attackingElement: 'x', weight: 40, derivedBy: ['r3']
    });
    assert.equal(subject(edge), 'a,b ⊳ c');
    assert.ok(!edge.includes('->'));
    assert.match(chips(edge).join(' '), /\|hits\|c/);
});

test('the empty set and a fact-free top read as such rather than blank', () => {
    assert.equal(subject(buildSetNodeTooltip({ assumptions: [] })), '∅');
    assert.match(chips(buildTopNodeTooltip([])).join(' '), /\|attacks\|none/);
});

test('a state chip can be appended to any panel, and only to a panel', () => {
    const html = buildAssumptionNodeTooltip({ assumption: 'a', explicitWeight: 1, contrary: 'not_a' });
    const withState = appendStateChip(html, 'IN', 'in');
    assert.match(withState, /gt-chip-in">IN<\/span><\/div><\/div>$/);
    // the chip lands INSIDE the chip row, so it wraps with the others
    assert.equal((withState.match(/<\/div><\/div>/g) || []).length, 1);
    // anything that is not one of our panels is returned untouched
    assert.equal(appendStateChip('plain text', 'IN', 'in'), 'plain text');
    assert.equal(appendStateChip(undefined, 'IN', 'in'), undefined);
});

test('values are escaped: a hostile atom name cannot inject markup', () => {
    const payload = '<img src=x onerror=alert(1)>';
    for (const html of [
        buildAssumptionNodeTooltip({ assumption: payload, explicitWeight: 1, contrary: payload }),
        buildAttackEdgeTooltip({ typeLabel: 'Derived attack', attacker: payload, target: payload, contrary: payload, weight: 1 }),
        buildSetAttackTooltip({ sourceSet: payload, targetSet: payload, targetAssumption: payload, attackingElement: payload, weight: 1 })
    ]) {
        assert.ok(!html.includes('<img'), 'raw markup reached the panel');
        assert.ok(html.includes('&lt;img'));
    }
});
