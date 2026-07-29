import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeConfig, validateConfig, resolveBudgetProfile } from '../../runtime/config-service.js';
import { buildProgram, buildSolverArgs } from '../../runtime/program-builder.js';

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
    // beta must be grounded as a CONSTANT (as bin/waba's -c beta=N does), not injected as a
    // budget/1 fact: a fact leaves core/base.lp's `budget(beta)` symbolic, and a symbol
    // outranks every integer, which makes constraint/lb.lp reject every discard.
    assert.match(program, /#const beta = 3\./);
    assert.doesNotMatch(program, /^budget\(3\)\./m);
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
    // grounded routes through the complete semantics, whose completeness constraint is
    // ":- out(X), assumption(X), not attacked_by_undefeated(X)." in the current WABA.
    assert.match(program, /:- out\(X\), assumption\(X\), not attacked_by_undefeated\(X\)\./);
    assert.doesNotMatch(program, /subset_minimal_filter/);
});

test('budgeted-admissible builds the Dunne module on the no-discard profile with beta and --project', () => {
    const config = normalizeConfig({
        semiringFamily: 'godel',
        polarity: 'higher',
        defaultPolicy: 'aba',
        budgetMode: 'none',
        semantics: 'budgeted-admissible',
        optMode: 'ignore',
        beta: 7,
        filterType: 'projection'
    });
    assert.equal(validateConfig(config), null);
    assert.equal(resolveBudgetProfile(config), 'no_discard');
    const program = buildProgram(FRAMEWORK, config);
    assert.match(program, /#const beta = 7\./);
    assert.match(program, /budgeted_full\./);          // the Dunne module marker
    assert.doesNotMatch(program, /active_monoid/);     // no monoid in budgeted-defence
    assert.deepEqual(buildSolverArgs(config), ['--opt-mode=ignore', '--project']);
});

test('budgeted-complete uses the complete_dunne module', () => {
    const config = normalizeConfig({
        semiringFamily: 'godel', polarity: 'higher', defaultPolicy: 'aba',
        budgetMode: 'none', semantics: 'budgeted-complete', optMode: 'ignore', beta: 5, filterType: 'projection'
    });
    const program = buildProgram(FRAMEWORK, config);
    assert.match(program, /:- out\(Y\), assumption\(Y\), not attacked_reduced\(Y\)\./);
});

test('buildProgram does not redefine beta when the framework already fixes it', () => {
    const config = normalizeConfig({
        semiringFamily: 'godel', polarity: 'higher', defaultPolicy: 'legacy',
        monoid: 'sum', optimization: 'minimize', budgetMode: 'ub',
        semantics: 'stable', optMode: 'ignore', beta: 3, filterType: 'projection'
    });
    // clingo rejects a redefined constant outright, so ours must yield to the framework's.
    const program = buildProgram('#const beta = 9.\n' + FRAMEWORK, config);
    assert.doesNotMatch(program, /#const beta = 3\./);
    assert.match(program, /#const beta = 9\./);
    // a commented-out declaration must NOT suppress ours
    const commented = buildProgram('% #const beta = 9.\n' + FRAMEWORK, config);
    assert.match(commented, /#const beta = 3\./);
});

test('budgeted-defence rejects a cost semiring (inverts the inconsistency budget)', () => {
    const config = normalizeConfig({
        semiringFamily: 'tropical', polarity: 'lower', defaultPolicy: 'aba',
        budgetMode: 'none', semantics: 'budgeted-admissible', optMode: 'ignore', beta: 7, filterType: 'projection'
    });
    assert.match(validateConfig(config), /strength semiring/);
});
