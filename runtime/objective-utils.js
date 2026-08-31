// @ts-ignore -- the query is the playground's browser cache-busting module version
import { matchPredicate, splitTopLevelArgs } from './answer-set-parser.js?v=20260831-1';

export const POS_INF = '#sup';
export const NEG_INF = '#inf';

export function maxWithSentinels(left, right) {
    if (left === POS_INF || right === POS_INF) {
        return POS_INF;
    }
    if (left === NEG_INF) {
        return right;
    }
    if (right === NEG_INF) {
        return left;
    }
    return Math.max(left, right);
}

export function minWithSentinels(left, right) {
    if (left === NEG_INF || right === NEG_INF) {
        return NEG_INF;
    }
    if (left === POS_INF) {
        return right;
    }
    if (right === POS_INF) {
        return left;
    }
    return Math.min(left, right);
}

export function normalizeAggregateValue(value) {
    if (value === null || value === undefined) {
        return 0;
    }
    if (value === POS_INF || value === NEG_INF) {
        return value;
    }
    if (typeof value === 'number') {
        return value;
    }
    const parsed = Number.parseFloat(String(value));
    return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Render a weight for display. HTML-ESCAPED, because weights come from user-supplied .lp/.waba
 * files: ASP permits a quoted-string term, so `weight(a, "<img src=x onerror=...>")` reached
 * innerHTML verbatim on the discarded-attack and derived-atom lines.
 */
export function displayValue(value) {
    if (value === POS_INF) {
        return '+inf';
    }
    if (value === NEG_INF) {
        return '-inf';
    }
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function computeAggregateFromDiscarded(discardedAttacks, monoid) {
    const weights = discardedAttacks
        .map((attack) => matchPredicate(attack, 'discarded_attack'))
        .filter((args) => args !== null)
        .map((args) => splitTopLevelArgs(args))
        .filter((args) => args.length === 3)
        .map((args) => normalizeAggregateValue(args[2]));

    if (monoid === 'sum') {
        // monoid/sum.lp defines the LIFTED sum: #inf is absorbing (sum_has_infimum ->
        // budget_value(#inf)); #sup tuples are still dropped by clingo's #sum. Mirroring the
        // raw #sum here (the pre-lift behaviour) under-reported any receipt holding a
        // #inf-priced attack and ranked it as if it were finite.
        if (weights.includes(NEG_INF)) {
            return NEG_INF;
        }
        return weights
            .filter((value) => value !== POS_INF)
            .reduce((total, value) => total + value, 0);
    }

    if (monoid === 'max') {
        if (weights.length === 0) {
            return NEG_INF;
        }
        return weights.reduce((current, value) => maxWithSentinels(current, value), NEG_INF);
    }

    if (monoid === 'min') {
        if (weights.length === 0) {
            return POS_INF;
        }
        return weights.reduce((current, value) => minWithSentinels(current, value), POS_INF);
    }

    return 0;
}

export function getObjectiveTuple(config, aggregateValue) {
    const { monoid, optimization } = config;

    if (monoid === 'sum') {
        // Mirror optimize/{minimize,maximize}.lp's stratified levels for the lifted sum:
        // minimize ranks #inf best ((0,0,0)) and #sup worst; maximize the reverse.
        if (optimization === 'minimize') {
            if (aggregateValue === NEG_INF) return [0, 0, 0];
            if (aggregateValue === POS_INF) return [1, 0, 0];
            return [0, 1, aggregateValue];
        }
        if (aggregateValue === POS_INF) return [0, 0, 0];
        if (aggregateValue === NEG_INF) return [1, 0, 0];
        return [0, 1, -aggregateValue];
    }

    if (monoid === 'max' && optimization === 'minimize') {
        if (aggregateValue === POS_INF) {
            return [1, 0, 0];
        }
        if (aggregateValue === NEG_INF) {
            return [0, 0, 0];
        }
        return [0, 0, aggregateValue];
    }

    if (monoid === 'max' && optimization === 'maximize') {
        if (aggregateValue === NEG_INF) {
            return [1, -1, 0];
        }
        if (aggregateValue === POS_INF) {
            return [0, 0, 0];
        }
        return [0, -1, -aggregateValue];
    }

    if (monoid === 'min' && optimization === 'minimize') {
        if (aggregateValue === NEG_INF) {
            return [1, 0, 0];
        }
        if (aggregateValue === POS_INF) {
            return [0, 0, 0];
        }
        return [0, 0, aggregateValue];
    }

    if (monoid === 'min' && optimization === 'maximize') {
        if (aggregateValue === NEG_INF) {
            return [1, 0, 0];
        }
        if (aggregateValue === POS_INF) {
            return [0, -1, 0];
        }
        return [0, -1, -aggregateValue];
    }

    return [0, 0, 0];
}

export function compareTuples(left, right) {
    for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
        const leftValue = left[index] ?? 0;
        const rightValue = right[index] ?? 0;
        if (leftValue < rightValue) {
            return -1;
        }
        if (leftValue > rightValue) {
            return 1;
        }
    }
    return 0;
}

export function formatSyntheticOptimization(aggregateValue) {
    if (aggregateValue === POS_INF) {
        return POS_INF;
    }
    if (aggregateValue === NEG_INF) {
        return NEG_INF;
    }
    return aggregateValue;
}
