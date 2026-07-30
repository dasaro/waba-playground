import { appendStateChip } from './graph-tooltip-builder.js?v=20260730-42';
import { GraphUtils } from './graph-utils.js?v=20260730-42';

/**
 * The three attack states, each separable from the others on TWO non-hue channels, so the
 * encoding survives deuteranopia and greyscale.
 *
 *   lands      colour --graph-active     width x1.4   solid
 *   conceded   colour --graph-conceded   width x1.0   dashed
 *   dormant    colour --graph-dim        width x0.75  solid
 *
 * `conceded` is deliberately NOT grey. It is the attack this extension PAID FOR out of the
 * budget -- the whole point of the framework -- and it used to be drawn in the same grey as
 * inert scaffolding while being WIDER than an attack that actually lands, so the visual
 * hierarchy ranked the three states backwards.
 *
 * None of these writes `smooth`. Geometry belongs to assignEdgeGeometry and is fixed for the
 * lifetime of the graph: the discarded branch used to set `smooth: {enabled: false}`, so
 * conceding an attack straightened its curve while every neighbour stayed bowed -- an
 * unexplainable shape change on state, and a whole-graph geometry rebuild on every click.
 */
function stateStyle(state, baseWidth, p) {
    const w = baseWidth || 2;
    if (state === 'active') {
        return { color: { color: p.active, highlight: p.active, hover: p.active },
            width: w * 1.4, dashes: false };
    }
    if (state === 'conceded') {
        return { color: { color: p.conceded, highlight: p.conceded, hover: p.conceded },
            width: w, dashes: [9, 5] };
    }
    // dormant: opaque, never alpha. At 20% alpha two crossing dormant edges composited
    // BRIGHTER than a single one, so the least important thing on the canvas got emphasis
    // exactly where the picture was busiest.
    return { color: { color: p.dim, highlight: p.dim, hover: p.dim }, width: w * 0.75, dashes: false };
}
function parseSuccessfulAttacks(successfulAttacks) {
    return successfulAttacks.map((attack) => {
        const match = attack.match(/attacks_successfully_with_weight\(([^,]+),\s*([^,]+),\s*([^)]+)\)/);
        if (!match) {
            return null;
        }
        return {
            source: match[1],
            target: match[2],
            weight: match[3]
        };
    }).filter(Boolean);
}

function edgeMatches(edge, source, target) {
    const fromMatch = edge.contrary === source || edge.attackingElement === source;
    const toMatch = edge.to === target || edge.attackedAssumption === target || edge.targetAssumption === target;
    return fromMatch && toMatch;
}

// An attack edge is "active" in the selected extension when every assumption that
// must support its contrary is IN. Computed from the in-set directly, so it works
// even in projection mode, whose #show omits attacks_successfully_with_weight.
function attackSupportedByIn(edge, inSet) {
    if (edge.attackType === 'fact') {
        return true; // the contrary is supported by a fact, so the attack always launches
    }
    // Standard mode: the edge belongs to a SET, and it launches exactly when the selected
    // extension is that set. Its attackingElement is a derived atom rather than an assumption,
    // so the contributor test below could never be satisfied and no attack in the set graph
    // was ever drawn as active -- selecting an extension only ever dimmed things.
    if (Array.isArray(edge.sourceSetMembers)) {
        return edge.sourceSetMembers.length === inSet.size
            && edge.sourceSetMembers.every((assumption) => inSet.has(assumption));
    }
    const contributors = (Array.isArray(edge.jointWith) && edge.jointWith.length > 0)
        ? edge.jointWith
        : (edge.attackingElement ? [edge.attackingElement] : []);
    return contributors.length > 0 && contributors.every((assumption) => inSet.has(assumption));
}

// Inject a "State" row (Active / Discarded / Inactive) into an existing edge
// hover panel, right after its title. Returns the title unchanged if it is not a
// recognizable hover-panel string.
function withAttackState(baseTitle, label, tone) {
    return appendStateChip(baseTitle, label, tone);
}

function withNodeState(baseTitle, label, tone) {
    return appendStateChip(baseTitle, label, tone);
}

export function buildResetUpdates(networkData) {
    const nodes = networkData.nodes.get();
    const edges = networkData.edges.get();

    return {
        nodeUpdates: nodes.map((node) => ({
            id: node.id,
            color: node.originalColor || node.color,
            borderWidth: node.originalBorderWidth || 2,
            title: node.titleHtml !== undefined ? node.titleHtml : node.title
        })),
        // No `smooth` here: restoring it re-wrote the curvature ladder assignEdgeGeometry
        // computed, which is what let one discarded edge flatten and stay flat.
        edgeUpdates: edges.map((edge) => ({
            id: edge.id,
            color: edge.originalColor || edge.color,
            width: edge.originalWidth || edge.width || 2,
            dashes: edge.originalDashes || false,
            title: edge.titleHtml !== undefined ? edge.titleHtml : edge.title
        }))
    };
}

export function buildHighlightUpdates(networkData, inAssumptions, discardedAttacks, successfulAttacks) {
    // The EMPTY extension is a real extension -- under cf/admissible/complete it is always one,
    // and usually Answer 1. Bailing out here reset the canvas while output-manager had already
    // marked the row selected, so the UI said "selected" and the graph showed the unselected
    // state. Only a null/absent set means "nothing is selected".
    if (!inAssumptions) {
        return { resetOnly: true, nodeUpdates: [], edgeUpdates: [] };
    }

    const nodes = networkData.nodes.get();
    const edges = networkData.edges.get();
    const parsedSuccessful = parseSuccessfulAttacks(successfulAttacks);
    const inSet = new Set(inAssumptions);

    const p = GraphUtils.palette();
    const nodeUpdates = nodes.flatMap((node) => {
        const preserved = {
            // Preserve the pre-highlight color once so resetGraphColors can restore it
            // (the guard keeps the original across re-highlights without a reset).
            originalColor: node.originalColor || node.color,
            originalBorderWidth: node.originalBorderWidth || node.borderWidth || 2
        };
        const baseTitle = node.titleHtml !== undefined ? node.titleHtml : node.title;
        // IN is carried by a filled surface + the loudest achromatic border, not by a green
        // that already meant three other things (junction node, joint-attack edge, success).
        const accepted = {
            id: node.id,
            ...preserved,
            color: {
                background: p.surfaceIn,
                border: p.lineStrong,
                highlight: { background: p.surfaceIn, border: p.lineStrong }
            },
            borderWidth: 3
        };

        // Assumption-level nodes ARE a single assumption (node.id): colour by IN/OUT
        // membership. ⊤ and junction nodes have no in/out status, so leave them.
        if (node.isAssumption === true) {
            if (inSet.has(node.id)) {
                return [{ ...accepted, title: withNodeState(baseTitle, 'IN', 'in') }];
            }
            return [{
                id: node.id,
                ...preserved,
                color: {
                    background: p.canvas,
                    border: p.dim,
                    highlight: { background: p.canvas, border: p.dim }
                },
                borderWidth: 2,
                title: withNodeState(baseTitle, 'OUT', 'out')
            }];
        }

        // Standard-mode set nodes carry their members in node.assumptions. Highlight
        // ONLY the node whose members are EXACTLY the accepted set (the selected
        // extension) — not every set that merely shares an assumption with it.
        const members = node.assumptions || [];
        const isExactExtension = members.length === inAssumptions.length
            && members.every((assumption) => inSet.has(assumption));
        if (isExactExtension) {
            return [{ ...accepted, title: withNodeState(baseTitle, 'selected', 'in') }];
        }
        return [];
    });

    const edgeUpdates = edges.map((edge) => {
        // Preserve pre-highlight edge styling once so the reset can restore it.
        const preserved = {
            originalColor: edge.originalColor || edge.color,
            originalWidth: edge.originalWidth || edge.width || 2,
            originalDashes: edge.originalDashes !== undefined ? edge.originalDashes : (edge.dashes || false)
        };
        // The weight class the edge was built with -- state SCALES this rather than replacing
        // it, so a #sup attack stays visibly heavier than an ordinary one in every state.
        const baseWidth = edge.baseWidth || preserved.originalWidth;
        // Immutable base tooltip HTML string kept on the edge by graph-manager's
        // withElementTitle; restyle THIS (a string) so vis re-renders the tooltip as HTML.
        const baseTitle = edge.titleHtml !== undefined ? edge.titleHtml : edge.title;

        // Derivation (support) edges chain evidence -> intermediate claim -> contrary;
        // they are NOT attacks, so keep them at their original neutral styling instead
        // of fading them as "inactive". The active/inactive story is told by the attack
        // edges (red) and the IN/OUT colouring of the assumption nodes.
        // Derivation edges are not attacks, but they are not inert either: a support edge
        // whose leaves are all IN is CARRYING the derivation that launches an attack, and one
        // whose leaves are not is a branch that never fired. Branching mode exists to show
        // exactly that, and used to leave the entire derivation half unchanged on selection.
        if (edge.attackType === 'support') {
            const leaves = Array.isArray(edge.leafSet) ? edge.leafSet : null;
            const carrying = leaves === null || leaves.length === 0
                || leaves.every((leaf) => inSet.has(leaf));
            return {
                id: edge.id,
                ...preserved,
                color: carrying
                    ? { color: p.support, highlight: p.support, hover: p.support }
                    : { color: p.dim, highlight: p.dim, hover: p.dim },
                width: carrying ? 1.5 : 1,
                dashes: false,
                title: withAttackState(baseTitle, carrying ? 'carrying' : 'not carrying',
                    carrying ? 'active' : 'out')
            };
        }

        // A concession belongs to the set that made it. In the set graph the same attack is
        // drawn once per attacking set, and matching on (attacker, target) alone dashed every
        // one of them -- so conceding a single attack made half the canvas look paid-for.
        const ownsTheConcession = !Array.isArray(edge.sourceSetMembers)
            || (edge.sourceSetMembers.length === inSet.size
                && edge.sourceSetMembers.every((assumption) => inSet.has(assumption)));
        const discarded = ownsTheConcession
            && discardedAttacks.find((attack) => edgeMatches(edge, attack.source, attack.via));
        if (discarded) {
            return {
                id: edge.id,
                ...preserved,
                title: withAttackState(baseTitle,
                    discarded.weight !== undefined && discarded.weight !== null
                        ? `conceded, weight ${discarded.weight}`
                        : 'conceded',
                    'discarded'),
                ...stateStyle('conceded', baseWidth, p)
            };
        }

        // Active iff clingo reports the attack successful (standard mode emits it) OR
        // its supporting assumptions are all IN (works in projection mode too).
        const successful = parsedSuccessful.some((attack) => edgeMatches(edge, attack.source, attack.target))
            || attackSupportedByIn(edge, inSet);
        if (successful) {
            return {
                id: edge.id,
                ...preserved,
                title: withAttackState(baseTitle, 'lands', 'active'),
                ...stateStyle('active', baseWidth, p)
            };
        }

        return {
            id: edge.id,
            ...preserved,
            title: withAttackState(baseTitle, 'never launched', 'out'),
            ...stateStyle('dormant', baseWidth, p)
        };
    });

    return { resetOnly: false, nodeUpdates, edgeUpdates };
}

export function renderIsolatedAssumptionsOverlay(banner, list, isolatedNodes) {
    if (!banner || !list) {
        return;
    }

    if (isolatedNodes.length > 0) {
        const labels = isolatedNodes.map((node) => node.label || node.id);
        list.textContent = labels.join(', ');
        banner.removeAttribute('hidden');
        return;
    }

    banner.setAttribute('hidden', '');
}
