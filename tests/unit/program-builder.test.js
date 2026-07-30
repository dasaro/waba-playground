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
    assert.match(program, /%% Budget: beta = 3 /);
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

test('preferred is derived from admissible candidates, not from its own module', () => {
    const config = normalizeConfig({
        semiring: 'godel',
        defaultPolicy: 'legacy',
        budgetMode: 'none',
        semantics: 'preferred',
        optMode: 'ignore',
        filterType: 'projection'
    });
    assert.equal(validateConfig(config), null);
    // preferred has NO module of its own: it is the subset-maximal admissible sets, so
    // buildProgram must emit the ADMISSIBLE module and leave the maximality to the second
    // pass. Emitting `complete` here (the pre-retirement behaviour) would silently compute
    // subset-maximal COMPLETE sets instead.
    const program = buildProgram(FRAMEWORK, config);
    assert.match(program, /budgeted_full\./);
    assert.doesNotMatch(program, /not attacked_reduced\(Y\)/);   // the complete-only constraint
    assert.doesNotMatch(program, /subset_maximal_filter/);       // second pass, not this program
});

test('a retired semantics is rejected rather than silently falling back to stable', () => {
    for (const semantics of ['grounded', 'budgeted-admissible', 'ideal', 'semistable']) {
        const config = normalizeConfig({ semiring: 'godel', semantics, filterType: 'projection' });
        assert.match(validateConfig(config), /Unsupported semantics/, semantics);
    }
});

test('admissible builds the defence module on the no-discard profile with beta and --project', () => {
    const config = normalizeConfig({
        semiring: 'godel',
        defaultPolicy: 'aba',
        budgetMode: 'none',
        semantics: 'admissible',
        optMode: 'ignore',
        beta: 7,
        filterType: 'projection'
    });
    assert.equal(validateConfig(config), null);
    assert.equal(resolveBudgetProfile(config), 'no_discard');
    const program = buildProgram(FRAMEWORK, config);
    assert.match(program, /%% Budget: beta = 7 /);
    assert.match(program, /budgeted_full\./);          // the defence-module marker
    assert.doesNotMatch(program, /active_monoid/);     // defence carries its own SUM budget
    assert.deepEqual(buildSolverArgs(config), ['-c', 'beta=7', '--opt-mode=ignore', '--project']);
});

test('complete adds the completeness constraint on top of admissible', () => {
    const config = normalizeConfig({
        semiring: 'godel', defaultPolicy: 'aba', budgetMode: 'none',
        semantics: 'complete', optMode: 'ignore', beta: 5, filterType: 'projection'
    });
    const program = buildProgram(FRAMEWORK, config);
    assert.match(program, /:- out\(Y\), assumption\(Y\), not attacked_reduced\(Y\)\./);
    assert.match(program, /budgeted_full\./);          // includes admissible
});

test("beta travels as -c, so the caller's value overrides a framework #const", () => {
    const config = normalizeConfig({
        semiring: 'godel', defaultPolicy: 'legacy',
        monoid: 'sum', optimization: 'minimize', budgetMode: 'ub',
        semantics: 'stable', optMode: 'ignore', beta: 3, filterType: 'projection'
    });
    // Emitting `#const beta = 3.` into the text cannot override a framework that declares its
    // own (clingo rejects a redefined constant), so the playground used to yield to the
    // framework while bin/waba's -c overrode it -- the two surfaces then disagreed.
    const program = buildProgram('#const beta = 9.\n' + FRAMEWORK, config);
    // the framework's own declaration is passed through untouched...
    assert.equal((program.match(/#const beta =/g) || []).length, 1);
    // ...and ours is not added to the text at all, but supplied as a solver constant,
    // which clingo lets win over the #const.
    assert.match(program, /%% Budget: beta = 3 /);
    assert.ok(buildSolverArgs(config).join(' ').includes('-c beta=3'));
});

test('a cost semiring is legal for defence: the bound direction follows the polarity', () => {
    // Before the oplus(min) fix this was refused outright. semantics/admissible.lp now
    // derives the bound direction from the polarity, so a cost algebra is sound -- recovery
    // simply arrives at a beta above every attack weight instead of at 0.
    for (const semiring of ['tropical', 'bottleneck_cost']) {
        const config = normalizeConfig({
            semiring, defaultPolicy: 'aba', budgetMode: 'none',
            semantics: 'admissible', optMode: 'ignore', beta: 7, filterType: 'projection'
        });
        assert.equal(validateConfig(config), null, semiring);
        assert.equal(config.polarity, 'lower', semiring);
        const program = buildProgram(FRAMEWORK, config);
        assert.match(program, /oplus\(min\)/, semiring);
    }
});

test('a direct algebra key is never re-resolved through the family map', () => {
    // 'tropical' and 'godel' are BOTH family names and module keys. Resolving a direct key
    // as a family with the default 'higher' polarity would hand back arctic for tropical.
    for (const key of ['godel', 'arctic', 'lukasiewicz', 'tropical', 'bottleneck_cost']) {
        assert.equal(normalizeConfig({ semiring: key }).semiringKey, key, key);
    }
    // the explicit family form still resolves by polarity, for saved/legacy configs
    assert.equal(normalizeConfig({ semiringFamily: 'tropical', polarity: 'higher' }).semiringKey, 'arctic');
    assert.equal(normalizeConfig({ semiringFamily: 'godel', polarity: 'lower' }).semiringKey, 'bottleneck_cost');
});

test('k is passed to the solver only for Lukasiewicz', () => {
    const luk = normalizeConfig({ semiring: 'lukasiewicz', semantics: 'stable', lukK: 1000, beta: 5 });
    assert.ok(buildSolverArgs(luk).join(' ').includes('-c k=1000'));
    const godel = normalizeConfig({ semiring: 'godel', semantics: 'stable', lukK: 1000, beta: 5 });
    assert.ok(!buildSolverArgs(godel).join(' ').includes('k='));
    // beta is always passed, for every algebra
    assert.ok(buildSolverArgs(godel).join(' ').includes('-c beta=5'));
});
