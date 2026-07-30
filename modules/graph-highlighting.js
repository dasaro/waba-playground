import { appendStateChip } from './graph-tooltip-builder.js?v=20260730-18';
function colorToRGBA(color, opacity = 0.3) {
    if (typeof color === 'object' && color.color) {
        color = color.color;
    }

    const rgbaMatch = typeof color === 'string' && color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbaMatch) {
        return `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, ${opacity})`;
    }

    if (typeof color === 'string' && color.startsWith('#')) {
        const hex = color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    return `rgba(156, 163, 175, ${opacity})`;
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
        edgeUpdates: edges.map((edge) => ({
            id: edge.id,
            color: edge.originalColor || edge.color,
            width: edge.originalWidth || edge.width || 2,
            dashes: edge.originalDashes || false,
            smooth: edge.originalSmooth || { enabled: true, type: 'cubicBezier', roundness: 0.5 },
            title: edge.titleHtml !== undefined ? edge.titleHtml : edge.title
        }))
    };
}

export function buildHighlightUpdates(networkData, inAssumptions, discardedAttacks, successfulAttacks) {
    if (!inAssumptions || inAssumptions.length === 0) {
        return { resetOnly: true, nodeUpdates: [], edgeUpdates: [] };
    }

    const nodes = networkData.nodes.get();
    const edges = networkData.edges.get();
    const parsedSuccessful = parseSuccessfulAttacks(successfulAttacks);
    const inSet = new Set(inAssumptions);

    const nodeUpdates = nodes.flatMap((node) => {
        const preserved = {
            // Preserve the pre-highlight color once so resetGraphColors can restore it
            // (the guard keeps the original across re-highlights without a reset).
            originalColor: node.originalColor || node.color,
            originalBorderWidth: node.originalBorderWidth || node.borderWidth || 2
        };
        const baseTitle = node.titleHtml !== undefined ? node.titleHtml : node.title;
        const accepted = {
            id: node.id,
            ...preserved,
            color: { border: '#10b981', background: '#34d399', highlight: { border: '#059669', background: '#10b981' } },
            borderWidth: 4
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
                color: { border: '#64748b', background: '#94a3b8', highlight: { border: '#475569', background: '#64748b' } },
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
            originalDashes: edge.originalDashes !== undefined ? edge.originalDashes : (edge.dashes || false),
            originalSmooth: edge.originalSmooth || edge.smooth || { enabled: true, type: 'cubicBezier', roundness: 0.5 }
        };
        // Immutable base tooltip HTML string kept on the edge by graph-manager's
        // withElementTitle; restyle THIS (a string) so vis re-renders the tooltip as HTML.
        const baseTitle = edge.titleHtml !== undefined ? edge.titleHtml : edge.title;

        // Derivation (support) edges chain evidence -> intermediate claim -> contrary;
        // they are NOT attacks, so keep them at their original neutral styling instead
        // of fading them as "inactive". The active/inactive story is told by the attack
        // edges (red) and the IN/OUT colouring of the assumption nodes.
        if (edge.attackType === 'support') {
            return {
                id: edge.id,
                ...preserved,
                color: preserved.originalColor,
                width: preserved.originalWidth,
                dashes: preserved.originalDashes,
                smooth: preserved.originalSmooth,
                title: baseTitle
            };
        }

        const discarded = discardedAttacks.find((attack) => edgeMatches(edge, attack.source, attack.via));
        if (discarded) {
            return {
                id: edge.id,
                ...preserved,
                title: withAttackState(baseTitle,
                    discarded.weight !== undefined && discarded.weight !== null
                        ? `discarded, ${discarded.weight} charged`
                        : 'discarded',
                    'discarded'),
                color: { color: '#9ca3af', highlight: '#6b7280' },
                width: 3,
                dashes: [8, 4],
                smooth: { enabled: false }
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
                title: withAttackState(baseTitle, 'active', 'active'),
                color: { color: '#ef4444', highlight: '#dc2626' },
                width: 2,
                dashes: false
            };
        }

        const originalColor = preserved.originalColor || '#9ca3af';
        return {
            id: edge.id,
            ...preserved,
            title: withAttackState(baseTitle, 'inactive', 'out'),
            color: {
                color: colorToRGBA(originalColor, 0.2),
                highlight: colorToRGBA(originalColor, 0.4)
            }
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
