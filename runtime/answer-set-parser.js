/**
 * Split a comma-separated argument list on top-level commas only, respecting
 * parenthesis nesting so that nested-term commas (e.g. `p(x,y)`) are not split.
 * @param {string} str the inner contents of a term (without the outer parens)
 * @returns {string[]} trimmed top-level segments
 */
/**
 * Match `name(args)` and return the argument list, respecting nesting.
 *
 * The regexes this replaces were anchored with `[^)]+`, which stops at the FIRST `)`. A
 * function term such as `in(flies(tweety))` therefore matched nothing at all -- and function
 * terms are legal ASP that core/base.lp handles and bin/waba gets right. The consequences were
 * not cosmetic: `parsed.in` came back empty for every extension, so every result card rendered
 * with no assumption chips, clicking one highlighted nothing, and in clingo-manager the
 * subset-maximal filter for `preferred` emitted no member/2 facts, so nothing was ever
 * dominated and `preferred` silently returned the admissible sets.
 *
 * @param {string} predicate e.g. 'in(flies(tweety))'
 * @param {string} name the functor to match
 * @returns {string|null} the raw argument string, or null if it is not that predicate
 */
export function matchPredicate(predicate, name) {
    const head = `${name}(`;
    const text = predicate.trim();
    if (!text.startsWith(head) || !text.endsWith(')')) {
        return null;
    }
    const inner = text.slice(head.length, -1);
    // Reject `in(a), foo(b)` and similar: the parens we stripped must be the matching pair.
    let depth = 0;
    let quoted = false;
    let escaped = false;
    for (const ch of inner) {
        if (quoted) {
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === '"') quoted = false;
            continue;
        }
        if (ch === '"') quoted = true;
        else if (ch === '(') depth += 1;
        else if (ch === ')') { depth -= 1; if (depth < 0) return null; }
    }
    return depth === 0 && !quoted ? inner : null;
}

export function splitTopLevelArgs(str) {
    const segments = [];
    let depth = 0;
    let current = '';
    let quoted = false;
    let escaped = false;
    for (let i = 0; i < str.length; i += 1) {
        const ch = str[i];
        if (quoted) {
            current += ch;
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === '"') quoted = false;
        } else if (ch === '"') {
            quoted = true;
            current += ch;
        } else if (ch === '(') {
            depth += 1;
            current += ch;
        } else if (ch === ')') {
            depth -= 1;
            current += ch;
        } else if (ch === ',' && depth === 0) {
            segments.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }
    segments.push(current.trim());
    return segments;
}

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
        const assumptionArg = matchPredicate(predicate, 'assumption');
        if (assumptionArg !== null) {
            const match = [null, assumptionArg];
            parsed.assumptions.add(match[1]);
            return;
        }

        const contraryArgs = matchPredicate(predicate, 'contrary');
        if (contraryArgs !== null) {
            const match = [null, ...splitTopLevelArgs(contraryArgs)];
            parsed.contraries.set(match[1], match[2]);
            return;
        }

        const headArgs = matchPredicate(predicate, 'head');
        if (headArgs !== null) {
            const match = [null, ...splitTopLevelArgs(headArgs)];
            const ruleId = match[1];
            const head = match[2];
            if (!parsed.rules.has(ruleId)) {
                parsed.rules.set(ruleId, { head, body: [] });
            } else {
                parsed.rules.get(ruleId).head = head;
            }
            return;
        }

        const bodyArgs = matchPredicate(predicate, 'body');
        if (bodyArgs !== null) {
            const match = [null, ...splitTopLevelArgs(bodyArgs)];
            const ruleId = match[1];
            const bodyAtom = match[2];
            if (!parsed.rules.has(ruleId)) {
                parsed.rules.set(ruleId, { head: null, body: [bodyAtom] });
            } else {
                parsed.rules.get(ruleId).body.push(bodyAtom);
            }
            return;
        }

        const inArg = matchPredicate(predicate, 'in');
        if (inArg !== null) {
            parsed.in.push(inArg);
            return;
        }

        const outArg = matchPredicate(predicate, 'out');
        if (outArg !== null) {
            parsed.out.push(outArg);
            return;
        }

        const supported_with_weightArgs = matchPredicate(predicate, 'supported_with_weight');
        if (supported_with_weightArgs !== null) {
            const match = [null, ...splitTopLevelArgs(supported_with_weightArgs)];
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

        const budgetArg = matchPredicate(predicate, 'budget_value');
        if (budgetArg !== null) {
            parsed.budgetValue = budgetArg;
            parsed.budgetValueRaw = budgetArg;
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
