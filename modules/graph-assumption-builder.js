import { GraphUtils } from './graph-utils.js?v=20260630-10';
import {
    buildAssumptionNodeTooltip,
    buildAttackEdgeTooltip,
    buildJunctionTooltip,
    buildTopNodeTooltip
} from './graph-tooltip-builder.js?v=20260630-10';

// Cap on the number of minimal support sets enumerated per contrary, guarding
// against combinatorial blow-up on pathological (deeply disjunctive) frameworks.
const SUPPORT_SET_CAP = 24;

function assumptionNodeColor() {
    return GraphUtils.createNodeColor('assumption');
}

function assumptionFont() {
    return { color: GraphUtils.getFontColor() };
}

function explicitWeight(weights, atom) {
    return Object.prototype.hasOwnProperty.call(weights, atom) ? weights[atom] : null;
}

function createAssumptionNode(assumption, weights, summary) {
    const weight = explicitWeight(weights, assumption);
    return {
        id: assumption,
        label: assumption,
        size: 25,
        color: assumptionNodeColor(),
        title: buildAssumptionNodeTooltip({
            assumption,
            explicitWeight: weight,
            contrary: summary.contrary,
            incomingSources: summary.incomingSources,
            outgoingTargets: summary.outgoingTargets,
            outgoingContraries: summary.outgoingContraries
        }),
        font: assumptionFont(),
        isAssumption: true,
        explicitWeight: weight,
        contrary: summary.contrary
    };
}

function createTopNode(factBasedAttacks) {
    return {
        id: '⊤',
        label: '⊤',
        size: 25,
        shape: 'triangle', // match the legend's ⊤ (Facts) triangle symbol
        color: assumptionNodeColor(),
        title: buildTopNodeTooltip(factBasedAttacks),
        font: {
            color: GraphUtils.getFontColor(),
            size: 26
        },
        isTop: true
    };
}

function createAttackEdge(data) {
    return {
        ...data,
        originalWidth: data.width ?? 2,
        originalColor: data.color,
        originalDashes: data.dashes ?? false
    };
}

function collectIsolatedAssumptions(assumptions, visEdges, options = {}) {
    const { excludeFrom = [] } = options;
    const connectedAssumptions = new Set();

    visEdges.forEach((edge) => {
        if (!excludeFrom.some((prefix) => edge.from === prefix || edge.from.startsWith?.(prefix))) {
            if (assumptions.includes(edge.from)) {
                connectedAssumptions.add(edge.from);
            }
        }
        if (assumptions.includes(edge.to)) {
            connectedAssumptions.add(edge.to);
        }
    });

    return assumptions
        .filter((assumption) => !connectedAssumptions.has(assumption))
        .map((assumption) => ({ id: assumption, assumptions: [assumption] }));
}

function addFactBasedAttacks(visNodes, visEdges, factBasedAttacks) {
    if (factBasedAttacks.length === 0) {
        return;
    }

    visNodes.push(createTopNode(factBasedAttacks));
    factBasedAttacks.forEach(({ assumption, contrary, weight }) => {
        const displayWeight = (weight === '?' || weight === null || weight === undefined) ? '' : weight;
        const edgeColor = { color: '#f59e0b', highlight: '#ea580c' };
        visEdges.push(createAttackEdge({
            id: `top-attacks-${assumption}-via-${contrary}`,
            from: '⊤',
            to: assumption,
            label: displayWeight,
            weight,
            width: 2,
            color: edgeColor,
            arrows: 'to',
            title: buildAttackEdgeTooltip({
                typeLabel: 'Fact-based attack',
                attacker: contrary,
                target: assumption,
                contrary,
                weight,
                note: 'The contrary is supported by a fact or empty-body rule, so no assumption is needed to launch this attack. Its weight is semiring-dependent — see the Results panel.'
            }),
            attackType: 'fact',
            attackingElement: contrary,
            targetAssumption: assumption,
            contrary
        }));
    });
}

function createAssumptionNodes(assumptions, contraries, visEdges, weights) {
    const contraryMap = new Map(contraries.map(({ assumption, contrary }) => [assumption, contrary]));
    const summaries = new Map(assumptions.map((assumption) => [assumption, {
        contrary: contraryMap.get(assumption) ?? null,
        incomingSources: [],
        outgoingTargets: [],
        outgoingContraries: []
    }]));

    visEdges.forEach((edge) => {
        const attacker = edge.attackingElement;
        const target = edge.targetAssumption;
        if (attacker && summaries.has(attacker)) {
            const summary = summaries.get(attacker);
            summary.outgoingTargets.push(target);
            if (edge.contrary) {
                summary.outgoingContraries.push(edge.contrary);
            }
        }
        if (target && summaries.has(target)) {
            const summary = summaries.get(target);
            if (edge.attackType === 'fact') {
                summary.incomingSources.push(`facts via ${edge.contrary}`);
            } else if (attacker) {
                summary.incomingSources.push(attacker);
            }
        }
    });

    return assumptions.map((assumption) => createAssumptionNode(assumption, weights, summaries.get(assumption)));
}

// ---------------------------------------------------------------------------
// Minimal assumption-support computation
// ---------------------------------------------------------------------------
// `computeSupportSets(atom)` returns the DNF of the AND-OR derivation tree of an
// atom: an array of minimal assumption sets, each of which (if all its members
// are supported) suffices to derive `atom`. This traces derivation CHAINS through
// non-assumption intermediate atoms and nested disjunction, so the graph reflects
// what actually launches an attack rather than just the direct rule body.
//   - leaf assumption        -> [[atom]]
//   - empty-body fact / chain bottoming at facts -> [[]] (the empty set = ⊤)
//   - underivable non-assumption / derivation cycle -> [] (can never be supported)

function setKey(arr) {
    return [...arr].sort().join('');
}

function dedupeSets(sets) {
    const seen = new Map();
    for (const s of sets) {
        const key = setKey(s);
        if (!seen.has(key)) {
            seen.set(key, [...s].sort());
        }
    }
    return [...seen.values()];
}

function isSubset(a, b) {
    const big = new Set(b);
    return a.every((x) => big.has(x));
}

function minimalSets(sets) {
    const deduped = dedupeSets(sets);
    // Drop any set that strictly contains a smaller one (non-minimal support).
    return deduped.filter((s) => !deduped.some((t) => t.length < s.length && isSubset(t, s)));
}

function computeSupportSets(atom, rules, assumptionSet, visited, cap) {
    if (assumptionSet.has(atom)) {
        return [[atom]];
    }
    if (visited.has(atom)) {
        return []; // derivation cycle through non-assumption atoms -> unfounded on this path
    }
    const nextVisited = new Set(visited);
    nextVisited.add(atom);

    const derivingRules = rules.filter((rule) => rule.head === atom);
    if (derivingRules.length === 0) {
        return []; // non-assumption atom with no deriving rule can never be supported
    }

    const out = [];
    for (const rule of derivingRules) {
        const body = rule.body || [];
        let combos = [[]]; // AND over the body = Cartesian product of each atom's support sets
        let dead = false;
        for (const bodyAtom of body) {
            const bodySets = computeSupportSets(bodyAtom, rules, assumptionSet, nextVisited, cap);
            if (bodySets.length === 0) {
                dead = true; // a body atom can never be supported -> this rule cannot fire
                break;
            }
            const next = [];
            for (const combo of combos) {
                for (const bodySet of bodySets) {
                    next.push([...new Set([...combo, ...bodySet])]);
                }
            }
            combos = dedupeSets(next);
            if (combos.length > cap) {
                combos = combos.slice(0, cap);
            }
        }
        if (!dead) {
            out.push(...combos); // empty body keeps combos = [[]] (a fact: the empty support set)
        }
    }
    return minimalSets(out).slice(0, cap);
}

// ---------------------------------------------------------------------------
// Graph builders (Direct and Branching share one core; they differ only in how a
// multi-assumption / joint support set is drawn)
// ---------------------------------------------------------------------------

function pushSingleAttackEdge(visEdges, { leaf, assumption, contrary, weights, idx }) {
    const isDirect = leaf === contrary; // the contrary is itself the attacking assumption
    // A single-premise attack — possibly via a chain of single-premise rules — has
    // propagated weight equal to the leaf assumption's own weight under EVERY
    // semiring (⊗ of one element is that element). So this weight is safe to show.
    const weight = explicitWeight(weights, leaf);
    const label = (weight === null || weight === undefined) ? '' : String(weight);
    const edgeColor = { color: '#f59e0b', highlight: '#d97706' };
    visEdges.push(createAttackEdge({
        id: `${leaf}-attacks-${assumption}-via-${contrary}-${idx}`,
        from: leaf,
        to: assumption,
        label,
        weight: weight === null ? '?' : weight,
        width: 2,
        color: edgeColor,
        arrows: 'to',
        dashes: false,
        title: buildAttackEdgeTooltip({
            typeLabel: isDirect ? 'Direct attack' : 'Derived attack',
            attacker: leaf,
            target: assumption,
            contrary,
            weight: weight === null ? '?' : weight,
            derivationBody: [contrary],
            note: isDirect
                ? 'The attacker is itself the contrary of the target assumption.'
                : 'The source assumption derives the contrary (possibly through a chain of rules); a single-premise derivation carries the leaf weight under every semiring.'
        }),
        attackType: isDirect ? 'direct' : 'derived',
        attackingElement: leaf,
        targetAssumption: assumption,
        contrary,
        derivationBody: [contrary]
    }));
}

function pushDirectJoint(visEdges, { set, assumption, contrary, idx }) {
    // Direct mode cannot draw the conjunction structurally, so each contributor
    // gets a green edge MARKED with ∧ to signal "jointly required" — distinguishing
    // it from independent (disjunctive) amber attacks, which differ only in colour.
    set.forEach((attacker) => {
        const edgeColor = { color: '#10b981', highlight: '#059669' };
        visEdges.push(createAttackEdge({
            id: `${attacker}-joint-attacks-${assumption}-via-${contrary}-${idx}`,
            from: attacker,
            to: assumption,
            label: '∧',
            weight: '?', // the joint (⊗-aggregated) weight is semiring-dependent
            width: 2,
            color: edgeColor,
            arrows: 'to',
            dashes: false,
            title: buildAttackEdgeTooltip({
                typeLabel: 'Joint attack contribution',
                attacker,
                target: assumption,
                contrary,
                weight: '?',
                derivationBody: set,
                jointWith: set,
                note: 'All ∧-marked contributors must be supported together for this attack to fire (it is NOT an independent attack). The aggregate weight is semiring-dependent — see the Results panel.'
            }),
            attackType: 'joint',
            attackingElement: attacker,
            targetAssumption: assumption,
            contrary,
            jointWith: set,
            derivationBody: set
        }));
    });
}

function pushBranchingJoint(visNodes, visEdges, { set, assumption, contrary, idx }) {
    const junctionId = `junction_${contrary}_${idx}`;
    visNodes.push({
        id: junctionId,
        label: '∧',
        size: 22,
        shape: 'diamond',
        color: {
            border: '#10b981',
            background: '#10b981',
            highlight: { border: '#059669', background: '#059669' }
        },
        title: buildJunctionTooltip({
            target: assumption,
            contrary,
            ruleId: 'derivation',
            derivationBody: set,
            weight: '?'
        }),
        font: { color: GraphUtils.getFontColor(), size: 20 },
        isJunction: true,
        attackers: set,
        target: assumption,
        contrary,
        derivationBody: set,
        weight: '?'
    });

    set.forEach((attacker) => {
        const edgeColor = { color: '#10b981', highlight: '#059669' };
        visEdges.push(createAttackEdge({
            id: `${attacker}-to-${junctionId}`,
            from: attacker,
            to: junctionId,
            width: 2,
            color: edgeColor,
            arrows: 'to',
            dashes: false,
            title: buildAttackEdgeTooltip({
                typeLabel: 'Joint attack contribution',
                attacker,
                target: assumption,
                contrary,
                weight: '?',
                derivationBody: set,
                jointWith: set,
                note: 'A prerequisite edge into the junction; by itself it does not defeat the target.'
            }),
            attackingElement: attacker,
            targetAssumption: assumption,
            contrary,
            attackType: 'joint-contribution',
            jointWith: set,
            derivationBody: set,
            weight: '?'
        }));
    });

    const edgeColor = { color: '#10b981', highlight: '#059669' };
    visEdges.push(createAttackEdge({
        id: `${junctionId}-attacks-${assumption}`,
        from: junctionId,
        to: assumption,
        label: '', // the aggregate weight is semiring-dependent; do not fabricate one
        weight: '?',
        width: 2,
        color: edgeColor,
        arrows: 'to',
        dashes: false,
        title: buildAttackEdgeTooltip({
            typeLabel: 'Joint attack',
            attacker: 'junction',
            target: assumption,
            contrary,
            weight: '?',
            derivationBody: set,
            jointWith: set,
            note: 'The junction fires once all contributors are simultaneously supported. The aggregate weight is semiring-dependent — see the Results panel.'
        }),
        targetAssumption: assumption,
        contrary,
        attackType: 'joint',
        derivationBody: set,
        jointWith: set
    }));
}

function buildAssumptionGraph(assumptions, contraries, rules, weights, { branching }) {
    const visNodes = [];
    const visEdges = [];
    const factBasedAttacks = [];
    const assumptionSet = new Set(assumptions);

    contraries.forEach(({ assumption, contrary }) => {
        // Minimal assumption sets that derive the contrary (tracing chains + disjunction).
        const supportSets = computeSupportSets(contrary, rules, assumptionSet, new Set(), SUPPORT_SET_CAP);

        supportSets.forEach((set, idx) => {
            if (set.length === 0) {
                // Derivable from facts alone -> ⊤ fact-based attack.
                factBasedAttacks.push({
                    assumption,
                    contrary,
                    weight: explicitWeight(weights, contrary) ?? '?'
                });
            } else if (set.length === 1) {
                pushSingleAttackEdge(visEdges, { leaf: set[0], assumption, contrary, weights, idx });
            } else if (branching) {
                pushBranchingJoint(visNodes, visEdges, { set, assumption, contrary, idx });
            } else {
                pushDirectJoint(visEdges, { set, assumption, contrary, idx });
            }
        });
    });

    visNodes.push(...createAssumptionNodes(assumptions, contraries, visEdges, weights));
    addFactBasedAttacks(visNodes, visEdges, factBasedAttacks);

    return {
        visNodes,
        visEdges,
        isolatedNodes: collectIsolatedAssumptions(assumptions, visEdges, {
            excludeFrom: branching ? ['⊤', 'junction_'] : ['⊤']
        })
    };
}

export function buildDirectAssumptionGraph(assumptions, contraries, rules, weights) {
    return buildAssumptionGraph(assumptions, contraries, rules, weights, { branching: false });
}

export function buildBranchingAssumptionGraph(assumptions, contraries, rules, weights) {
    return buildAssumptionGraph(assumptions, contraries, rules, weights, { branching: true });
}
