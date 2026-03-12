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
