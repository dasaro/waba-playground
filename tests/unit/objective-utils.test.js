import test from 'node:test';
import assert from 'node:assert/strict';

import {
    NEG_INF,
    POS_INF,
    compareTuples,
    computeAggregateFromDiscarded,
    displayValue,
    getObjectiveTuple
} from '../../runtime/objective-utils.js';

test('computeAggregateFromDiscarded handles sum/max/min', () => {
    const discarded = [
        'discarded_attack(a,b,3)',
        'discarded_attack(c,d,5)'
    ];

    assert.equal(computeAggregateFromDiscarded(discarded, 'sum'), 8);
    assert.equal(computeAggregateFromDiscarded(discarded, 'max'), 5);
    assert.equal(computeAggregateFromDiscarded(discarded, 'min'), 3);
});

test('computeAggregateFromDiscarded handles structured and quoted attack terms', () => {
    const discarded = [
        'discarded_attack(c(f(x,y)),target(g(a,b)),3)',
        'discarded_attack("attacker,one)","target,two)",5)'
    ];
    assert.equal(computeAggregateFromDiscarded(discarded, 'sum'), 8);
    assert.equal(computeAggregateFromDiscarded(discarded, 'max'), 5);
});

test('computeAggregateFromDiscarded matches clingo on infinite weights', () => {
    // monoid/sum.lp defines the LIFTED sum: a #inf tuple is absorbing (budget_value(#inf));
    // #sup tuples are still dropped by #sum. #max/#min KEEP both extrema.
    // Verified against monoid/{sum,max,min}.lp: sum=#inf, max=#sup, min=#inf.
    const mixed = [
        'discarded_attack(x,a,#sup)',
        'discarded_attack(y,b,5)',
        'discarded_attack(z,c,#inf)'
    ];
    assert.equal(computeAggregateFromDiscarded(mixed, 'sum'), NEG_INF);
    assert.equal(computeAggregateFromDiscarded(mixed, 'max'), POS_INF);
    assert.equal(computeAggregateFromDiscarded(mixed, 'min'), NEG_INF);
    assert.equal(computeAggregateFromDiscarded([], 'sum'), 0);
});

test('objective tuples preserve sentinel semantics', () => {
    assert.deepEqual(getObjectiveTuple({ monoid: 'max', optimization: 'minimize' }, NEG_INF), [0, 0, 0]);
    assert.deepEqual(getObjectiveTuple({ monoid: 'max', optimization: 'minimize' }, POS_INF), [1, 0, 0]);
    assert.deepEqual(getObjectiveTuple({ monoid: 'min', optimization: 'maximize' }, POS_INF), [0, -1, 0]);
});

test('tuple comparison is lexicographic and displayValue preserves infinities', () => {
    assert.equal(compareTuples([0, 0, 1], [0, 0, 2]), -1);
    assert.equal(compareTuples([1, 0, 0], [0, 0, 0]), 1);
    assert.equal(displayValue(POS_INF), '+inf');
    assert.equal(displayValue(NEG_INF), '-inf');
});

test('sum aggregate mirrors the lifted monoid: #inf absorbs, #sup is still dropped', () => {
    // monoid/sum.lp: sum_has_infimum :- discarded_attack(_,_,#inf). budget_value(#inf) :- ...
    const withInf = ['discarded_attack(a,b,3)', 'discarded_attack(c,d,#inf)'];
    assert.equal(computeAggregateFromDiscarded(withInf, 'sum'), NEG_INF);
    const withSup = ['discarded_attack(a,b,3)', 'discarded_attack(c,d,#sup)'];
    assert.equal(computeAggregateFromDiscarded(withSup, 'sum'), 3);
});

test('sum objective tuples rank #inf/#sup on sentinel levels like optimize/*.lp', () => {
    const min = (v) => getObjectiveTuple({ monoid: 'sum', optimization: 'minimize' }, v);
    const max = (v) => getObjectiveTuple({ monoid: 'sum', optimization: 'maximize' }, v);
    // minimize: #inf best, then finite by value, #sup worst
    assert.ok(compareTuples(min(NEG_INF), min(0)) < 0);
    assert.ok(compareTuples(min(3), min(7)) < 0);
    assert.ok(compareTuples(min(7), min(POS_INF)) < 0);
    // maximize: #sup best, then finite descending, #inf worst
    assert.ok(compareTuples(max(POS_INF), max(7)) < 0);
    assert.ok(compareTuples(max(7), max(3)) < 0);
    assert.ok(compareTuples(max(3), max(NEG_INF)) < 0);
});
