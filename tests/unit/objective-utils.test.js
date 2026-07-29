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

test('computeAggregateFromDiscarded matches clingo on infinite weights', () => {
    // clingo: #sum DROPS #sup/#inf tuples (empty sum = 0); #max/#min KEEP them.
    // Verified against monoid/{sum,max,min}.lp: sum=5, max=#sup, min=#inf.
    const mixed = [
        'discarded_attack(x,a,#sup)',
        'discarded_attack(y,b,5)',
        'discarded_attack(z,c,#inf)'
    ];
    assert.equal(computeAggregateFromDiscarded(mixed, 'sum'), 5);
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
