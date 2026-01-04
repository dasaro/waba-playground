#!/usr/bin/env node
/**
 * Sync WABA modules from .lp files to waba-modules.js
 *
 * This script reads all WABA .lp files and generates an ES6 module
 * for embedding in the browser-based playground.
 *
 * Usage: node scripts/sync-modules.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WABA_ROOT = path.join(__dirname, '..', '..', 'WABA');
const OUTPUT_FILE = path.join(__dirname, '..', 'waba-modules.js');

// Read a .lp file and return its content with resolved includes
function readModule(filepath, visited = new Set()) {
    try {
        const content = fs.readFileSync(filepath, 'utf8');
        return resolveIncludes(content, path.dirname(filepath), visited);
    } catch (err) {
        console.warn(`⚠️  Warning: Could not read ${filepath}`);
        return `% Module not found: ${path.basename(filepath)}`;
    }
}

// Resolve #include directives recursively
function resolveIncludes(content, basedir, visited = new Set()) {
    // Pattern: #include "filename.lp"
    const includePattern = /#include\s+"([^"]+)"/g;

    return content.replace(includePattern, (match, filename) => {
        const includePath = path.join(basedir, filename);

        // Check for circular includes
        if (visited.has(includePath)) {
            console.warn(`⚠️  Warning: Circular include detected: ${filename}`);
            return `% Circular include: ${filename}`;
        }

        // Mark as visited
        visited.add(includePath);

        try {
            const includeContent = fs.readFileSync(includePath, 'utf8');
            // Recursively resolve includes in the included file
            const resolved = resolveIncludes(includeContent, path.dirname(includePath), visited);
            return `%% INLINED FROM: ${filename}\n${resolved}\n%% END INLINE: ${filename}`;
        } catch (err) {
            console.warn(`⚠️  Warning: Could not read included file ${filename}`);
            return `% Include not found: ${filename}`;
        }
    });
}

// Escape content for JavaScript template literal
function escapeContent(content) {
    return content.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

console.log('🔄 Syncing WABA modules...\n');

// ============================================================================
// CORE MODULE
// ============================================================================
console.log('📦 Core Module...');
const core = {
    base: readModule(path.join(WABA_ROOT, 'core', 'base.lp'))
};

// ============================================================================
// SEMIRING MODULES
// ============================================================================
console.log('📦 Semiring Modules (5)...');
const semiring = {
    godel: readModule(path.join(WABA_ROOT, 'semiring', 'godel.lp')),
    tropical: readModule(path.join(WABA_ROOT, 'semiring', 'tropical.lp')),
    arctic: readModule(path.join(WABA_ROOT, 'semiring', 'arctic.lp')),
    lukasiewicz: readModule(path.join(WABA_ROOT, 'semiring', 'lukasiewicz.lp')),
    bottleneck_cost: readModule(path.join(WABA_ROOT, 'semiring', 'bottleneck_cost.lp'))
};

// ============================================================================
// MONOID MODULES (minimization + maximization)
// ============================================================================
console.log('📦 Monoid Modules (10)...');
const monoid = {
    max_minimization: readModule(path.join(WABA_ROOT, 'monoid', 'max_minimization.lp')),
    max_maximization: readModule(path.join(WABA_ROOT, 'monoid', 'max_maximization.lp')),
    sum_minimization: readModule(path.join(WABA_ROOT, 'monoid', 'sum_minimization.lp')),
    sum_maximization: readModule(path.join(WABA_ROOT, 'monoid', 'sum_maximization.lp')),
    min_minimization: readModule(path.join(WABA_ROOT, 'monoid', 'min_minimization.lp')),
    min_maximization: readModule(path.join(WABA_ROOT, 'monoid', 'min_maximization.lp')),
    count_minimization: readModule(path.join(WABA_ROOT, 'monoid', 'count_minimization.lp')),
    count_maximization: readModule(path.join(WABA_ROOT, 'monoid', 'count_maximization.lp')),
    lex_minimization: readModule(path.join(WABA_ROOT, 'monoid', 'lex_minimization.lp')),
    lex_maximization: readModule(path.join(WABA_ROOT, 'monoid', 'lex_maximization.lp'))
};

// ============================================================================
// SEMANTICS MODULES (core + heuristic + optN)
// ============================================================================
console.log('📦 Semantics Modules (21)...');
const semantics = {
    // Core semantics (9)
    stable: readModule(path.join(WABA_ROOT, 'semantics', 'stable.lp')),
    cf: readModule(path.join(WABA_ROOT, 'semantics', 'cf.lp')),
    admissible: readModule(path.join(WABA_ROOT, 'semantics', 'admissible.lp')),
    complete: readModule(path.join(WABA_ROOT, 'semantics', 'complete.lp')),
    grounded: readModule(path.join(WABA_ROOT, 'semantics', 'grounded.lp')),
    ideal: readModule(path.join(WABA_ROOT, 'semantics', 'ideal.lp')),
    preferred: readModule(path.join(WABA_ROOT, 'semantics', 'preferred.lp')),
    semistable: readModule(path.join(WABA_ROOT, 'semantics', 'semistable.lp')),
    staged: readModule(path.join(WABA_ROOT, 'semantics', 'staged.lp')),

    // Heuristic variants (5)
    'heuristic-naive': readModule(path.join(WABA_ROOT, 'semantics', 'heuristic', 'naive.lp')),
    'heuristic-preferred': readModule(path.join(WABA_ROOT, 'semantics', 'heuristic', 'preferred.lp')),
    'heuristic-semi-stable': readModule(path.join(WABA_ROOT, 'semantics', 'heuristic', 'semi-stable.lp')),
    'heuristic-staged': readModule(path.join(WABA_ROOT, 'semantics', 'heuristic', 'staged.lp')),
    'heuristic-grounded': readModule(path.join(WABA_ROOT, 'semantics', 'heuristic', 'grounded.lp')),

    // OptN variants (6)
    'optN-preferred': readModule(path.join(WABA_ROOT, 'semantics', 'optN', 'preferred.lp')),
    'optN-semi-stable': readModule(path.join(WABA_ROOT, 'semantics', 'optN', 'semi-stable.lp')),
    'optN-staged': readModule(path.join(WABA_ROOT, 'semantics', 'optN', 'staged.lp')),
    'optN-ideal': readModule(path.join(WABA_ROOT, 'semantics', 'optN', 'ideal.lp')),
    'optN-eager': readModule(path.join(WABA_ROOT, 'semantics', 'optN', 'eager.lp')),
    'optN-grounded': readModule(path.join(WABA_ROOT, 'semantics', 'optN', 'grounded.lp'))
};

// ============================================================================
// CONSTRAINT MODULES (monoid-specific upper/lower bounds)
// ============================================================================
console.log('📦 Constraint Modules (10)...');
const constraint = {
    ub_max: readModule(path.join(WABA_ROOT, 'constraint', 'ub_max.lp')),
    ub_sum: readModule(path.join(WABA_ROOT, 'constraint', 'ub_sum.lp')),
    ub_min: readModule(path.join(WABA_ROOT, 'constraint', 'ub_min.lp')),
    ub_count: readModule(path.join(WABA_ROOT, 'constraint', 'ub_count.lp')),
    ub_lex: readModule(path.join(WABA_ROOT, 'constraint', 'ub_lex.lp')),
    lb_max: readModule(path.join(WABA_ROOT, 'constraint', 'lb_max.lp')),
    lb_sum: readModule(path.join(WABA_ROOT, 'constraint', 'lb_sum.lp')),
    lb_min: readModule(path.join(WABA_ROOT, 'constraint', 'lb_min.lp')),
    lb_count: readModule(path.join(WABA_ROOT, 'constraint', 'lb_count.lp')),
    lb_lex: readModule(path.join(WABA_ROOT, 'constraint', 'lb_lex.lp'))
};

// ============================================================================
// FILTER MODULES
// ============================================================================
console.log('📦 Filter Modules (2)...');
const filter = {
    standard: readModule(path.join(WABA_ROOT, 'filter', 'standard.lp')),
    projection: readModule(path.join(WABA_ROOT, 'filter', 'projection.lp'))
};

// ============================================================================
// GENERATE ES6 MODULE
// ============================================================================
console.log('\n📝 Generating waba-modules.js...');

const moduleCode = `// AUTO-GENERATED by scripts/sync-modules.js
// DO NOT EDIT MANUALLY
// Last updated: ${new Date().toISOString()}

export const wabaModules = {
    core: {
        base: \`${escapeContent(core.base)}\`
    },

    semiring: {
        godel: \`${escapeContent(semiring.godel)}\`,
        tropical: \`${escapeContent(semiring.tropical)}\`,
        arctic: \`${escapeContent(semiring.arctic)}\`,
        lukasiewicz: \`${escapeContent(semiring.lukasiewicz)}\`,
        bottleneck_cost: \`${escapeContent(semiring.bottleneck_cost)}\`
    },

    monoid: {
        max_minimization: \`${escapeContent(monoid.max_minimization)}\`,
        max_maximization: \`${escapeContent(monoid.max_maximization)}\`,
        sum_minimization: \`${escapeContent(monoid.sum_minimization)}\`,
        sum_maximization: \`${escapeContent(monoid.sum_maximization)}\`,
        min_minimization: \`${escapeContent(monoid.min_minimization)}\`,
        min_maximization: \`${escapeContent(monoid.min_maximization)}\`,
        count_minimization: \`${escapeContent(monoid.count_minimization)}\`,
        count_maximization: \`${escapeContent(monoid.count_maximization)}\`,
        lex_minimization: \`${escapeContent(monoid.lex_minimization)}\`,
        lex_maximization: \`${escapeContent(monoid.lex_maximization)}\`
    },

    semantics: {
        stable: \`${escapeContent(semantics.stable)}\`,
        cf: \`${escapeContent(semantics.cf)}\`,
        admissible: \`${escapeContent(semantics.admissible)}\`,
        complete: \`${escapeContent(semantics.complete)}\`,
        grounded: \`${escapeContent(semantics.grounded)}\`,
        ideal: \`${escapeContent(semantics.ideal)}\`,
        preferred: \`${escapeContent(semantics.preferred)}\`,
        semistable: \`${escapeContent(semantics.semistable)}\`,
        staged: \`${escapeContent(semantics.staged)}\`,
        'heuristic-naive': \`${escapeContent(semantics['heuristic-naive'])}\`,
        'heuristic-preferred': \`${escapeContent(semantics['heuristic-preferred'])}\`,
        'heuristic-semi-stable': \`${escapeContent(semantics['heuristic-semi-stable'])}\`,
        'heuristic-staged': \`${escapeContent(semantics['heuristic-staged'])}\`,
        'heuristic-grounded': \`${escapeContent(semantics['heuristic-grounded'])}\`,
        'optN-preferred': \`${escapeContent(semantics['optN-preferred'])}\`,
        'optN-semi-stable': \`${escapeContent(semantics['optN-semi-stable'])}\`,
        'optN-staged': \`${escapeContent(semantics['optN-staged'])}\`,
        'optN-ideal': \`${escapeContent(semantics['optN-ideal'])}\`,
        'optN-eager': \`${escapeContent(semantics['optN-eager'])}\`,
        'optN-grounded': \`${escapeContent(semantics['optN-grounded'])}\`
    },

    constraint: {
        ub_max: \`${escapeContent(constraint.ub_max)}\`,
        ub_sum: \`${escapeContent(constraint.ub_sum)}\`,
        ub_min: \`${escapeContent(constraint.ub_min)}\`,
        ub_count: \`${escapeContent(constraint.ub_count)}\`,
        ub_lex: \`${escapeContent(constraint.ub_lex)}\`,
        lb_max: \`${escapeContent(constraint.lb_max)}\`,
        lb_sum: \`${escapeContent(constraint.lb_sum)}\`,
        lb_min: \`${escapeContent(constraint.lb_min)}\`,
        lb_count: \`${escapeContent(constraint.lb_count)}\`,
        lb_lex: \`${escapeContent(constraint.lb_lex)}\`
    },

    filter: {
        standard: \`${escapeContent(filter.standard)}\`,
        projection: \`${escapeContent(filter.projection)}\`
    }
};
`;

// Write the output file
fs.writeFileSync(OUTPUT_FILE, moduleCode, 'utf8');

console.log(`\n✅ Generated ${OUTPUT_FILE}`);
console.log(`\n📊 Module Summary:`);
console.log(`   - Core: 1 module`);
console.log(`   - Semirings: ${Object.keys(semiring).length} modules`);
console.log(`   - Monoids: ${Object.keys(monoid).length} modules`);
console.log(`   - Semantics: ${Object.keys(semantics).length} modules`);
console.log(`   - Constraints: ${Object.keys(constraint).length} modules`);
console.log(`   - Filters: ${Object.keys(filter).length} modules`);
console.log(`   - TOTAL: ${1 + Object.keys(semiring).length + Object.keys(monoid).length + Object.keys(semantics).length + Object.keys(constraint).length + Object.keys(filter).length} modules\n`);
