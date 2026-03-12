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

test('computeAggregateFromDiscarded handles sum/count/max/min', () => {
    const discarded = [
        'discarded_attack(a,b,3)',
        'discarded_attack(c,d,5)'
    ];

    assert.equal(computeAggregateFromDiscarded(discarded, 'sum'), 8);
    assert.equal(computeAggregateFromDiscarded(discarded, 'count'), 2);
    assert.equal(computeAggregateFromDiscarded(discarded, 'max'), 5);
    assert.equal(computeAggregateFromDiscarded(discarded, 'min'), 3);
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
