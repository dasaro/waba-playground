import { GraphUtils } from './graph-utils.js?v=20260730-6';
import {
    buildAssumptionNodeTooltip,
    buildAttackEdgeTooltip,
    buildDerivationJunctionTooltip,
    buildDerivedNodeTooltip,
    buildJunctionTooltip,
    buildSupportEdgeTooltip,
    buildTopNodeTooltip
} from './graph-tooltip-builder.js?v=20260730-6';

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

    // ensureTop() in the branching builder may already have created ⊤ for an empty-body
    // derivation step, and it necessarily did so before factBasedAttacks was known -- which is
    // why its tooltip read "Targets: none". Enrich that node rather than pushing a duplicate id.
    const existingTop = visNodes.find((node) => node.id === '⊤');
    if (existingTop) {
        existingTop.title = buildTopNodeTooltip(factBasedAttacks);
    } else {
        visNodes.push(createTopNode(factBasedAttacks));
    }
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

// ---------------------------------------------------------------------------
// Branching mode renders the FULL DERIVATION DAG (unlike Direct, which flattens
// a contrary to its leaf assumptions). Intermediate derived atoms become their own
// nodes, so a CHAIN  contrary <- claim2 <- claim1 <- evidence  is drawn as a visible
// path evidence -> claim1 -> claim2 -> contrary -> (attacks) stance. This shows the
// inferential STRUCTURE of the debate and how the semiring propagates along it.
// ---------------------------------------------------------------------------

function derivedNodeColor() {
    return { border: '#6366f1', background: '#818cf8', highlight: { border: '#4f46e5', background: '#6366f1' } };
}

export function buildBranchingAssumptionGraph(assumptions, contraries, rules, weights) {
    const visNodes = [];
    const visEdges = [];
    const factBasedAttacks = [];
    const assumptionSet = new Set(assumptions);
    const created = new Set();
    const renderCache = new Map(); // atom -> node id (or null if it can never be supported)
    let topAdded = false;

    const ensureDerivedNode = (atom) => {
        const id = `arg_${atom}`;
        if (!created.has(id)) {
            created.add(id);
            const w = explicitWeight(weights, atom);
            const derivingRules = rules.filter((rule) => rule.head === atom);
            visNodes.push({
                id,
                // Show the explicit weight in the label when the intermediate carries one
                // (a weighted argument atom); leave a purely-propagated claim unlabelled
                // (its weight is semiring-dependent — the Results panel has it).
                label: (w === null || w === undefined) ? atom : `${atom}\n(w: ${w})`,
                shape: 'box',
                size: 18,
                color: derivedNodeColor(),
                font: { color: '#ffffff', size: 13 },
                title: buildDerivedNodeTooltip({ atom, explicitWeight: w, derivingRules }),
                isDerived: true,
                atom
            });
        }
        return id;
    };

    const ensureJunction = (id, body, { head, ruleId } = {}) => {
        if (!created.has(id)) {
            created.add(id);
            visNodes.push({
                id, label: '∧', size: 16, shape: 'diamond',
                color: { border: '#10b981', background: '#10b981', highlight: { border: '#059669', background: '#059669' } },
                font: { color: GraphUtils.getFontColor(), size: 15 },
                // This node used to be pushed with no `title`, so hovering an ∧ junction --
                // the one element whose whole purpose needs explaining -- showed nothing.
                title: buildDerivationJunctionTooltip({ head, ruleId, body }),
                isJunction: true, attackers: body, derivationBody: body
            });
        }
        return id;
    };

    const ensureTop = () => {
        if (!topAdded) {
            topAdded = true;
            visNodes.push(createTopNode([]));
        }
        return '⊤';
    };

    // `meta` carries the ATOMS and the rule. The tooltip must never show `from`/`to`, which
    // are internal vis ids like `arg_chimerism` / `junction_chimerism_r3`.
    const pushSupportEdge = (from, to, meta = {}) => {
        visEdges.push(createAttackEdge({
            id: `support-${from}-to-${to}`,
            from, to, width: 2,
            color: { color: '#94a3b8', highlight: '#64748b' },
            arrows: 'to', dashes: false,
            title: buildSupportEdgeTooltip(meta),
            attackType: 'support'
        }));
    };

    // Returns the node id representing "atom is supported", or null if it can never be.
    const renderSupport = (atom, visited) => {
        if (assumptionSet.has(atom)) return atom; // an assumption's own (circle) node
        if (renderCache.has(atom)) return renderCache.get(atom);
        if (visited.has(atom)) return null; // derivation cycle
        const derivingRules = rules.filter((rule) => rule.head === atom);
        if (derivingRules.length === 0) {
            renderCache.set(atom, null);
            return null;
        }
        const nextVisited = new Set(visited); nextVisited.add(atom);
        const derivedId = ensureDerivedNode(atom);
        renderCache.set(atom, derivedId);
        let fired = false;
        derivingRules.forEach((rule, ri) => {
            const body = rule.body || [];
            if (body.length === 0) {
                pushSupportEdge(ensureTop(), derivedId, { fromAtom: '⊤', toAtom: atom, ruleId: rule.id, body: [] }); // empty-body fact -> ⊤
                fired = true;
                return;
            }
            const bodyNodes = body.map((bodyAtom) => renderSupport(bodyAtom, nextVisited));
            if (bodyNodes.some((n) => n === null)) return; // a body atom is unsupportable -> dead rule
            fired = true;
            if (bodyNodes.length === 1) {
                pushSupportEdge(bodyNodes[0], derivedId, { fromAtom: body[0], toAtom: atom, ruleId: rule.id, body });
            } else {
                const jId = ensureJunction(`junction_${atom}_${rule.id || ri}`, body, { head: atom, ruleId: rule.id });
                bodyNodes.forEach((bn, bi) => pushSupportEdge(bn, jId, {
                    fromAtom: body[bi], toAtom: atom, ruleId: rule.id, body, viaJunction: true
                }));
                pushSupportEdge(jId, derivedId, { fromAtom: null, toAtom: atom, ruleId: rule.id, body });
            }
        });
        if (!fired) {
            renderCache.set(atom, null);
            return null;
        }
        return derivedId;
    };

    contraries.forEach(({ assumption, contrary }) => {
        const src = renderSupport(contrary, new Set());
        if (src === null) {
            // The contrary can never be supported: the stance is unattacked. But an
            // empty-support (pure-fact) contrary is a ⊤ attack.
            const leafSets = computeSupportSets(contrary, rules, assumptionSet, new Set(), SUPPORT_SET_CAP);
            if (leafSets.some((s) => s.length === 0)) {
                factBasedAttacks.push({ assumption, contrary, weight: explicitWeight(weights, contrary) ?? '?' });
            }
            return;
        }
        // The attack edge: the contrary's node defeats the stance. Carry the leaf
        // support set as jointWith so extension highlighting can tell if it is active.
        const isDirect = assumptionSet.has(contrary);
        const leafSets = computeSupportSets(contrary, rules, assumptionSet, new Set(), SUPPORT_SET_CAP);
        const jointWith = leafSets[0] || (isDirect ? [contrary] : []);
        // A single-leaf support (a direct attack, or a chain of single-premise rules)
        // carries that leaf's own weight under EVERY semiring (⊗ of one element is that
        // element), so it is safe to label. A multi-leaf support is a semiring-dependent
        // aggregate, so we show no number (the Results panel has the real value).
        const leafW = (jointWith.length === 1) ? explicitWeight(weights, jointWith[0]) : null;
        const shownWeight = leafW === null ? '?' : leafW;
        visEdges.push(createAttackEdge({
            id: `attack-${contrary}-${assumption}`,
            from: src, to: assumption,
            label: leafW === null ? '' : String(leafW),
            weight: shownWeight,
            width: 2,
            color: { color: '#f59e0b', highlight: '#d97706' },
            arrows: 'to', dashes: false,
            title: buildAttackEdgeTooltip({
                typeLabel: isDirect ? 'Direct attack' : 'Derived attack',
                attacker: contrary, target: assumption, contrary,
                weight: shownWeight,
                derivationBody: jointWith,
                derivedBy: rules.filter((rule) => rule.head === contrary).map((rule) => rule.id),
                note: isDirect
                    ? 'The attacker is itself the contrary of the target assumption.'
                    : 'This derived claim is the contrary of the target — it defeats it once its derivation is supported. The aggregate weight is semiring-dependent (see the Results panel).'
            }),
            attackType: isDirect ? 'direct' : 'derived',
            attackingElement: isDirect ? contrary : undefined,
            targetAssumption: assumption,
            contrary,
            jointWith,
            derivationBody: jointWith
        }));
    });

    visNodes.push(...createAssumptionNodes(assumptions, contraries, visEdges, weights));
    addFactBasedAttacks(visNodes, visEdges, factBasedAttacks);

    // A ⊤ that exists only because some rule has an empty body launches no attack of its own;
    // say so rather than leaving the builder's placeholder rows reading "none".
    const topNode = visNodes.find((node) => node.id === '⊤');
    if (topNode && factBasedAttacks.length === 0) {
        topNode.title = buildTopNodeTooltip([]);
    }

    return {
        visNodes,
        visEdges,
        isolatedNodes: collectIsolatedAssumptions(assumptions, visEdges, { excludeFrom: ['⊤', 'junction_', 'arg_'] })
    };
}
