import test from 'node:test';
import assert from 'node:assert/strict';

import { buildClingoFromSimpleFields, extractSimpleFields } from '../../features/editor/simple-format.js';

test('simple format round-trip preserves main sections', () => {
    const fields = {
        description: 'Scientific discovery example',
        assumptions: 'a\nb',
        rules: 'c_a <- b',
        contraries: '(a, c_a)',
        weights: 'a: 80\nc_a: 70'
    };

    const clingoCode = buildClingoFromSimpleFields(fields);
    const roundTripped = extractSimpleFields(clingoCode);

    assert.match(clingoCode, /assumption\(a\)\./);
    assert.match(clingoCode, /weight\(a, 80\)\./);
    assert.equal(roundTripped.description, fields.description);
    assert.match(roundTripped.assumptions, /a/);
    assert.match(roundTripped.rules, /c_a <- b/);
    assert.match(roundTripped.contraries, /\(a, c_a\)/);
    assert.match(roundTripped.weights, /a: 80/);
});

test('simple format round-trip preserves multi-body rules (compact pool form)', () => {
    // Regression: extractSimpleFields used to swallow the whole compact pool
    // body(r1, a; r1, b; r1, c) as one atom, corrupting any rule with 2+ premises.
    const fields = {
        description: '',
        assumptions: 'a\nb\nc\nd',
        rules: 'd <- a, b, c',
        contraries: '(a, d)',
        weights: ''
    };

    const ruleLineOf = (fieldsObj) =>
        fieldsObj.rules.split('\n').filter((line) => !line.trim().startsWith('%')).join('\n');

    const clingoCode = buildClingoFromSimpleFields(fields);
    const roundTripped = extractSimpleFields(clingoCode);

    assert.match(clingoCode, /body\(r1, a; r1, b; r1, c\)\./);
    assert.equal(ruleLineOf(roundTripped), 'd <- a, b, c');
    assert.doesNotMatch(roundTripped.rules, /;/);          // no compact-pool leakage
    assert.doesNotMatch(ruleLineOf(roundTripped), /r1/);   // no spurious rule-id atoms

    // The corrected rule must survive a second build->extract cycle unchanged
    // (the old bug cascaded into spurious body(r1, r1) atoms here).
    const secondPass = extractSimpleFields(buildClingoFromSimpleFields(roundTripped));
    assert.equal(ruleLineOf(secondPass), 'd <- a, b, c');
});
