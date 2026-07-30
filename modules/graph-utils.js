/**
 * GraphUtils - Shared utilities for graph visualization
 * Provides common node/edge styling and data transformation functions
 */
/**
 * Graph roles, resolved from the app's own CSS custom properties.
 *
 * Every colour the graph used to draw with was a hex literal inside modules/graph-*.js, so the
 * graph had a private palette that no theme switch could reach: flipping to the light theme
 * recoloured the page around a diagram that stayed dark-tuned. These read the real tokens, so
 * one palette governs both.
 *
 * Only the roles the app genuinely lacks are new (--graph-conceded, --graph-dim,
 * --graph-support); the rest derive from --bg-secondary / --text-* / --border-color /
 * --error-color, which style.css already defines for both themes.
 */
const GRAPH_ROLES = {
    canvas: '--graph-canvas',
    surface: '--graph-surface',
    surfaceIn: '--graph-surface-in',
    ink: '--graph-ink',
    inkDim: '--graph-ink-dim',
    line: '--graph-line',
    lineStrong: '--graph-line-strong',
    dim: '--graph-dim',
    support: '--graph-support',
    active: '--graph-active',
    conceded: '--graph-conceded'
};

export class GraphUtils {
    /**
     * Resolve the graph palette for the current theme. Cached per theme so a render that
     * styles hundreds of edges does not run getComputedStyle hundreds of times.
     */
    static palette() {
        // The builders are pure functions over a framework and are unit-tested in Node, where
        // there is no document to read tokens from. Fall back to the dark values rather than
        // throwing: a module that only works inside a browser cannot be tested as a module.
        if (typeof document === 'undefined' || typeof getComputedStyle === 'undefined') {
            return GraphUtils.FALLBACK_PALETTE;
        }
        const theme = document.documentElement.getAttribute('data-theme') || 'dark';
        if (GraphUtils._paletteCache && GraphUtils._paletteCache.theme === theme) {
            return GraphUtils._paletteCache.value;
        }
        const style = getComputedStyle(document.documentElement);
        const value = {};
        for (const [role, token] of Object.entries(GRAPH_ROLES)) {
            value[role] = style.getPropertyValue(token).trim() || '#94a3b8';
        }
        GraphUtils._paletteCache = { theme, value };
        return value;
    }

    /**
     * Mirror of the dark :root values in style.css, for the headless case only. If these drift
     * from the stylesheet nothing user-visible changes -- the browser always reads the real
     * tokens -- so this is a test-environment shim, not a second source of truth.
     */
    static FALLBACK_PALETTE = {
        canvas: '#0f172a',
        surface: '#1b2740',
        surfaceIn: '#33456b',
        ink: '#e2e8f0',
        inkDim: '#8494ad',
        line: '#7c8ba6',
        lineStrong: '#dbe4f0',
        dim: '#475569',
        support: '#6b7d99',
        active: '#f87171',
        conceded: '#c084fc'
    };

    /** Drop the cache when the theme flips. */
    static invalidatePalette() {
        GraphUtils._paletteCache = null;
    }

    /**
     * Base line width, by weight class. Width is the ONLY channel that carries weight class;
     * the parallel colour encoding it used to have (#ff6b6b / #888 / #f59e0b) was pure
     * redundancy, and it spent hue that the three attack states need.
     */
    static baseWidthForWeight(weight) {
        if (weight === Infinity || weight === '#sup') return 3;
        if (weight === -Infinity || weight === '#inf') return 1.5;
        return 2;
    }

    /**
     * Assign edge GEOMETRY in one pass, after all edges are built.
     *
     * Two defects are fixed here, and both are geometry rather than styling:
     *
     * 1. Parallel edges overlapped EXACTLY. getNetworkOptions pinned one `smooth` object for
     *    the whole graph, so two edges between the same ordered pair traced the same path and
     *    the one underneath was invisible -- and unclickable, since vis hit-tests the first
     *    match. Each edge now gets its own roundness, stepped within its ordered-pair bucket,
     *    so a bundle nests like contour lines.
     *
     * 2. Mutual attacks (A->B and B->A) collapsed onto one line with an arrowhead at each end,
     *    losing one of the two weights. They sit in DIFFERENT buckets and both take the base
     *    roundness; because curvedCW always bows to the left of travel, left-of-A->B and
     *    left-of-B->A are opposite absolute sides, so they separate for free.
     *
     * Self-loops get an angle ladder for the same reason: vis places every self-loop of a node
     * at one fixed angle and a fixed 20px radius, so a node with three self-attacks showed one
     * stub and hid two -- in the set graph that stub is the "not conflict-free" signal.
     */
    static assignEdgeGeometry(edges) {
        const CURVE_BASE = 0.15;
        const CURVE_STEP = 0.13;
        const buckets = new Map();
        const loops = new Map();

        edges.forEach((edge) => {
            if (edge.from === edge.to) {
                const k = loops.get(edge.from) || 0;
                loops.set(edge.from, k + 1);
                // Fan co-terminal loops around the node instead of stacking them, and scale the
                // loop with the node so it is not a 20px scratch on a wide box.
                edge.selfReference = {
                    size: 26,
                    angle: Math.PI / 4 + k * (Math.PI / 3),
                    renderBehindTheNode: false
                };
                return;
            }
            const key = `${edge.from}\u0000${edge.to}`;
            const k = buckets.get(key) || 0;
            buckets.set(key, k + 1);
            // One handedness for the whole graph: curvedCCW's sag saturates around roundness
            // 0.5 and then DECREASES, so a symmetric ladder built from both families would not
            // be monotonic. A uniform gentle swirl is also what makes crossings traceable.
            edge.smooth = {
                enabled: true,
                type: 'curvedCW',
                roundness: CURVE_BASE + k * CURVE_STEP
            };
        });
        return edges;
    }

    /**
     * Create color scheme for a node based on type and state
     * @param {string} type - Node type ('assumption', 'element', 'set', 'empty-set', 'attacking-set')
     * @returns {Object} - vis.js color object
     */
    static createNodeColor(type) {
        if (type === 'assumption' || type === 'set') {
            // Standard assumption/set colors
            return {
                border: '#5568d3',
                background: '#667eea',
                highlight: {
                    border: '#4557c2',
                    background: '#5568d3'
                }
            };
        } else if (type === 'element') {
            // Derived elements
            return {
                border: '#10b981',
                background: '#34d399',
                highlight: {
                    border: '#059669',
                    background: '#10b981'
                }
            };
        } else if (type === 'attacking-set') {
            return {
                border: '#ef4444',
                background: '#f87171',
                highlight: {
                    border: '#dc2626',
                    background: '#ef4444'
                }
            };
        } else if (type === 'empty-set') {
            return {
                border: '#94a3b8',
                background: '#cbd5e1',
                highlight: {
                    border: '#64748b',
                    background: '#94a3b8'
                }
            };
        }

        // Default color
        return {
            border: '#cbd5e1',
            background: '#e2e8f0',
            highlight: {
                border: '#94a3b8',
                background: '#cbd5e1'
            }
        };
    }

    /**
     * Create edge styling based on weight
     * @param {number|string} weight - Edge weight (can be Infinity, -Infinity, or number)
     * @returns {Object} - {color, width, displayWeight}
     */
    static createEdgeStyle(weight) {
        let displayWeight;
        let width;
        let color;

        if (weight === Infinity) {
            displayWeight = '#sup';
            width = 5;
            color = '#ff6b6b';
        } else if (weight === -Infinity) {
            displayWeight = '#inf';
            width = 1;
            color = '#888';
        } else if (typeof weight === 'number') {
            displayWeight = weight.toString();
            width = 2;
            color = '#f59e0b';
        } else {
            // Handle string weights (like "#sup", "#inf")
            displayWeight = weight;
            width = weight === '#sup' ? 5 : (weight === '#inf' ? 1 : 2);
            color = weight === '#sup' ? '#ff6b6b' : (weight === '#inf' ? '#888' : '#f59e0b');
        }

        return {
            color: { color, highlight: color },
            width,
            displayWeight
        };
    }

    /**
     * Parse weight string to number (handles #sup, #inf)
     * @param {string} weightStr - Weight string from Clingo output
     * @returns {number} - Numeric weight (Infinity or -Infinity for special values)
     */
    static parseWeight(weightStr) {
        if (weightStr === '#sup') {
            return Infinity;
        } else if (weightStr === '#inf') {
            return -Infinity;
        } else {
            return parseInt(weightStr);
        }
    }

    /**
     * Get current theme (dark or light)
     * @returns {boolean} - true if dark theme
     */
    static isDarkTheme() {
        if (typeof document === 'undefined') return true;
        return document.documentElement.getAttribute('data-theme') !== 'light';
    }

    /**
     * Get font color for current theme
     * @returns {string} - Font color hex code
     */
    static getFontColor() {
        return GraphUtils.isDarkTheme() ? '#f1f5f9' : '#1e293b';
    }

    /**
     * Get edge font color for current theme
     * @returns {Object} - {color, background, strokeWidth, strokeColor}
     */
    static getEdgeFontColor() {
        const isDark = GraphUtils.isDarkTheme();
        return {
            color: isDark ? '#ffffff' : '#1e293b',  // White in dark mode, dark in light mode
            background: 'transparent',
            strokeWidth: isDark ? 3 : 0,  // Border in dark mode for contrast
            strokeColor: isDark ? '#1e293b' : 'transparent'
        };
    }

    /**
     * Filter isolated nodes (nodes with no edges)
     * @param {Array} nodes - Array of node data objects
     * @param {Array} edges - Array of edge data objects
     * @returns {Object} - {connectedNodes, isolatedNodes}
     */
    static filterIsolatedNodes(nodes, edges) {
        const nodesWithEdges = new Set();
        edges.forEach(edge => {
            nodesWithEdges.add(edge.from || edge.source);
            nodesWithEdges.add(edge.to || edge.target);
        });

        const connectedNodes = [];
        const isolatedNodes = [];

        nodes.forEach(node => {
            const nodeId = node.id || node.data?.id;
            if (nodesWithEdges.has(nodeId)) {
                connectedNodes.push(node);
            } else {
                isolatedNodes.push(node);
            }
        });

        return { connectedNodes, isolatedNodes };
    }

    /**
     * Create default layout options for vis.js network
     * @param {boolean} quickMode - Use quick mode (less iterations)
     * @returns {Object} - vis.js layout options
     */
    static getLayoutOptions(quickMode = false) {
        return {
            enabled: true,
            timestep: 0.5,
            maxVelocity: quickMode ? 100 : 50,
            minVelocity: 0.75,
            solver: 'barnesHut',
            barnesHut: {
                gravitationalConstant: -3500,  // was -2000: nodes drifted to the canvas edge
                centralGravity: 0.25,          // was 0.1
                springLength: 200,             // boxes are <=150 wide, so this is ~50px apart
                springConstant: 0.05,
                damping: 0.55,
                // Only meaningful now that shape:'box' makes the declared size real -- with
                // `circle`, repulsion was computed from a size vis had already overwritten.
                avoidOverlap: 1
            },
            stabilization: {
                enabled: true,
                // The quick path is what every user actually sees (applyGraphData always asks
                // for it); the good settings were reachable only via a Reset Layout button most
                // people never find. So the gap is now small.
                iterations: quickMode ? 350 : 600,
                updateInterval: 50,
                onlyDynamicEdges: false,
                fit: true
            }
        };
    }

    /**
     * Create network options for vis.js
     * @returns {Object} - vis.js network options
     */
    static getNetworkOptions() {
        const p = GraphUtils.palette();
        return {
            nodes: {
                // `circle` is in vis's label-INSIDE family: it recomputes size from the
                // rendered label on every resize, so the declared `size` was inert and node
                // AREA -- the strongest pre-attentive channel on the canvas -- encoded nothing
                // but name length (obs_extinction_pattern was ~3.5x obs_iridium for no reason).
                // It also desynchronised barnesHut.avoidOverlap, which repels using that stale
                // size, which is why boxes sat on each other's labels.
                shape: 'box',
                widthConstraint: { minimum: 84, maximum: 150 },
                heightConstraint: { minimum: 34 },
                margin: { top: 8, bottom: 8, left: 12, right: 12 },
                font: {
                    size: 13,
                    color: p.ink,
                    face: 'inherit',
                    align: 'center'
                },
                color: {
                    background: p.surface,
                    border: p.line,
                    highlight: { background: p.surface, border: p.lineStrong },
                    hover: { background: p.surface, border: p.lineStrong }
                },
                borderWidth: 2,
                shadow: false
            },
            edges: {
                arrows: {
                    // 15*scaleFactor + 3*width, so 0.8 gave an 18px head against a ~24px node
                    // half-height -- heads bit into the junction diamonds and fused with each
                    // other on arrival. The `from` dot means an edge occluded by a node can
                    // never be mistaken for two shorter edges.
                    to: { enabled: true, type: 'arrow', scaleFactor: 0.5 },
                    from: { enabled: true, type: 'circle', scaleFactor: 0.22 }
                },
                font: {
                    // Bigger and brighter than the line it sits on: at --graph-line/12px the
                    // digits read as marks the edge passes through rather than as a value, and
                    // a weight is the one number on the canvas.
                    size: 13,
                    color: p.inkDim,
                    face: 'inherit',
                    // Upright, on an opaque chip. `align: 'middle'` rotated the label to follow
                    // the edge, so a weight of 8 rendered sideways as a convincing infinity
                    // sign -- and #inf/#sup are real, different values in this app.
                    align: 'horizontal',
                    background: p.canvas,
                    strokeWidth: 0
                },
                color: { color: p.line, highlight: p.lineStrong, hover: p.lineStrong },
                width: 2,
                // Per-edge geometry is assigned by assignEdgeGeometry(); this is only the
                // fallback for an edge that somehow skipped it.
                smooth: { enabled: true, type: 'curvedCW', roundness: 0.15 },
                selectionWidth: 2,
                shadow: false
            },
            physics: {
                enabled: false,
                stabilization: { enabled: false }
            },
            interaction: {
                hover: true,
                tooltipDelay: 200,
                hideEdgesOnDrag: false,
                hideEdgesOnZoom: false,
                dragNodes: true,
                dragView: true,
                zoomView: true,
                // An overlapped 2px line is nearly impossible to hit; give the pointer some room.
                hoverConnectedEdges: false,
                selectConnectedEdges: false
            },
            manipulation: { enabled: false }
        };
    }
}
