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

export function buildResetUpdates(networkData) {
    const nodes = networkData.nodes.get();
    const edges = networkData.edges.get();

    return {
        nodeUpdates: nodes.map((node) => ({
            id: node.id,
            color: node.originalColor || node.color,
            borderWidth: node.originalBorderWidth || 2
        })),
        edgeUpdates: edges.map((edge) => ({
            id: edge.id,
            color: edge.originalColor || edge.color,
            width: edge.originalWidth || edge.width || 2,
            dashes: edge.originalDashes || false,
            smooth: edge.originalSmooth || { enabled: true, type: 'cubicBezier', roundness: 0.5 }
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

    const nodeUpdates = nodes.flatMap((node) => {
        const nodeAssumptions = node.assumptions || [];
        const hasIn = inAssumptions.some((assumption) => nodeAssumptions.includes(assumption));

        if (!hasIn) {
            return [];
        }

        return [{
            id: node.id,
            color: {
                border: '#10b981',
                background: '#34d399',
                highlight: {
                    border: '#059669',
                    background: '#10b981'
                }
            },
            borderWidth: 4
        }];
    });

    const edgeUpdates = edges.map((edge) => {
        const discarded = discardedAttacks.find((attack) => edgeMatches(edge, attack.source, attack.via));
        if (discarded) {
            return {
                id: edge.id,
                color: { color: '#9ca3af', highlight: '#6b7280' },
                width: 3,
                dashes: [8, 4],
                smooth: { enabled: false }
            };
        }

        const successful = parsedSuccessful.find((attack) => edgeMatches(edge, attack.source, attack.target));
        if (successful) {
            return {
                id: edge.id,
                color: { color: '#ef4444', highlight: '#dc2626' },
                width: 2,
                dashes: false
            };
        }

        const originalColor = edge.originalColor || edge.color || '#9ca3af';
        return {
            id: edge.id,
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
