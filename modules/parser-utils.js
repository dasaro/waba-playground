/**
 * ParserUtils - Shared parsing utilities for WABA/ASP code
 * Consolidates duplicate regex-based parsing logic
 */

/**
 * Escape solver-derived text before it is interpolated into innerHTML.
 *
 * ASP permits quoted-string terms, so an atom name in an uploaded .lp can carry raw
 * markup (e.g. assumption("<img src=x onerror=...>")). Every value that reaches the DOM
 * through a template literal must go through this first. The quote cases are required,
 * not cosmetic: atom text is also interpolated into attribute position.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Remove ASP comments so a commented-out fact is not read as a live one.
 *
 * Every regex-based reader in this file scans the raw framework text, which means a line the
 * user commented out while trying an alternative still contributes rules, weights and
 * assumptions. That is not cosmetic: the no-extensions diagnosis accuses the user of a
 * duplicate `weight/2` or a derivation cycle that exists only in a comment, and clingo -- which
 * does strip them -- reports no such guard violation.
 *
 * Handles `%* ... *%` blocks and `%` line comments, and does not treat a `%` inside a
 * double-quoted ASP term as a comment marker.
 *
 * @param {string} code
 * @returns {string} the same text with comments blanked, line structure preserved
 */
export function stripAspComments(code) {
    let out = '';
    let i = 0;
    let inString = false;
    while (i < code.length) {
        const c = code[i];
        if (inString) {
            out += c;
            if (c === '\\' && i + 1 < code.length) { out += code[i + 1]; i += 2; continue; }
            if (c === '"') inString = false;
            i += 1;
            continue;
        }
        if (c === '"') { inString = true; out += c; i += 1; continue; }
        if (c === '%' && code[i + 1] === '*') {
            const end = code.indexOf('*%', i + 2);
            const block = code.slice(i, end === -1 ? code.length : end + 2);
            // keep the newlines so reported line numbers stay meaningful
            out += block.replace(/[^\n]/g, ' ');
            i = end === -1 ? code.length : end + 2;
            continue;
        }
        if (c === '%') {
            const nl = code.indexOf('\n', i);
            i = nl === -1 ? code.length : nl;
            continue;
        }
        out += c;
        i += 1;
    }
    return out;
}

/**
 * NOTE: every parse* entry point strips comments itself.
 *
 * It used to be the caller's job, and the caller forgot: output-manager stripped, the three
 * graph builders did not. A commented-out `% head(r1, na). body(r1, b).` therefore drew an
 * attack the framework does not license, and a commented-out `% assumption(f).` inflated the
 * count so a 5-assumption framework tripped the 32-set cap with a false "6 assumptions"
 * message. clingo strips comments before it sees any of this, so the picture disagreed with
 * the answer. Stripping here makes that class of mistake unreachable rather than merely fixed
 * at the sites we happened to look at.
 */
export class ParserUtils {
    /**
     * Parse assumption predicates from ASP code
     * @param {string} code - ASP code
     * @returns {Array<string>} - Array of assumption atoms
     */
    static parseAssumptions(code) {
        code = stripAspComments(code || '');
        const assumptions = [];
        const regex = /assumption\(([^)]+)\)\./g;
        let match;
        while ((match = regex.exec(code)) !== null) {
            assumptions.push(match[1].trim());
        }
        return assumptions;
    }

    /**
     * Parse contrary predicates from ASP code
     * @param {string} code - ASP code
     * @returns {Array<{assumption: string, contrary: string}>} - Array of contrary relations
     */
    static parseContraries(code) {
        code = stripAspComments(code || '');
        const contraries = [];
        const regex = /contrary\(([^,]+),\s*([^)]+)\)\./g;
        let match;
        while ((match = regex.exec(code)) !== null) {
            contraries.push({
                assumption: match[1].trim(),
                contrary: match[2].trim()
            });
        }
        return contraries;
    }

    /**
     * Parse rule predicates (head/body) from ASP code
     * Handles compact semicolon form: head(r1, a; r1, b). -> head(r1, a). head(r1, b).
     * @param {string} code - ASP code
     * @returns {Array<{id: string, head: string, body: Array<string>}>} - Array of rules
     */
    static parseRules(code) {
        code = stripAspComments(code || '');
        const rules = [];
        const ruleMap = new Map(); // rule_id -> {head: ..., body: [...]}

        // Expand compact semicolon form first
        // body(r1, b; r1, c). -> body(r1, b). body(r1, c).
        let expandedCode = code.replace(/body\(([^)]+)\)\./g, (match, content) => {
            const parts = content.split(';').map(p => p.trim());
            return parts.map(p => `body(${p}).`).join(' ');
        });

        expandedCode = expandedCode.replace(/head\(([^)]+)\)\./g, (match, content) => {
            const parts = content.split(';').map(p => p.trim());
            return parts.map(p => `head(${p}).`).join(' ');
        });

        // Parse head/2 predicates: head(rule_id, head_atom).
        const headRegex = /head\(([^,]+),\s*([^)]+)\)\./g;
        let match;
        while ((match = headRegex.exec(expandedCode)) !== null) {
            const ruleId = match[1].trim();
            const headAtom = match[2].trim();
            if (!ruleMap.has(ruleId)) {
                ruleMap.set(ruleId, { head: headAtom, body: [] });
            } else {
                ruleMap.get(ruleId).head = headAtom;
            }
        }

        // Parse body/2 predicates: body(rule_id, body_atom).
        const bodyRegex = /body\(([^,]+),\s*([^)]+)\)\./g;
        while ((match = bodyRegex.exec(expandedCode)) !== null) {
            const ruleId = match[1].trim();
            const bodyAtom = match[2].trim();
            if (!ruleMap.has(ruleId)) {
                ruleMap.set(ruleId, { head: null, body: [bodyAtom] });
            } else {
                ruleMap.get(ruleId).body.push(bodyAtom);
            }
        }

        // Convert map to array
        ruleMap.forEach((rule, ruleId) => {
            if (rule.head) {
                rules.push({
                    id: ruleId,
                    head: rule.head,
                    body: rule.body
                });
            }
        });

        return rules;
    }

    /**
     * Parse weight predicates from ASP code
     * @param {string} code - ASP code
     * @returns {Object<string, string>} - Map of atom -> weight
     */
    static parseWeights(code) {
        code = stripAspComments(code || '');
        const weights = {};
        const regex = /weight\(([^,]+),\s*([^)]+)\)\./g;
        let match;
        while ((match = regex.exec(code)) !== null) {
            const atom = match[1].trim();
            const weight = match[2].trim();
            weights[atom] = weight;
        }
        return weights;
    }
}
