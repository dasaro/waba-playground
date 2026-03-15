import { GraphUtils } from './graph-utils.js?v=20260315-1';
import {
    buildAssumptionNodeTooltip,
    buildAttackEdgeTooltip,
    buildJunctionTooltip,
    buildTopNodeTooltip
} from './graph-tooltip-builder.js?v=20260315-1';

function assumptionNodeColor() {
    return GraphUtils.createNodeColor('assumption');
}

function assumptionFont() {
    return { color: GraphUtils.getFontColor() };
}

function createAssumptionNode(assumption, weights, summary) {
    const explicitWeight = Object.prototype.hasOwnProperty.call(weights, assumption) ? weights[assumption] : null;
    return {
        id: assumption,
        label: assumption,
        size: 25,
        color: assumptionNodeColor(),
        title: buildAssumptionNodeTooltip({
            assumption,
            explicitWeight,
            contrary: summary.contrary,
            incomingSources: summary.incomingSources,
            outgoingTargets: summary.outgoingTargets,
            outgoingContraries: summary.outgoingContraries
        }),
        font: assumptionFont(),
        isAssumption: true,
        explicitWeight,
        contrary: summary.contrary
    };
}

function createTopNode(factBasedAttacks) {
    return {
        id: '⊤',
        label: '⊤',
        size: 25,
        shape: 'ellipse',
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
        const displayWeight = weight === '?' ? '' : weight;
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
                note: 'The contrary is supported by a fact or empty-body rule, so no assumption is needed to launch this attack.'
            }),
            attackType: 'fact',
            attackingElement: contrary,
            targetAssumption: assumption,
            contrary
        }));
    });
}

function getContraryWeight(weights, contrary) {
    return weights[contrary] ?? 1;
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

export function buildDirectAssumptionGraph(assumptions, contraries, rules, weights) {
    const visNodes = [];
    const visEdges = [];
    const factBasedAttacks = [];

    contraries.forEach(({ assumption, contrary }) => {
        const derivingRules = rules.filter((rule) => rule.head === contrary);
        const hasNonFactRules = derivingRules.some((rule) => rule.body && rule.body.length > 0);

        if (!hasNonFactRules) {
            if (assumptions.includes(contrary)) {
                const weight = getContraryWeight(weights, contrary);
                const edgeColor = { color: '#f59e0b', highlight: '#d97706' };
                visEdges.push(createAttackEdge({
                    id: `${contrary}-attacks-${assumption}`,
                    from: contrary,
                    to: assumption,
                    label: weight === '?' ? '' : weight,
                    weight,
                    width: 2,
                    color: edgeColor,
                    arrows: 'to',
                    title: buildAttackEdgeTooltip({
                        typeLabel: 'Direct attack',
                        attacker: contrary,
                        target: assumption,
                        contrary,
                        weight,
                        note: 'The attacker itself is the contrary of the target assumption.'
                    }),
                    attackType: 'direct',
                    attackingElement: contrary,
                    targetAssumption: assumption,
                    derivationBody: [contrary]
                }));
            } else {
                factBasedAttacks.push({
                    assumption,
                    contrary,
                    weight: getContraryWeight(weights, contrary)
                });
            }
            return;
        }

        derivingRules.forEach((rule) => {
            const attackers = rule.body;
            if (attackers.length === 1) {
                const attacker = attackers[0];
                if (!assumptions.includes(attacker)) {
                    return;
                }
                const weight = getContraryWeight(weights, contrary);
                const edgeColor = { color: '#f59e0b', highlight: '#d97706' };
                visEdges.push(createAttackEdge({
                    id: `${attacker}-attacks-${assumption}-via-${contrary}`,
                    from: attacker,
                    to: assumption,
                    label: weight === '?' ? '' : weight,
                    weight,
                    width: 2,
                    color: edgeColor,
                    arrows: 'to',
                    dashes: false,
                    title: buildAttackEdgeTooltip({
                        typeLabel: 'Derived attack',
                        attacker,
                        target: assumption,
                        contrary,
                        weight,
                        ruleId: rule.id,
                        derivationBody: attackers,
                        note: 'This attack exists because the source assumption supports a rule body that derives the contrary.'
                    }),
                    attackType: 'derived',
                    attackingElement: attacker,
                    targetAssumption: assumption,
                    contrary,
                    ruleId: rule.id,
                    derivationBody: attackers
                }));
                return;
            }

            if (attackers.length > 1) {
                const assumptionAttackers = attackers.filter((attacker) => assumptions.includes(attacker));
                if (assumptionAttackers.length === 0) {
                    return;
                }
                const weight = getContraryWeight(weights, contrary);
                const displayWeight = weight === '?' ? '' : weight;
                assumptionAttackers.forEach((attacker) => {
                    const edgeColor = { color: '#10b981', highlight: '#059669' };
                    visEdges.push(createAttackEdge({
                        id: `${attacker}-joint-attacks-${assumption}-via-${contrary}`,
                        from: attacker,
                        to: assumption,
                        label: displayWeight,
                        weight,
                        width: 2,
                        color: edgeColor,
                        arrows: 'to',
                        dashes: false,
                        title: buildAttackEdgeTooltip({
                            typeLabel: 'Joint attack contribution',
                            attacker,
                            target: assumption,
                            contrary,
                            weight,
                            ruleId: rule.id,
                            derivationBody: attackers,
                            jointWith: assumptionAttackers,
                            note: 'This edge represents one premise feeding a joint attack; all contributors must be supported.'
                        }),
                        attackType: 'joint',
                        attackingElement: attacker,
                        targetAssumption: assumption,
                        contrary,
                        jointWith: assumptionAttackers,
                        ruleId: rule.id,
                        derivationBody: attackers
                    }));
                });
            }
        });
    });

    visNodes.push(...createAssumptionNodes(assumptions, contraries, visEdges, weights));
    addFactBasedAttacks(visNodes, visEdges, factBasedAttacks);

    return {
        visNodes,
        visEdges,
        isolatedNodes: collectIsolatedAssumptions(assumptions, visEdges, { excludeFrom: ['⊤'] })
    };
}

export function buildBranchingAssumptionGraph(assumptions, contraries, rules, weights) {
    const visNodes = [];
    const visEdges = [];
    const factBasedAttacks = [];

    contraries.forEach(({ assumption, contrary }) => {
        const derivingRules = rules.filter((rule) => rule.head === contrary);
        const hasNonFactRules = derivingRules.some((rule) => rule.body && rule.body.length > 0);

        if (!hasNonFactRules) {
            if (assumptions.includes(contrary)) {
                const weight = getContraryWeight(weights, contrary);
                const edgeColor = { color: '#f59e0b', highlight: '#d97706' };
                visEdges.push(createAttackEdge({
                    id: `${contrary}-attacks-${assumption}`,
                    from: contrary,
                    to: assumption,
                    label: weight === '?' ? '' : weight,
                    weight,
                    width: 2,
                    color: edgeColor,
                    arrows: 'to',
                    title: buildAttackEdgeTooltip({
                        typeLabel: 'Direct attack',
                        attacker: contrary,
                        target: assumption,
                        contrary,
                        weight,
                        note: 'The attacker itself is the contrary of the target assumption.'
                    }),
                    attackingElement: contrary,
                    targetAssumption: assumption,
                    contrary,
                    attackType: 'direct',
                    derivationBody: [contrary]
                }));
            } else {
                factBasedAttacks.push({
                    assumption,
                    contrary,
                    weight: getContraryWeight(weights, contrary)
                });
            }
            return;
        }

        derivingRules.forEach((rule) => {
            const attackers = rule.body;
            if (attackers.length === 1) {
                const attacker = attackers[0];
                if (!assumptions.includes(attacker)) {
                    return;
                }
                const weight = getContraryWeight(weights, contrary);
                const edgeColor = { color: '#f59e0b', highlight: '#d97706' };
                visEdges.push(createAttackEdge({
                    id: `${attacker}-attacks-${assumption}-via-${contrary}`,
                    from: attacker,
                    to: assumption,
                    label: weight === '?' ? '' : weight,
                    weight,
                    width: 2,
                    color: edgeColor,
                    arrows: 'to',
                    dashes: false,
                    title: buildAttackEdgeTooltip({
                        typeLabel: 'Derived attack',
                        attacker,
                        target: assumption,
                        contrary,
                        weight,
                        ruleId: rule.id,
                        derivationBody: attackers,
                        note: 'A single supported assumption is enough to derive the contrary in this rule.'
                    }),
                    attackingElement: attacker,
                    targetAssumption: assumption,
                    contrary,
                    attackType: 'derived',
                    ruleId: rule.id,
                    derivationBody: attackers
                }));
                return;
            }

            if (attackers.length > 1) {
                const assumptionAttackers = attackers.filter((attacker) => assumptions.includes(attacker));
                if (assumptionAttackers.length === 0) {
                    return;
                }

                const junctionId = `junction_${rule.id}`;
                visNodes.push({
                    id: junctionId,
                    label: '',
                    size: 25,
                    shape: 'diamond',
                    color: {
                        border: '#10b981',
                        background: '#10b981',
                        highlight: {
                            border: '#059669',
                            background: '#059669'
                        }
                    },
                    title: buildJunctionTooltip({
                        target: assumption,
                        contrary,
                        ruleId: rule.id,
                        derivationBody: assumptionAttackers,
                        weight: getContraryWeight(weights, contrary)
                    }),
                    font: {
                        color: GraphUtils.getFontColor(),
                        size: 25
                    },
                    isJunction: true,
                    attackers: assumptionAttackers,
                    target: assumption,
                    contrary,
                    ruleId: rule.id,
                    derivationBody: assumptionAttackers,
                    weight: getContraryWeight(weights, contrary)
                });

                assumptionAttackers.forEach((attacker) => {
                    const edgeColor = { color: '#10b981', highlight: '#059669' };
                    visEdges.push(createAttackEdge({
                        id: `${attacker}-to-junction-${junctionId}`,
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
                            weight: getContraryWeight(weights, contrary),
                            ruleId: rule.id,
                            derivationBody: assumptionAttackers,
                            jointWith: assumptionAttackers,
                            note: 'This is a prerequisite edge into the junction; by itself it does not defeat the target.'
                        }),
                        attackingElement: attacker,
                        targetAssumption: assumption,
                        contrary,
                        attackType: 'joint-contribution',
                        ruleId: rule.id,
                        derivationBody: assumptionAttackers,
                        jointWith: assumptionAttackers,
                        weight: getContraryWeight(weights, contrary)
                    }));
                });

                const weight = getContraryWeight(weights, contrary);
                const edgeColor = { color: '#10b981', highlight: '#059669' };
                visEdges.push(createAttackEdge({
                    id: `${junctionId}-attacks-${assumption}`,
                    from: junctionId,
                    to: assumption,
                    label: weight === '?' ? '' : weight,
                    weight,
                    width: 2,
                    color: edgeColor,
                    arrows: 'to',
                    dashes: false,
                    title: buildAttackEdgeTooltip({
                        typeLabel: 'Joint attack',
                        attacker: 'junction',
                        target: assumption,
                        contrary,
                        weight,
                        ruleId: rule.id,
                        derivationBody: assumptionAttackers,
                        jointWith: assumptionAttackers,
                        note: 'The junction fires once all listed contributors are simultaneously supported.'
                    }),
                    targetAssumption: assumption,
                    contrary,
                    attackType: 'joint',
                    ruleId: rule.id,
                    derivationBody: assumptionAttackers,
                    jointWith: assumptionAttackers
                }));
            }
        });
    });

    visNodes.push(...createAssumptionNodes(assumptions, contraries, visEdges, weights));
    addFactBasedAttacks(visNodes, visEdges, factBasedAttacks);

    return {
        visNodes,
        visEdges,
        isolatedNodes: collectIsolatedAssumptions(assumptions, visEdges, { excludeFrom: ['⊤', 'junction_'] })
    };
}
