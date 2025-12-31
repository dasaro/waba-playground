/**
 * ParserUtils - Shared parsing utilities for WABA/ASP code
 * Consolidates duplicate regex-based parsing logic
 */
export class ParserUtils {
    /**
     * Parse assumption predicates from ASP code
     * @param {string} code - ASP code
     * @returns {Array<string>} - Array of assumption atoms
     */
    static parseAssumptions(code) {
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

        console.log('Expanded code sample:', expandedCode.substring(0, 500));

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
