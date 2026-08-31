import { matchPredicate, parseAnswerSet, splitTopLevelArgs } from './answer-set-parser.js?v=20260831-1';
import {
    compareTuples, computeAggregateFromDiscarded, getObjectiveTuple, normalizeAggregateValue
} from './objective-utils.js?v=20260831-1';

/**
 * A beta-sigma extension is the accepted assumption set, existentially quantified over an
 * affordable discard witness. Keep D in solver witnesses for receipts and preferred filtering,
 * but use only in/1 for extension identity at the browser boundary.
 */
export function extensionKey(witness) {
    return JSON.stringify(parseAnswerSet(witness?.Value || []).in);
}

/** The reduced attack relation is determined by the exact (sorted) discard set D. */
export function discardKey(witness) {
    return JSON.stringify(parseAnswerSet(witness?.Value || []).discarded);
}

/**
 * Emit the facts consumed by the exact relational semantics filters.
 * discarded_member/4 confines every comparison to candidates realised in the
 * same reduced framework Att \\ D. semantic_range/1 is an internal candidate
 * receipt emitted only for semi-stable, stage and eager; it becomes range_member/2.
 */
export function buildSemanticCandidateFacts(witnesses) {
    return witnesses.map((witness, index) => {
        const modelId = index + 1;
        const lines = [`candidate(${modelId}).`];
        for (const predicate of witness?.Value || []) {
            const member = matchPredicate(predicate, 'in');
            if (member !== null) {
                lines.push(`member(${modelId},${member}).`);
                continue;
            }
            const rangeMember = matchPredicate(predicate, 'semantic_range');
            if (rangeMember !== null) {
                lines.push(`range_member(${modelId},${rangeMember}).`);
                continue;
            }
            const discarded = matchPredicate(predicate, 'discarded_attack');
            if (discarded !== null) {
                const args = splitTopLevelArgs(discarded);
                if (args.length === 3) {
                    lines.push(`discarded_member(${modelId},${args.join(',')}).`);
                }
            }
        }
        return lines.join('\n');
    }).join('\n');
}

// Compatibility name for callers saved against the original preferred-only helper.
export const buildSubsetCandidateFacts = buildSemanticCandidateFacts;

/** Remove private post-filter receipts before rendering or exporting an extension. */
export function stripSemanticReceipts(witness) {
    return {
        ...witness,
        Value: (witness?.Value || []).filter(
            (predicate) => matchPredicate(predicate, 'semantic_range') === null
        )
    };
}

function representativeTuple(witness, config) {
    const parsed = parseAnswerSet(witness?.Value || []);
    const aggregate = parsed.budgetValueRaw !== null
        ? normalizeAggregateValue(parsed.budgetValueRaw)
        : computeAggregateFromDiscarded(parsed.discarded, config.monoid);
    // A representative receipt should be the least expensive witness for an upper-bound
    // reading and the strongest surviving floor for a lower-bound reading, independently of
    // which display optimisation the user requested.
    const optimization = config.budgetMode === 'lb' ? 'maximize' : 'minimize';
    return getObjectiveTuple({ ...config, optimization }, aggregate);
}

/**
 * Existentially forget D while retaining one deterministic, best representative receipt for
 * each extension. This is applied only after the per-D ordinary semantics has been decided.
 */
export function dedupeExtensionWitnesses(witnesses, config) {
    const representatives = new Map();
    for (const witness of witnesses) {
        const key = extensionKey(witness);
        const candidate = {
            witness,
            tuple: representativeTuple(witness, config),
            discard: discardKey(witness)
        };
        const current = representatives.get(key);
        if (!current
            || compareTuples(candidate.tuple, current.tuple) < 0
            || (compareTuples(candidate.tuple, current.tuple) === 0
                && candidate.discard.localeCompare(current.discard) < 0)) {
            representatives.set(key, candidate);
        }
    }
    return [...representatives.values()].map(({ witness }) => witness);
}
