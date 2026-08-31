import test from 'node:test';
import assert from 'node:assert/strict';

import { examples } from '../../examples.js';
import { validateFrameworkSource } from '../../runtime/framework-source-validator.js';
import { normalizeConfig, validateConfig } from '../../runtime/config-service.js';

// Class guard: a curated example that its own source boundary rejects is dead on
// arrival in the UI, however well its numbers were verified. Five examples shipped a
// relic `budget(beta).` line for a while, and only clicking them would have shown it.
test('every inline example passes the source boundary and its preset validates', () => {
    for (const [key, example] of Object.entries(examples)) {
        if (example.source !== 'inline' || !example.code) continue;
        assert.equal(validateFrameworkSource(example.code), null,
            `${key}: boundary rejected its own curated code`);
        if (example.preset) {
            const err = validateConfig(normalizeConfig({ ...example.preset, numModels: 0 }));
            assert.equal(err, null, `${key}: preset rejected by validateConfig`);
        }
    }
});
