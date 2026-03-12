import test from 'node:test';
import assert from 'node:assert/strict';

import { validateWabaModulesShape } from '../../runtime/module-schema.js';
import { wabaModules } from '../../waba-modules.js';

test('generated waba modules satisfy the expected schema', () => {
    assert.equal(validateWabaModulesShape(wabaModules), true);
});
