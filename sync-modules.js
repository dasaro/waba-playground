#!/usr/bin/env node
/**
 * Sync WABA modules from .lp files to app.js
 *
 * This script reads the WABA .lp files and generates JavaScript code
 * for embedding in the browser-based playground.
 *
 * Usage: node sync-modules.js
 */

const fs = require('fs');
const path = require('path');

const WABA_ROOT = path.join(__dirname, '..', 'WABA');
const APP_JS = path.join(__dirname, 'app.js');

// Read a .lp file and return its content
function readModule(filepath) {
    return fs.readFileSync(filepath, 'utf8');
}

// Generate JavaScript code for a module
function jsModule(name, content) {
    // Escape backticks in content
    const escaped = content.replace(/`/g, '\\`').replace(/\$/g, '\\$');
    return `            ${name}: \`\n${escaped}\`,`;
}

console.log('🔄 Syncing WABA modules to app.js...\n');

// ============================================================================
// CORE BASE MODULE
// ============================================================================
console.log('📦 Core Base Module...');
const coreBase = readModule(path.join(WABA_ROOT, 'core', 'base.lp'));
const coreJsCode = `    getCoreModule() {
        return \`
${coreBase.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
    }`;

// ============================================================================
// SEMIRING MODULES
// ============================================================================
console.log('📦 Semiring Modules...');
const semirings = {
    godel: readModule(path.join(WABA_ROOT, 'semiring', 'godel.lp')),
    tropical: readModule(path.join(WABA_ROOT, 'semiring', 'tropical.lp')),
    arctic: readModule(path.join(WABA_ROOT, 'semiring', 'arctic.lp')),
    lukasiewicz: readModule(path.join(WABA_ROOT, 'semiring', 'lukasiewicz.lp')),
    bottleneck_cost: readModule(path.join(WABA_ROOT, 'semiring', 'bottleneck_cost.lp'))
};

const semiringJsCode = `    getSemiringModule(semiring) {
        const modules = {
${Object.entries(semirings).map(([name, content]) => jsModule(name, content)).join('\n')}
        };
        return modules[semiring] || modules.godel;
    }`;

// ============================================================================
// MONOID MODULES
// ============================================================================
console.log('📦 Monoid Modules...');
const monoids = {
    max: readModule(path.join(WABA_ROOT, 'monoid', 'max.lp')),
    sum: readModule(path.join(WABA_ROOT, 'monoid', 'sum.lp')),
    min: readModule(path.join(WABA_ROOT, 'monoid', 'min.lp')),
    count: readModule(path.join(WABA_ROOT, 'monoid', 'count.lp'))
};

const monoidJsCode = `    getMonoidModule(monoid) {
        const modules = {
${Object.entries(monoids).map(([name, content]) => jsModule(name, content)).join('\n')}
        };
        return modules[monoid] || modules.max;
    }`;

// ============================================================================
// SEMANTICS MODULES
// ============================================================================
console.log('📦 Semantics Modules...');
const semantics = {
    stable: readModule(path.join(WABA_ROOT, 'semantics', 'stable.lp')),
    cf: readModule(path.join(WABA_ROOT, 'semantics', 'cf.lp'))
};

const semanticsJsCode = `    getSemanticsModule(semantics) {
        const modules = {
${Object.entries(semantics).map(([name, content]) => jsModule(name, content)).join('\n')}
        };
        return modules[semantics] || modules.stable;
    }`;

// ============================================================================
// OPTIMIZATION MODULES
// ============================================================================
console.log('📦 Optimization Modules...');
const optimize = {
    none: '% No optimization',
    minimize: readModule(path.join(WABA_ROOT, 'optimize', 'minimize.lp')),
    maximize: readModule(path.join(WABA_ROOT, 'optimize', 'maximize.lp'))
};

const optimizeJsCode = `    getOptimizeModule(optimize) {
        const modules = {
${Object.entries(optimize).map(([name, content]) => jsModule(name, content)).join('\n')}
        };
        return modules[optimize] || modules.none;
    }`;

// ============================================================================
// CONSTRAINT MODULES
// ============================================================================
console.log('📦 Constraint Modules...');
const ubConstraint = readModule(path.join(WABA_ROOT, 'constraint', 'ub.lp'));
const lbConstraint = readModule(path.join(WABA_ROOT, 'constraint', 'lb.lp'));
const flatConstraint = readModule(path.join(WABA_ROOT, 'constraint', 'flat.lp'));

const constraintJsCode = `    getConstraintModule(constraint, budget) {
        const modules = {
            ub: \`
${ubConstraint.replace(/`/g, '\\`').replace(/\$/g, '\\$').replace(/#const beta = #sup\./g, '').replace(/budget\(beta\)\./g, 'budget(' + '\${budget}' + ').')}\`,
            lb: \`
${lbConstraint.replace(/`/g, '\\`').replace(/\$/g, '\\$').replace(/#const beta = #inf\./g, '').replace(/budget\(beta\)\./g, 'budget(' + '\${budget}' + ').')}\`,
            none: \`
% No budget constraint
\`
        };
        return modules[constraint] || modules.ub;
    }`;

const flatJsCode = `    getFlatModule() {
        return \`
${flatConstraint.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
    }`;

// ============================================================================
// GENERATE OUTPUT
// ============================================================================
console.log('\n📝 Generated JavaScript code:');
console.log('─'.repeat(80));
console.log('\n// Copy these functions into app.js:\n');
console.log(coreJsCode);
console.log('\n');
console.log(semiringJsCode);
console.log('\n');
console.log(monoidJsCode);
console.log('\n');
console.log(semanticsJsCode);
console.log('\n');
console.log(optimizeJsCode);
console.log('\n');
console.log(constraintJsCode);
console.log('\n');
console.log(flatJsCode);
console.log('\n');
console.log('─'.repeat(80));
console.log('\n✅ Done! Copy the generated code above into app.js');
console.log('   Replace the corresponding get*Module() functions.\n');
