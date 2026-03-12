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

export function displayValue(value) {
    if (value === POS_INF) {
        return '+inf';
    }
    if (value === NEG_INF) {
        return '-inf';
    }
    return String(value);
}

export function computeAggregateFromDiscarded(discardedAttacks, monoid) {
    const weights = discardedAttacks
        .map((attack) => attack.match(/discarded_attack\([^,]+,\s*[^,]+,\s*([^)]+)\)/))
        .filter(Boolean)
        .map((match) => normalizeAggregateValue(match[1]));

    if (monoid === 'count') {
        return weights.length;
    }

    if (monoid === 'sum') {
        return weights.reduce((total, value) => {
            if (value === POS_INF) {
                return POS_INF;
            }
            if (value === NEG_INF) {
                return NEG_INF;
            }
            if (total === POS_INF || total === NEG_INF) {
                return total;
            }
            return total + value;
        }, 0);
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

    if (monoid === 'sum' || monoid === 'count') {
        return [0, 0, optimization === 'minimize' ? aggregateValue : -aggregateValue];
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
