/**
 * GraphManager - Handles graph visualization using vis.js
 * Note: This is a simplified version. Full graph update logic remains in app.js temporarily.
 */
import { GraphUtils } from './graph-utils.js';
import { ParserUtils } from './parser-utils.js';

export class GraphManager {
    constructor(graphCanvas, resetLayoutBtn) {
        this.graphCanvas = graphCanvas;
        this.resetLayoutBtn = resetLayoutBtn;
        this.network = null;
        this.networkData = { nodes: null, edges: null };
        this.isolatedNodes = [];
        this.currentFrameworkCode = '';
        this.currentGraphMode = 'standard';
    }

    /**
     * Convert color to RGBA with specified opacity
     * @param {string|object} color - Color in hex, rgb, or vis.js object format
     * @param {number} opacity - Opacity value (0-1)
     * @returns {string} RGBA color string
     */
    colorToRGBA(color, opacity = 0.3) {
        // Handle vis.js color object
        if (typeof color === 'object' && color.color) {
            color = color.color;
        }

        // If already RGBA, extract RGB and replace opacity
        const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (rgbaMatch) {
            return `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, ${opacity})`;
        }

        // Handle hex color
        if (color.startsWith('#')) {
            const hex = color.replace('#', '');
            const r = parseInt(hex.substr(0, 2), 16);
            const g = parseInt(hex.substr(2, 2), 16);
            const b = parseInt(hex.substr(4, 2), 16);
            return `rgba(${r}, ${g}, ${b}, ${opacity})`;
        }

        // Fallback to gray if color format is unknown
        return `rgba(156, 163, 175, ${opacity})`;
    }

    initGraph() {
        // Initialize vis.js DataSets
        this.networkData.nodes = new vis.DataSet([]);
        this.networkData.edges = new vis.DataSet([]);

        // Create the network
        const options = GraphUtils.getNetworkOptions();
        this.network = new vis.Network(this.graphCanvas, this.networkData, options);

        // Add reset layout button handler
        if (this.resetLayoutBtn) {
            this.resetLayoutBtn.addEventListener('click', () => {
                this.resetGraphColors();  // Reset colors first
                this.runGraphLayout(false);  // Then re-layout
            });
        }

        console.log('Graph initialized with vis.js');
    }

    setupEventListeners(onNodeClick, onEdgeClick) {
        if (!this.network) return;

        // Handle clicks on nodes and edges
        this.network.on('click', (params) => {
            // Get canvas element position to convert to screen coordinates
            const canvasRect = this.graphCanvas.getBoundingClientRect();
            const screenX = canvasRect.left + params.pointer.DOM.x;
            const screenY = canvasRect.top + params.pointer.DOM.y;

            if (params.nodes.length > 0) {
                // Clicked on a node
                const nodeId = params.nodes[0];
                const node = this.networkData.nodes.get(nodeId);
                console.log('Node clicked:', node);
                if (onNodeClick) {
                    onNodeClick(node, screenX, screenY);
                }
            } else if (params.edges.length > 0) {
                // Clicked on an edge
                const edgeId = params.edges[0];
                const edge = this.networkData.edges.get(edgeId);
                console.log('Edge clicked:', edge);
                if (onEdgeClick) {
                    onEdgeClick(edge, screenX, screenY);
                }
            }
        });

        // Prevent physics from re-enabling during drag
        this.network.on('dragStart', () => {
            this.network.setOptions({ physics: { enabled: false } });
        });

        this.network.on('dragEnd', () => {
            // Ensure physics stays disabled after drag
            this.network.setOptions({ physics: { enabled: false } });
        });

        // Prevent stabilization from re-enabling physics
        this.network.on('stabilizationIterationsDone', () => {
            this.network.setOptions({ physics: { enabled: false } });
        });
    }

    runGraphLayout(quickMode = false) {
        if (!this.network) return;

        const options = GraphUtils.getLayoutOptions(quickMode);
        this.network.setOptions({ physics: options });

        // Stop physics after stabilization for semi-static behavior
        this.network.once('stabilizationIterationsDone', () => {
            this.network.setOptions({ physics: { enabled: false } });
            console.log('Graph layout complete - physics disabled');
        });
    }

    triggerInitialLayout() {
        // Trigger initial layout when graph data is loaded
        if (!this.network) return;
        this.runGraphLayout(false);
    }

    resetGraphColors() {
        if (!this.network) return;

        console.log('Resetting graph colors...');

        // Reset all nodes to original colors
        const nodes = this.networkData.nodes.get();
        const nodeUpdates = nodes.map(node => ({
            id: node.id,
            color: node.originalColor || node.color,
            borderWidth: node.originalBorderWidth || 2
        }));
        this.networkData.nodes.update(nodeUpdates);

        // Reset all edges to original colors, widths, dashes, and smooth curves
        const edges = this.networkData.edges.get();
        const edgeUpdates = edges.map(edge => ({
            id: edge.id,
            color: edge.originalColor || edge.color,
            width: edge.originalWidth || edge.width || 2,
            dashes: edge.originalDashes || false,
            smooth: edge.originalSmooth || { enabled: true, type: 'cubicBezier', roundness: 0.5 }
        }));
        this.networkData.edges.update(edgeUpdates);

        console.log(`Reset ${nodeUpdates.length} nodes and ${edgeUpdates.length} edges`);
    }

    highlightExtension(inAssumptions, discardedAttacks, successfulAttacks) {
        console.log('🔍 [highlightExtension] CALLED');

        if (!this.network) {
            console.error('❌ [highlightExtension] Network not initialized!');
            return;
        }

        console.log('=== HIGHLIGHTING EXTENSION ===');
        console.log('In assumptions:', inAssumptions);
        console.log('Discarded attacks:', discardedAttacks);
        console.log('Discarded attacks detail:', discardedAttacks.map(da => `${da.source} → ${da.via} (weight: ${da.weight})`));
        console.log('Successful attacks:', successfulAttacks);

        // Note: Reset is now handled by caller (output-manager.js) to avoid double-reset

        // Get all nodes and edges
        const nodes = this.networkData.nodes.get();
        const edges = this.networkData.edges.get();
        console.log(`Total edges in graph: ${edges.length}`);

        // Highlight nodes that match "in" assumptions
        const nodeUpdates = [];
        nodes.forEach(node => {
            const nodeAssumptions = node.assumptions || [];
            const hasIn = inAssumptions.some(a => nodeAssumptions.includes(a));

            if (hasIn) {
                nodeUpdates.push({
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
                });
            }
        });

        if (nodeUpdates.length > 0) {
            this.networkData.nodes.update(nodeUpdates);
            console.log(`Highlighted ${nodeUpdates.length} nodes`);
        }

        // Parse successful attacks from string format
        const parsedSuccessful = successfulAttacks.map(attack => {
            const match = attack.match(/attacks_successfully_with_weight\(([^,]+),\s*([^,]+),\s*([^)]+)\)/);
            if (match) {
                return {
                    source: match[1],      // attacking element
                    target: match[2],      // attacked assumption
                    weight: match[3]
                };
            }
            return null;
        }).filter(a => a !== null);
        console.log('Parsed successful attacks:', parsedSuccessful);

        // Highlight edges - unified matching logic
        const edgeUpdates = [];
        let discardedCount = 0;
        let successfulCount = 0;

        edges.forEach(edge => {
            console.log(`Checking edge ${edge.id}:`, {
                from: edge.from,
                to: edge.to,
                attackingElement: edge.attackingElement,
                contrary: edge.contrary,
                attackedAssumption: edge.attackedAssumption,
                targetAssumption: edge.targetAssumption
            });

            let matched = false;

            // Check for discarded attack match
            for (const da of discardedAttacks) {
                // For assumption-level modes, the contrary property stores the attacking element
                // For standard mode, attackingElement IS the attacking element
                const contraryMatch = edge.contrary === da.source;
                const attackingMatch = edge.attackingElement === da.source;
                const fromMatch = contraryMatch || attackingMatch;
                const toMatch = edge.to === da.via || edge.attackedAssumption === da.via || edge.targetAssumption === da.via;

                console.log(`  Checking discarded ${da.source} → ${da.via}:`, {
                    'edge.contrary': edge.contrary,
                    'da.source': da.source,
                    'contraryMatch': contraryMatch,
                    'attackingMatch': attackingMatch,
                    'fromMatch': fromMatch,
                    'toMatch': toMatch
                });

                if (fromMatch && toMatch) {
                    console.log(`  ✓ MATCHED DISCARDED: ${da.source} → ${da.via}`);
                    edgeUpdates.push({
                        id: edge.id,
                        color: { color: '#9ca3af', highlight: '#6b7280' },
                        width: 3,  // Slightly thicker for visibility
                        dashes: [8, 4],  // Longer dashes for better visibility
                        smooth: { enabled: false }  // Disable smooth curves for dashed lines to make pattern clearer
                    });
                    discardedCount++;
                    matched = true;
                    return; // Skip checking successful
                }
            }

            // Check for successful attack match
            for (const sa of parsedSuccessful) {
                // For assumption-level modes, the contrary property stores the attacking element
                // For standard mode, attackingElement IS the attacking element
                const fromMatch = edge.contrary === sa.source || edge.attackingElement === sa.source;
                const toMatch = edge.to === sa.target || edge.attackedAssumption === sa.target || edge.targetAssumption === sa.target;

                console.log(`  Checking successful ${sa.source} → ${sa.target}: fromMatch=${fromMatch}, toMatch=${toMatch}`);

                if (fromMatch && toMatch) {
                    console.log(`  ✓ MATCHED SUCCESSFUL: ${sa.source} → ${sa.target}`);
                    edgeUpdates.push({
                        id: edge.id,
                        color: { color: '#ef4444', highlight: '#dc2626' },
                        width: 2,  // Thin line
                        dashes: false  // Solid line for successful attacks
                    });
                    successfulCount++;
                    matched = true;
                    return;
                }
            }

            if (!matched) {
                console.log(`  ✗ No match for this edge`);
                // Dim non-matched edges by reducing opacity of original color
                const originalColor = edge.originalColor || edge.color || '#9ca3af';
                const dimmedColor = this.colorToRGBA(originalColor, 0.2);
                const dimmedHighlight = this.colorToRGBA(originalColor, 0.4);
                edgeUpdates.push({
                    id: edge.id,
                    color: { color: dimmedColor, highlight: dimmedHighlight }
                });
            }
        });

        console.log(`Highlighting: ${discardedCount} discarded, ${successfulCount} successful attacks`);

        if (edgeUpdates.length > 0) {
            console.log('📊 [highlightExtension] Updating edges with new styles...');
            this.networkData.edges.update(edgeUpdates);
            console.log('✅ [highlightExtension] Edge updates applied successfully');
        } else {
            console.warn('⚠️ [highlightExtension] No edge updates to apply');
        }

        console.log('=== HIGHLIGHTING COMPLETE ===');
    }

    updateIsolatedAssumptionsOverlay() {
        console.log('🏝️ [updateIsolatedAssumptionsOverlay] CALLED');
        const banner = document.getElementById('isolated-assumptions-banner');
        const list = document.getElementById('isolated-assumptions-list');

        console.log('Banner element:', banner ? 'found' : 'NOT FOUND');
        console.log('List element:', list ? 'found' : 'NOT FOUND');

        if (!banner || !list) {
            console.error('❌ [updateIsolatedAssumptionsOverlay] Required elements not found in DOM');
            return;
        }

        console.log('Isolated nodes count:', this.isolatedNodes.length);
        console.log('Isolated nodes:', this.isolatedNodes);

        if (this.isolatedNodes.length > 0) {
            const labels = this.isolatedNodes.map(n => n.label || n.id);
            console.log('📋 [updateIsolatedAssumptionsOverlay] Setting labels:', labels);
            list.textContent = labels.join(', ');
            banner.removeAttribute('hidden');
            console.log('✅ [updateIsolatedAssumptionsOverlay] Banner shown with', labels.length, 'items');
        } else {
            banner.setAttribute('hidden', '');
            console.log('✅ [updateIsolatedAssumptionsOverlay] Banner hidden (no isolated nodes)');
        }
    }

    // Note: The full graph update methods (updateGraphStandard, updateGraphAssumptionLevelDirect,
    // updateGraphAssumptionLevelBranching) are very large (~1500 lines total).
    // For now, these remain in app.js. They can be migrated here in a future refactoring.
    // The key infrastructure (initGraph, layout, highlighting) is now in this module.
}
