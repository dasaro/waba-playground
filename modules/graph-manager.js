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
                this.runGraphLayout(false);
            });
        }

        console.log('Graph initialized with vis.js');
    }

    runGraphLayout(quickMode = false) {
        if (!this.network) return;

        const options = GraphUtils.getLayoutOptions(quickMode);
        this.network.setOptions({ physics: options });

        // Stop physics after stabilization
        this.network.once('stabilizationIterationsDone', () => {
            this.network.setOptions({ physics: { enabled: false } });
        });
    }

    resetGraphColors() {
        if (!this.network) return;

        // Reset all nodes to original colors
        const nodes = this.networkData.nodes.get();
        const nodeUpdates = nodes.map(node => ({
            id: node.id,
            color: node.originalColor || node.color,
            borderWidth: 2
        }));
        this.networkData.nodes.update(nodeUpdates);

        // Reset all edges to original colors and widths
        const edges = this.networkData.edges.get();
        const edgeUpdates = edges.map(edge => ({
            id: edge.id,
            color: edge.originalColor || edge.color,
            width: edge.originalWidth || edge.width
        }));
        this.networkData.edges.update(edgeUpdates);
    }

    highlightExtension(inAssumptions, discardedAttacks, successfulAttacks) {
        if (!this.network) return;

        console.log('Highlighting extension:', { inAssumptions, discardedAttacks, successfulAttacks });

        // Reset colors first
        this.resetGraphColors();

        // Get all nodes and edges
        const nodes = this.networkData.nodes.get();
        const edges = this.networkData.edges.get();

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

        // Highlight edges - unified matching logic for all graph modes
        const edgeUpdates = [];
        edges.forEach(edge => {
            // Helper function to check if edge matches an attack (source -> target)
            const edgeMatches = (source, target) => {
                // Check direct from/to match
                if (edge.from === source && edge.to === target) return true;
                // Check Standard mode properties
                if (edge.attackingElement === source && edge.attackedAssumption === target) return true;
                // Check edge ID contains attack pattern (for assumption-level modes)
                if (edge.id && edge.id.includes(`${source}-`) && edge.id.includes(`-${target}`)) return true;
                return false;
            };

            // Check for discarded attack match (only one match per edge)
            const matchedDiscard = discardedAttacks.find(da => edgeMatches(da.source, da.via));
            if (matchedDiscard) {
                edgeUpdates.push({
                    id: edge.id,
                    color: { color: '#9ca3af', highlight: '#6b7280' },
                    width: 3,
                    dashes: true
                });
                return; // Skip checking successful if already discarded
            }

            // Check for successful attack match (only if not already discarded)
            const matchedSuccess = parsedSuccessful.find(sa => edgeMatches(sa.source, sa.target));
            if (matchedSuccess) {
                edgeUpdates.push({
                    id: edge.id,
                    color: { color: '#ef4444', highlight: '#dc2626' },
                    width: 5,
                    dashes: false
                });
            }
        });

        if (edgeUpdates.length > 0) {
            this.networkData.edges.update(edgeUpdates);
        }
    }

    updateIsolatedAssumptionsOverlay() {
        const banner = document.getElementById('isolated-assumptions-banner');
        const list = document.getElementById('isolated-assumptions-list');

        if (!banner || !list) return;

        if (this.isolatedNodes.length > 0) {
            const labels = this.isolatedNodes.map(n => n.label || n.id);
            list.textContent = labels.join(', ');
            banner.removeAttribute('hidden');
        } else {
            banner.setAttribute('hidden', '');
        }
    }

    // Note: The full graph update methods (updateGraphStandard, updateGraphAssumptionLevelDirect,
    // updateGraphAssumptionLevelBranching) are very large (~1500 lines total).
    // For now, these remain in app.js. They can be migrated here in a future refactoring.
    // The key infrastructure (initGraph, layout, highlighting) is now in this module.
}
