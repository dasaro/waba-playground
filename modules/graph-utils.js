/**
 * GraphUtils - Shared utilities for graph visualization
 * Provides common node/edge styling and data transformation functions
 */
export class GraphUtils {
    /**
     * Create color scheme for a node based on type and state
     * @param {string} type - Node type ('assumption', 'element', 'set', 'empty-set', 'attacking-set')
     * @param {boolean} isIn - Whether node is "in" (selected)
     * @param {boolean} isSupported - Whether node is supported
     * @returns {Object} - vis.js color object
     */
    static createNodeColor(type, isIn = false, isSupported = false) {
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
                gravitationalConstant: -2000,  // Reduced for less movement
                centralGravity: 0.1,  // Reduced central pull
                springLength: 250,  // Longer springs for better spread
                springConstant: 0.04,  // Weaker springs
                damping: 0.7,  // Higher damping to stop movement faster
                avoidOverlap: 0.5  // Stronger overlap avoidance
            },
            stabilization: {
                enabled: true,
                iterations: quickMode ? 150 : 500,  // More iterations for better layout
                updateInterval: 25,
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
        return {
            nodes: {
                shape: 'dot',
                font: {
                    size: 14,
                    color: GraphUtils.getFontColor(),
                    vadjust: 0  // Center label vertically inside node
                },
                borderWidth: 2,
                shadow: {
                    enabled: true,
                    color: 'rgba(0,0,0,0.15)',
                    size: 8,
                    x: 2,
                    y: 2
                }
            },
            edges: {
                arrows: {
                    to: {
                        enabled: true,
                        scaleFactor: 0.8
                    }
                },
                font: {
                    size: 12,
                    align: 'middle',
                    ...GraphUtils.getEdgeFontColor()
                },
                smooth: {
                    enabled: true,
                    type: 'cubicBezier',
                    roundness: 0.5
                },
                shadow: {
                    enabled: false
                }
            },
            physics: {
                enabled: false  // Start with physics disabled for semi-static behavior
            },
            interaction: {
                hover: true,
                tooltipDelay: 200,
                hideEdgesOnDrag: false,
                hideEdgesOnZoom: false,
                dragNodes: true,  // Allow dragging
                dragView: true  // Allow panning the view
            }
        };
    }
}
