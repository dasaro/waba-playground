import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeConfig } from '../../runtime/config-service.js';
import { buildProgram } from '../../runtime/program-builder.js';

const FRAMEWORK = 'assumption(a). contrary(a, c_a).';

test('buildProgram includes bounded modules for upper-bound configurations', () => {
    const config = normalizeConfig({
        semiringFamily: 'godel',
        polarity: 'higher',
        defaultPolicy: 'legacy',
        monoid: 'sum',
        optimization: 'minimize',
        budgetMode: 'ub',
        semantics: 'stable',
        optMode: 'optN',
        beta: 3,
        filterType: 'projection'
    });

    const program = buildProgram(FRAMEWORK, config);
    assert.match(program, /budget\(3\)\./);
    assert.match(program, /active_monoid\(sum\)/);
    assert.match(program, /#show budget_value\/1\./);
});

test('buildProgram uses no-discard profile when budget mode is none and intent is plain', () => {
    const config = normalizeConfig({
        semiringFamily: 'godel',
        polarity: 'higher',
        defaultPolicy: 'legacy',
        monoid: 'sum',
        optimization: 'minimize',
        budgetMode: 'none',
        semantics: 'stable',
        optMode: 'ignore',
        beta: 0,
        filterType: 'projection'
    });

    const program = buildProgram(FRAMEWORK, config);
    assert.match(program, /Plain \/ no-discard profile/);
    assert.doesNotMatch(program, /active_monoid\(sum\)/);
});

test('buildProgram routes grounded through complete candidates in the browser surface', () => {
    const config = normalizeConfig({
        semiringFamily: 'godel',
        polarity: 'higher',
        defaultPolicy: 'legacy',
        budgetMode: 'none',
        semantics: 'grounded',
        optMode: 'ignore',
        filterType: 'projection'
    });

    const program = buildProgram(FRAMEWORK, config);
    assert.match(program, /:- out\(X\), assumption\(X\), defended\(X\)\./);
    assert.doesNotMatch(program, /subset_minimal_filter/);
});
