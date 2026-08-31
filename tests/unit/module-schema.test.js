import test from 'node:test';
import assert from 'node:assert/strict';

import { validateWabaModulesShape } from '../../runtime/module-schema.js';
import { wabaModules } from '../../waba-modules.js';

test('generated waba modules satisfy the expected schema', () => {
    assert.equal(validateWabaModulesShape(wabaModules), true);
});

test('schema validation covers the validator and generated examples', () => {
    assert.throws(
        () => validateWabaModulesShape({ ...wabaModules, validate: undefined }),
        /missing required section "validate"/
    );
    assert.throws(
        () => validateWabaModulesShape({ ...wabaModules, examples: {} }),
        /must contain the generated example surface/
    );
});

test('schema validation pins every derived semantics to its candidate and exact filter', () => {
    const broken = {
        ...wabaModules,
        metadata: {
            ...wabaModules.metadata,
            semanticFilters: { ...wabaModules.metadata.semanticFilters, grounded: 'missing' }
        }
    };
    assert.throws(
        () => validateWabaModulesShape(broken),
        /grounded.*no bundled exact filter/
    );
});
