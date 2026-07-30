import fs from 'fs';
import path from 'path';

/**
 * Locate the WABA checkout that OWNS this bundle.
 *
 * Three consumers need this (sync-modules, check-sync-schema, the canonical-framework spec)
 * and each had its own guess. The guesses agreed on a bare sibling `../WABA`, which on this
 * layout is a stale pre-modular checkout: it is missing 16 of the bundled modules and carries
 * a different, largely deprecated example set. That is the worst kind of wrong default --
 * present, readable, and silently different -- so the freshness gate took its "not the source
 * tree" exit on every ordinary run and the canonical spec quietly stopped exercising the
 * shipped reference frameworks.
 *
 * The tree that owns the bundle is the one carrying the generator, so identify it by CONTENT.
 *
 * @param {string} from absolute path to start walking up from
 * @returns {{root: string|null, explicit: boolean, candidates: string[]}}
 *   `root` is null when no checkout was found; `explicit` records that WABA_ROOT was set, so
 *   a caller can treat "cannot check" as an error rather than a skip.
 */
export function resolveWabaRoot(from) {
    const GENERATOR = path.join('bin', 'sync-playground.mjs');

    // An explicit WABA_ROOT is AUTHORITATIVE, not a first guess: falling through to discovery
    // when it does not resolve would silently check a different tree than the one the caller
    // named, so a typo would read as success.
    if (process.env.WABA_ROOT) {
        const named = process.env.WABA_ROOT;
        return {
            root: fs.existsSync(path.join(named, GENERATOR)) ? named : null,
            explicit: true,
            candidates: [named]
        };
    }

    // Walk up a bounded number of levels, trying the two names the tree is checked out under.
    const candidates = [];
    let dir = from;
    for (let i = 0; i < 5; i += 1) {
        candidates.push(path.join(dir, 'WABA'));
        candidates.push(path.join(dir, 'GitHub-WABA', 'WABA'));
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }

    const root = candidates.find((c) => fs.existsSync(path.join(c, GENERATOR))) || null;
    return { root, explicit: Boolean(process.env.WABA_ROOT), candidates };
}
