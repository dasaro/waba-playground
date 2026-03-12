#!/usr/bin/env node

import { validateWabaModulesShape } from '../runtime/module-schema.js';

validateWabaModulesShape();
console.log('waba-modules schema check passed.');
