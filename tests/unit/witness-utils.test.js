import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildSemanticCandidateFacts, buildSubsetCandidateFacts, dedupeExtensionWitnesses,
    discardKey, extensionKey, stripSemanticReceipts
} from '../../runtime/witness-utils.js';

function witness(...Value) {
    return { Value };
}

test('preferred candidate facts preserve the exact discard reduct and nested terms', () => {
    const facts = buildSubsetCandidateFacts([
        witness('in(a)', 'discarded_attack(ca,a,1)'),
        witness('in(a)', 'in(f(x,y))', 'discarded_attack(c(f(x,y)),a,3)')
    ]);

    assert.match(facts, /candidate\(1\)\./);
    assert.match(facts, /member\(2,f\(x,y\)\)\./);
    assert.match(facts, /discarded_member\(1,ca,a,1\)\./);
    assert.match(facts, /discarded_member\(2,c\(f\(x,y\)\),a,3\)\./);
});

test('range-based candidate facts preserve the exact assumption-level range', () => {
    const original = witness(
        'in(a)', 'out(f(x,y))', 'semantic_range(a)', 'semantic_range(f(x,y))',
        'discarded_attack(c(f(x,y)),a,3)'
    );
    const facts = buildSemanticCandidateFacts([original]);
    assert.match(facts, /member\(1,a\)\./);
    assert.match(facts, /range_member\(1,a\)\./);
    assert.match(facts, /range_member\(1,f\(x,y\)\)\./);
    assert.match(facts, /discarded_member\(1,c\(f\(x,y\)\),a,3\)\./);

    const visible = stripSemanticReceipts(original);
    assert.deepEqual(visible.Value, [
        'in(a)', 'out(f(x,y))', 'discarded_attack(c(f(x,y)),a,3)'
    ]);
});

test('extension identity forgets D while reduct identity retains it', () => {
    const cheap = witness('in(a)', 'out(b)', 'discarded_attack(ca,a,1)', 'budget_value(1)');
    const dear = witness('out(b)', 'in(a)', 'discarded_attack(cb,b,4)', 'budget_value(4)');
    assert.equal(extensionKey(cheap), extensionKey(dear));
    assert.notEqual(discardKey(cheap), discardKey(dear));
});

test('deduplication retains one best representative receipt per beta-sigma extension', () => {
    const cheap = witness('in(a)', 'out(b)', 'discarded_attack(ca,a,1)', 'budget_value(1)');
    const dear = witness('in(a)', 'out(b)', 'discarded_attack(cb,b,4)', 'budget_value(4)');
    const other = witness('out(a)', 'in(b)', 'discarded_attack(cc,a,2)', 'budget_value(2)');

    const upper = dedupeExtensionWitnesses([dear, other, cheap], {
        monoid: 'sum', budgetMode: 'ub'
    });
    assert.equal(upper.length, 2);
    assert.ok(upper.includes(cheap), 'upper-bound representative should be the cheapest D');
    assert.ok(!upper.includes(dear));

    const lower = dedupeExtensionWitnesses([cheap, other, dear], {
        monoid: 'min', budgetMode: 'lb'
    });
    assert.equal(lower.length, 2);
    assert.ok(lower.includes(dear), 'lower-bound representative should have the highest floor');
    assert.ok(!lower.includes(cheap));
});
