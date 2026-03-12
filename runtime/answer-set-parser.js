/**
 * @param {string[]} predicates
 * @returns {import('../core/types.js').ParsedExtension}
 */
export function parseAnswerSet(predicates) {
    const parsed = {
        in: [],
        out: [],
        supported: [],
        weights: new Map(),
        discarded: [],
        successful: [],
        assumptions: new Set(),
        contraries: new Map(),
        rules: new Map(),
        derived: [],
        activeContraries: [],
        budgetValue: null,
        budgetValueRaw: null
    };

    predicates.forEach((predicate) => {
        let match = predicate.match(/^assumption\(([^)]+)\)$/);
        if (match) {
            parsed.assumptions.add(match[1]);
            return;
        }

        match = predicate.match(/^contrary\(([^,]+),\s*([^)]+)\)$/);
        if (match) {
            parsed.contraries.set(match[1], match[2]);
            return;
        }

        match = predicate.match(/^head\(([^,]+),\s*([^)]+)\)$/);
        if (match) {
            const ruleId = match[1];
            const head = match[2];
            if (!parsed.rules.has(ruleId)) {
                parsed.rules.set(ruleId, { head, body: [] });
            } else {
                parsed.rules.get(ruleId).head = head;
            }
            return;
        }

        match = predicate.match(/^body\(([^,]+),\s*([^)]+)\)$/);
        if (match) {
            const ruleId = match[1];
            const bodyAtom = match[2];
            if (!parsed.rules.has(ruleId)) {
                parsed.rules.set(ruleId, { head: null, body: [bodyAtom] });
            } else {
                parsed.rules.get(ruleId).body.push(bodyAtom);
            }
            return;
        }

        match = predicate.match(/^in\(([^)]+)\)$/);
        if (match) {
            parsed.in.push(match[1]);
            return;
        }

        match = predicate.match(/^out\(([^)]+)\)$/);
        if (match) {
            parsed.out.push(match[1]);
            return;
        }

        match = predicate.match(/^supported_with_weight\(([^,]+),\s*(.+)\)$/);
        if (match) {
            const atom = match[1];
            const weight = match[2];
            parsed.supported.push(atom);
            parsed.weights.set(atom, weight);
            return;
        }

        if (predicate.startsWith('discarded_attack(')) {
            parsed.discarded.push(predicate);
            return;
        }

        if (predicate.startsWith('attacks_successfully_with_weight(')) {
            parsed.successful.push(predicate);
            return;
        }

        match = predicate.match(/^budget_value\((.+)\)$/);
        if (match) {
            parsed.budgetValue = match[1];
            parsed.budgetValueRaw = match[1];
        }
    });

    parsed.in.sort();
    parsed.out.sort();
    parsed.supported.sort();
    parsed.discarded.sort();
    parsed.successful.sort();
    parsed.derived = parsed.supported.filter((atom) => !parsed.assumptions.has(atom));
    parsed.contraries.forEach((contrary, assumption) => {
        if (parsed.supported.includes(contrary)) {
            parsed.activeContraries.push({ assumption, contrary });
        }
    });
    return parsed;
}
