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
    // pass. The second pass compares candidates only inside the same discard witness D.
    const program = buildProgram(FRAMEWORK, config);
    assert.match(program, /BETA-SIGMA ADMISSIBLE SEMANTICS/);
    assert.doesNotMatch(program, /BETA-SIGMA COMPLETE SEMANTICS/);
    assert.doesNotMatch(program, /subset_maximal_filter/);       // second pass, not this program
});

test('unknown or deliberately excluded semantics are rejected rather than falling back', () => {
    for (const semantics of ['budgeted-admissible', 'semistable', 'cf2', 'stage2']) {
        const config = normalizeConfig({ semiring: 'godel', semantics, filterType: 'projection' });
        assert.match(validateConfig(config), /Unsupported semantics/, semantics);
    }
});

test('all semantics use the same bounded beta-sigma profile', () => {
    for (const semantics of [
        'cf', 'stable', 'admissible', 'complete', 'preferred',
        'grounded', 'naive', 'semi-stable', 'stage', 'ideal', 'eager'
    ]) {
        const config = normalizeConfig({
            semiring: 'godel', defaultPolicy: 'aba', monoid: 'sum', budgetMode: 'ub',
            semantics, optMode: 'ignore', beta: 7, filterType: 'projection'
        });
        assert.equal(validateConfig(config), null, semantics);
        assert.equal(resolveBudgetProfile(config), 'bounded', semantics);
        const program = buildProgram(FRAMEWORK, config);
        assert.match(program, /%% Budget: beta = 7 /, semantics);
        assert.match(program, /active_monoid\(sum\)/, semantics);
        assert.match(program, /discarded_attack/, semantics);
        assert.doesNotMatch(program, /\bpay\(/, semantics);
        assert.deepEqual(buildSolverArgs(config), ['-c', 'beta=7', '--opt-mode=ignore'], semantics);
    }
});

test('complete adds the completeness constraint on top of admissible', () => {
    const config = normalizeConfig({
        semiring: 'godel', defaultPolicy: 'aba', budgetMode: 'none',
        semantics: 'complete', optMode: 'ignore', beta: 5, filterType: 'projection'
    });
    const program = buildProgram(FRAMEWORK, config);
    assert.match(program, /BETA-SIGMA COMPLETE SEMANTICS/);
    assert.match(program, /BETA-SIGMA ADMISSIBLE SEMANTICS/);    // included dependency
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

test('cost semirings use the selected external min/lower-bound profile for every semantics', () => {
    for (const semiring of ['tropical', 'bottleneck_cost']) {
        for (const semantics of [
            'cf', 'stable', 'admissible', 'complete', 'preferred',
            'grounded', 'naive', 'semi-stable', 'stage', 'ideal', 'eager'
        ]) {
            const config = normalizeConfig({
                semiring, defaultPolicy: 'aba', monoid: 'min', budgetMode: 'lb',
                semantics, optMode: 'ignore', beta: 7, filterType: 'projection'
            });
            assert.equal(validateConfig(config), null, `${semiring}/${semantics}`);
            assert.equal(config.polarity, 'lower', semiring);
            const program = buildProgram(FRAMEWORK, config);
            assert.match(program, /active_monoid\(min\)/, `${semiring}/${semantics}`);
            assert.match(program, /C < B/, `${semiring}/${semantics}`);
            assert.doesNotMatch(program, /\bpay\(/, `${semiring}/${semantics}`);
        }
    }
});

test('ABA recovery forbids the common discard set for every semantics without a threshold hack', () => {
    for (const semantics of [
        'cf', 'stable', 'admissible', 'complete', 'preferred',
        'grounded', 'naive', 'semi-stable', 'stage', 'ideal', 'eager'
    ]) {
        const config = normalizeConfig({
            semiring: 'tropical', defaultPolicy: 'aba', budgetMode: 'none',
            semantics, abaRecovery: true, beta: 99, filterType: 'projection'
        });
        assert.equal(config.beta, 0, semantics);
        const program = buildProgram(FRAMEWORK, config);
        assert.match(program, /:- discarded_attack\(_,_,_\)\./, semantics);
        assert.doesNotMatch(program, /1073741824/, semantics);
        assert.doesNotMatch(program, /\bpay\(/, semantics);
    }
});

test('derived semantics select the declared candidate kernel and range projection', () => {
    const candidates = {
        preferred: 'BETA-SIGMA ADMISSIBLE SEMANTICS',
        grounded: 'BETA-SIGMA COMPLETE SEMANTICS',
        naive: 'Ordinary ABA conflict-free semantics',
        'semi-stable': 'BETA-SIGMA COMPLETE SEMANTICS',
        stage: 'Ordinary ABA conflict-free semantics',
        ideal: 'BETA-SIGMA ADMISSIBLE SEMANTICS',
        eager: 'BETA-SIGMA COMPLETE SEMANTICS'
    };
    for (const [semantics, marker] of Object.entries(candidates)) {
        const config = normalizeConfig({
            semiring: 'godel', semantics, budgetMode: 'none', filterType: 'projection'
        });
        assert.equal(validateConfig(config), null, semantics);
        const program = buildProgram(FRAMEWORK, config, { auxiliaryFor: semantics });
        assert.match(program, new RegExp(marker), semantics);
        if (semantics === 'semi-stable' || semantics === 'stage' || semantics === 'eager') {
            assert.match(program, /semantic_range\(X\)/, semantics);
        } else {
            assert.doesNotMatch(program, /semantic_range\(X\)/, semantics);
        }
    }
});

test('solver arguments retain D for direct optimisation and preferred candidate enumeration', () => {
    const direct = normalizeConfig({
        semiring: 'godel', monoid: 'sum', budgetMode: 'ub', semantics: 'stable',
        optMode: 'optN', optimization: 'minimize', beta: 7
    });
    const candidate = normalizeConfig({ ...direct, semantics: 'admissible', optMode: 'ignore' });
    assert.deepEqual(buildSolverArgs(direct), ['-c', 'beta=7', '--opt-mode=optN', '--quiet=1']);
    assert.deepEqual(buildSolverArgs(candidate), ['-c', 'beta=7', '--opt-mode=ignore']);
    assert.ok(!buildSolverArgs(direct).includes('--project'));
    assert.ok(!buildSolverArgs(candidate).includes('--project'));
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
    // With no explicit polarity, legacy family configs use the same canonical defaults as
    // bin/waba: strength Gödel and cost Tropical.
    assert.equal(normalizeConfig({ semiringFamily: 'godel' }).semiringKey, 'godel');
    assert.equal(normalizeConfig({ semiringFamily: 'tropical' }).semiringKey, 'tropical');
});

test('k is passed to the solver only for Lukasiewicz', () => {
    const luk = normalizeConfig({ semiring: 'lukasiewicz', semantics: 'stable', lukK: 1000, beta: 5 });
    assert.ok(buildSolverArgs(luk).join(' ').includes('-c k=1000'));
    const godel = normalizeConfig({ semiring: 'godel', semantics: 'stable', lukK: 1000, beta: 5 });
    assert.ok(!buildSolverArgs(godel).join(' ').includes('k='));
    // beta is always passed, for every algebra
    assert.ok(buildSolverArgs(godel).join(' ').includes('-c beta=5'));
});

test('configuration validation rejects silent mode fallbacks and non-integral constants', () => {
    const valid = normalizeConfig({
        semiring: 'godel', monoid: 'sum', budgetMode: 'ub', semantics: 'stable',
        optMode: 'ignore', beta: 3
    });
    assert.equal(validateConfig(valid), null);
    assert.match(validateConfig({ ...valid, budgetMode: 'mystery' }), /Unknown budget mode/);
    assert.match(validateConfig({ ...valid, optMode: 'garbage' }), /Unknown solver result mode/);
    assert.match(validateConfig({ ...valid, beta: 3.5 }), /must be an integer/);

    const luk = normalizeConfig({ semiring: 'lukasiewicz', semantics: 'stable' });
    assert.equal(luk.lukK, 1000);
    assert.equal(validateConfig(luk), null);
    assert.match(validateConfig({ ...luk, lukK: 0 }), /positive integer/);
    assert.match(validateConfig({ ...luk, lukK: 2.5 }), /positive integer/);
    assert.equal(normalizeConfig({ semiring: 'lukasiewicz', lukK: '2.5' }).lukK, 2.5);
});
