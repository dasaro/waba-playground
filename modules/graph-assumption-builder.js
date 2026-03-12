import { GraphUtils } from './graph-utils.js?v=20260312-7';

function assumptionNodeColor() {
    return GraphUtils.createNodeColor('assumption');
}

function assumptionFont() {
    return { color: GraphUtils.getFontColor() };
}

function createAssumptionNode(assumption, weights) {
    const weight = weights[assumption] ?? '?';
    return {
        id: assumption,
        label: assumption,
        size: 25,
        color: assumptionNodeColor(),
        title: `Assumption: ${assumption}\nWeight: ${weight}`,
        font: assumptionFont(),
        isAssumption: true
    };
}

function createTopNode() {
    return {
        id: '⊤',
        label: '⊤',
        size: 25,
        shape: 'ellipse',
        color: assumptionNodeColor(),
        title: 'Top element (⊤): represents fact-based attacks',
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

    visNodes.push(createTopNode());
    factBasedAttacks.forEach(({ assumption, contrary, weight }) => {
        const displayWeight = weight === '?' ? '' : weight;
        const edgeColor = { color: '#f59e0b', highlight: '#ea580c' };
        visEdges.push(createAttackEdge({
            id: `top-attacks-${assumption}-via-${contrary}`,
            from: '⊤',
            to: assumption,
            label: displayWeight,
            width: 2,
            color: edgeColor,
            arrows: 'to',
            title: `Fact ${contrary} attacks ${assumption}\nType: Fact-based\nWeight: ${weight}`,
            attackType: 'fact',
            attackingElement: contrary,
            targetAssumption: assumption
        }));
    });
}

function getContraryWeight(weights, contrary) {
    return weights[contrary] ?? 1;
}

export function buildDirectAssumptionGraph(assumptions, contraries, rules, weights) {
    const visNodes = assumptions.map((assumption) => createAssumptionNode(assumption, weights));
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
                    width: 2,
                    color: edgeColor,
                    arrows: 'to',
                    title: `${contrary} attacks ${assumption}\nType: Direct\nWeight: ${weight}`,
                    attackType: 'direct',
                    attackingElement: contrary,
                    targetAssumption: assumption
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
                    width: 2,
                    color: edgeColor,
                    arrows: 'to',
                    dashes: false,
                    title: `${attacker} attacks ${assumption}\nType: Derived (${contrary})\nWeight: ${weight}`,
                    attackType: 'derived',
                    attackingElement: attacker,
                    targetAssumption: assumption,
                    contrary
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
                    const otherAttackers = assumptionAttackers.filter((name) => name !== attacker).join(', ');
                    const edgeColor = { color: '#10b981', highlight: '#059669' };
                    visEdges.push(createAttackEdge({
                        id: `${attacker}-joint-attacks-${assumption}-via-${contrary}`,
                        from: attacker,
                        to: assumption,
                        label: displayWeight,
                        width: 2,
                        color: edgeColor,
                        arrows: 'to',
                        dashes: false,
                        title: `${attacker} jointly attacks ${assumption}\nWith: ${otherAttackers}\nType: Joint Attack (${contrary})\nWeight: ${weight}`,
                        attackType: 'joint',
                        attackingElement: attacker,
                        targetAssumption: assumption,
                        contrary,
                        jointWith: assumptionAttackers
                    }));
                });
            }
        });
    });

    addFactBasedAttacks(visNodes, visEdges, factBasedAttacks);

    return {
        visNodes,
        visEdges,
        isolatedNodes: collectIsolatedAssumptions(assumptions, visEdges, { excludeFrom: ['⊤'] })
    };
}

export function buildBranchingAssumptionGraph(assumptions, contraries, rules, weights) {
    const visNodes = assumptions.map((assumption) => createAssumptionNode(assumption, weights));
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
                    width: 2,
                    color: edgeColor,
                    arrows: 'to',
                    title: `${contrary} attacks ${assumption}\nType: Direct\nWeight: ${weight}`,
                    attackingElement: contrary,
                    targetAssumption: assumption
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
                    width: 2,
                    color: edgeColor,
                    arrows: 'to',
                    dashes: false,
                    title: `${attacker} attacks ${assumption}\nType: Derived (${contrary})\nWeight: ${weight}`,
                    attackingElement: attacker,
                    targetAssumption: assumption,
                    contrary
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
                    title: `Joint attack: ${assumptionAttackers.join(', ')} → ${assumption}\nvia ${contrary}`,
                    font: {
                        color: GraphUtils.getFontColor(),
                        size: 25
                    },
                    isJunction: true,
                    attackers: assumptionAttackers,
                    target: assumption,
                    contrary
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
                        title: `${attacker} contributes to joint attack`,
                        attackingElement: attacker,
                        targetAssumption: assumption,
                        contrary
                    }));
                });

                const weight = getContraryWeight(weights, contrary);
                const edgeColor = { color: '#10b981', highlight: '#059669' };
                visEdges.push(createAttackEdge({
                    id: `${junctionId}-attacks-${assumption}`,
                    from: junctionId,
                    to: assumption,
                    label: weight === '?' ? '' : weight,
                    width: 2,
                    color: edgeColor,
                    arrows: 'to',
                    dashes: false,
                    title: `Joint attack on ${assumption}\nType: Joint Attack (${contrary})\nWeight: ${weight}`,
                    targetAssumption: assumption,
                    contrary
                }));
            }
        });
    });

    addFactBasedAttacks(visNodes, visEdges, factBasedAttacks);

    return {
        visNodes,
        visEdges,
        isolatedNodes: collectIsolatedAssumptions(assumptions, visEdges, { excludeFrom: ['⊤', 'junction_'] })
    };
}
