import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeConfig } from '../../runtime/config-service.js';
import { buildProgram } from '../../runtime/program-builder.js';

const FRAMEWORK = 'assumption(a). contrary(a, c_a).';

test('buildProgram includes bounded modules for upper-bound configurations', () => {
    const config = normalizeConfig({
        semiringFamily: 'godel',
        polarity: 'higher',
        monoid: 'sum',
        optimization: 'minimize',
        budgetMode: 'ub',
        budgetIntent: 'bounded',
        semantics: 'stable',
        optMode: 'optN',
        beta: 3
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
        monoid: 'sum',
        optimization: 'minimize',
        budgetMode: 'none',
        budgetIntent: 'no_discard',
        semantics: 'stable',
        optMode: 'ignore',
        beta: 0
    });

    const program = buildProgram(FRAMEWORK, config);
    assert.match(program, /Plain \/ no-discard profile/);
    assert.doesNotMatch(program, /active_monoid\(sum\)/);
});
