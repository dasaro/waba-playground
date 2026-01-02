/**
 * GraphManager - Handles graph visualization using vis.js
 * Note: This is a simplified version. Full graph update logic remains in app.js temporarily.
 */
import { GraphUtils } from './graph-utils.js?v=20260101-1';
import { ParserUtils } from './parser-utils.js?v=20260101-1';
import { UIManager } from './ui-manager.js?v=20260101-1';

export class GraphManager {
    constructor(graphCanvas, resetLayoutBtn, fullscreenBtn) {
        this.graphCanvas = graphCanvas;
        this.resetLayoutBtn = resetLayoutBtn;
        this.fullscreenBtn = fullscreenBtn;
        this.network = null;
        this.networkData = { nodes: null, edges: null };
        this.isolatedNodes = [];
        this.currentFrameworkCode = '';
        this.currentGraphMode = 'standard';
        this.isFullscreen = false;
        this.graphPanel = null; // Will be set to the graph panel container
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
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
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

        console.log('🔄 [resetGraphColors] CALLED');
        console.log('Resetting graph colors...');

        // Reset all nodes to original colors
        const nodes = this.networkData.nodes.get();
        console.log(`📊 [resetGraphColors] Processing ${nodes.length} nodes`);
        const nodeUpdates = nodes.map(node => ({
            id: node.id,
            color: node.originalColor || node.color,
            borderWidth: node.originalBorderWidth || 2
        }));
        this.networkData.nodes.update(nodeUpdates);

        // Reset all edges to original colors, widths, dashes, and smooth curves
        const edges = this.networkData.edges.get();
        console.log(`📊 [resetGraphColors] Processing ${edges.length} edges`);

        // Debug: Check first edge's color properties
        if (edges.length > 0) {
            console.log('📋 [resetGraphColors] Sample edge (first):');
            console.log('  - id:', edges[0].id);
            console.log('  - originalColor:', edges[0].originalColor);
            console.log('  - color:', edges[0].color);
            console.log('  - originalWidth:', edges[0].originalWidth);
            console.log('  - width:', edges[0].width);
        }

        const edgeUpdates = edges.map(edge => ({
            id: edge.id,
            color: edge.originalColor || edge.color,
            width: edge.originalWidth || edge.width || 2,
            dashes: edge.originalDashes || false,
            smooth: edge.originalSmooth || { enabled: true, type: 'cubicBezier', roundness: 0.5 }
        }));
        this.networkData.edges.update(edgeUpdates);

        console.log(`✅ [resetGraphColors] Reset ${nodeUpdates.length} nodes and ${edgeUpdates.length} edges`);
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

        // Guard: If called with empty parameters, just reset instead of dimming everything
        if (!inAssumptions || inAssumptions.length === 0) {
            console.warn('⚠️ [highlightExtension] Called with empty inAssumptions - resetting instead of highlighting');
            this.resetGraphColors();
            return;
        }

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

    /**
     * Main wrapper method to update graph based on selected mode
     * @param {string} frameworkCode - The WABA framework code
     * @param {string} graphMode - The graph visualization mode ('standard', 'assumption-direct', 'assumption-branching')
     * @param {ClingoManager} clingoManager - Reference to ClingoManager instance
     */
    async updateGraph(frameworkCode, graphMode, clingoManager) {
        this.currentFrameworkCode = frameworkCode;
        this.currentGraphMode = graphMode;

        if (graphMode === 'assumption-direct') {
            await this.updateGraphAssumptionLevelDirect(frameworkCode, clingoManager);
        } else if (graphMode === 'assumption-branching') {
            await this.updateGraphAssumptionLevelBranching(frameworkCode, clingoManager);
        } else {
            await this.updateGraphStandard(frameworkCode, clingoManager);
        }
    }

    /**
     * Standard graph visualization: sets as attack graph
     * @param {string} frameworkCode - The WABA framework code
     * @param {ClingoManager} clingoManager - Reference to ClingoManager instance
     */
    async updateGraphStandard(frameworkCode, clingoManager) {
        if (!clingoManager.clingoReady) {
            return;
        }

        try {
            const semiring = document.getElementById('semiring-select').value;

            // Build set-based attack graph program
            const setProgram = `
${frameworkCode}
${clingoManager.getCoreModule()}
${clingoManager.getSemiringModule(semiring)}

% Enumerate all sets of assumptions (power set)
in(X) :- assumption(X), not out(X).
out(X) :- assumption(X), not in(X).

% Track which rule derived each element
derived_by(X, R) :- head(R, X), triggered_by_in(R).

% Compute attacks from this set
% A set attacks assumption A if it supports an element that is A's contrary
set_attacks(A, X, W) :- supported_with_weight(X, W), contrary(A, X), assumption(A).

#show in/1.
#show supported/1.
#show supported_with_weight/2.
#show set_attacks/3.
#show derived_by/2.
`;

            // Run Clingo to enumerate all sets with their support and attacks
            const result = await clingo.run(setProgram, 0);

            // Parse sets and their attacks
            const setsMap = new Map(); // Map from set_id -> {assumptions: [], supported: Set, attacks: []}

            if (result.Call && result.Call[0] && result.Call[0].Witnesses) {
                result.Call[0].Witnesses.forEach((witness, idx) => {
                    const predicates = witness.Value || [];

                    // Extract data for this set
                    const inAssumptions = [];
                    const supportedAtoms = new Set();
                    const attacks = []; // Array of {assumption, attackingElement, weight, derivedBy: [rules]}
                    const derivations = new Map(); // Map element -> [rules]

                    predicates.forEach(pred => {
                        let match = pred.match(/^in\(([^)]+)\)$/);
                        if (match) {
                            inAssumptions.push(match[1]);
                        }

                        match = pred.match(/^supported\(([^)]+)\)$/);
                        if (match) {
                            supportedAtoms.add(match[1]);
                        }

                        match = pred.match(/^set_attacks\(([^,]+),\s*([^,]+),\s*(.+)\)$/);
                        if (match) {
                            const assumption = match[1];
                            const attackingElement = match[2];
                            const weightStr = match[3];
                            let weight;
                            if (weightStr === '#sup') {
                                weight = Infinity;
                            } else if (weightStr === '#inf') {
                                weight = -Infinity;
                            } else {
                                weight = parseInt(weightStr);
                            }
                            attacks.push({ assumption, attackingElement, weight, derivedBy: [] });
                        }

                        match = pred.match(/^derived_by\(([^,]+),\s*([^)]+)\)$/);
                        if (match) {
                            const element = match[1];
                            const rule = match[2];
                            if (!derivations.has(element)) {
                                derivations.set(element, []);
                            }
                            derivations.get(element).push(rule);
                        }
                    });

                    // Link derivations to attacks
                    attacks.forEach(attack => {
                        if (derivations.has(attack.attackingElement)) {
                            attack.derivedBy = derivations.get(attack.attackingElement);
                        }
                    });

                    // Create unique ID for this set
                    const sortedAssumptions = inAssumptions.sort();
                    const setId = sortedAssumptions.length > 0 ? sortedAssumptions.join(',') : '∅';

                    // Store this set
                    if (!setsMap.has(setId)) {
                        setsMap.set(setId, {
                            id: setId,
                            assumptions: sortedAssumptions,
                            supported: supportedAtoms,
                            attacks: attacks
                        });
                    }
                });
            }

            // Build graph elements
            const elements = [];

            // Add nodes for each set
            setsMap.forEach(set => {
                const label = set.id;
                const isEmptySet = set.assumptions.length === 0;
                const hasAttacks = set.attacks.length > 0;

                elements.push({
                    data: {
                        id: set.id,
                        label: label,
                        size: set.assumptions.length,
                        attackCount: set.attacks.length,
                        supported: Array.from(set.supported).join(', ')
                    },
                    classes: isEmptySet ? 'empty-set' : (hasAttacks ? 'attacking-set' : 'assumption')
                });
            });

            // Add attack edges from sets to assumptions
            setsMap.forEach(set => {
                set.attacks.forEach(attack => {
                    const { assumption, attackingElement, weight, derivedBy } = attack;
                    const displayWeight = weight === Infinity ? '#sup' : (weight === -Infinity ? '#inf' : weight);
                    const normalizedWidth = weight === Infinity ? 5 : (weight === -Infinity ? 1 : 2);
                    const color = weight === Infinity ? '#ff6b6b' :
                                 (weight === -Infinity ? '#888' : '#f59e0b');

                    // Attack edge from set to assumption (shown as attacking any set containing that assumption)
                    // For visualization, we'll create edges to all sets that contain the attacked assumption
                    setsMap.forEach(targetSet => {
                        if (targetSet.assumptions.includes(assumption)) {
                            // Include attacking element in edge ID to ensure uniqueness
                            const edgeId = `${set.id}-attacks-${targetSet.id}-via-${assumption}-from-${attackingElement}`;
                            elements.push({
                                data: {
                                    id: edgeId,
                                    source: set.id,
                                    target: targetSet.id,
                                    label: `${displayWeight}`,
                                    width: normalizedWidth,
                                    color: color,
                                    attackedAssumption: assumption,
                                    attackingElement: attackingElement,
                                    derivedBy: derivedBy,
                                    sourceSet: set.id,
                                    targetSet: targetSet.id
                                }
                            });
                        }
                    });
                });
            });

            // Convert elements to vis.js format
            const visNodes = [];
            const visEdges = [];
            const isolatedNodes = []; // Track nodes with no edges

            // First pass: collect all edges
            elements.forEach(el => {
                if (el.data.source) {
                    // It's an edge - store original width, color, and dashes for reset
                    const edgeColor = { color: el.data.color, highlight: el.data.color };
                    visEdges.push({
                        id: el.data.id,
                        from: el.data.source,
                        to: el.data.target,
                        label: el.data.label,
                        width: el.data.width,
                        originalWidth: el.data.width,  // Store original for reset
                        color: edgeColor,
                        originalColor: edgeColor,  // Store original for reset
                        dashes: false,
                        originalDashes: false,  // Store original for reset
                        attackedAssumption: el.data.attackedAssumption,
                        attackingElement: el.data.attackingElement,
                        derivedBy: el.data.derivedBy,
                        sourceSet: el.data.sourceSet,
                        targetSet: el.data.targetSet
                    });
                }
            });

            // Build set of nodes involved in edges
            const nodesWithEdges = new Set();
            visEdges.forEach(edge => {
                nodesWithEdges.add(edge.from);
                nodesWithEdges.add(edge.to);
            });

            // Second pass: add nodes (filter isolated ones)
            elements.forEach(el => {
                if (!el.data.source) {
                    // It's a node
                    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

                    // Consistent assumption color for all nodes
                    const nodeColor = {
                        border: '#5568d3',
                        background: '#667eea',
                        highlight: {
                            border: '#4557c2',
                            background: '#5568d3'
                        }
                    };

                    const nodeData = {
                        id: el.data.id,
                        label: el.data.label,
                        size: Math.max(25, 15 + (el.data.size * 3)),  // Min size 25 for labels to fit inside
                        color: nodeColor,
                        title: `Supported: ${el.data.supported || 'none'}`, // Tooltip
                        font: {
                            color: isDark ? '#f1f5f9' : '#1e293b'
                        },
                        assumptions: el.data.id.split(',').filter(a => a !== '∅') // Store assumptions for filtering
                    };

                    // Only include nodes that have at least one edge (not isolated)
                    if (nodesWithEdges.has(el.data.id)) {
                        visNodes.push(nodeData);
                    } else {
                        // Track isolated nodes for potential display elsewhere
                        isolatedNodes.push(nodeData);
                    }
                }
            });

            // Store isolated nodes for display in UI
            this.isolatedNodes = isolatedNodes;
            if (isolatedNodes.length > 0) {
                console.log(`Filtered ${isolatedNodes.length} isolated nodes:`, isolatedNodes.map(n => n.id));
            }

            // Update vis.js network
            this.networkData.nodes.clear();
            this.networkData.edges.clear();
            this.networkData.nodes.add(visNodes);
            this.networkData.edges.add(visEdges);

            // Hide graph empty state after successful render
            UIManager.hideGraphEmptyState();

            // Update banner with isolated assumptions
            this.updateIsolatedAssumptionsOverlay();

            // Run layout and then fit to view with animation
            this.runGraphLayout(true); // Use quick mode for cleaner initial layout

            // Auto-zoom and center after layout stabilizes
            setTimeout(() => {
                this.network.fit({
                    animation: {
                        duration: 500,
                        easingFunction: 'easeInOutQuad'
                    }
                });
            }, 600);

        } catch (error) {
            console.error('Error updating graph:', error);
        }
    }

    /**
     * Assumption-level direct graph visualization
     * @param {string} frameworkCode - The WABA framework code
     * @param {ClingoManager} clingoManager - Reference to ClingoManager instance
     */
    async updateGraphAssumptionLevelDirect(frameworkCode, clingoManager) {
        if (!clingoManager.clingoReady) {
            return;
        }

        try {
            // Parse framework to extract assumptions, contraries, rules, and weights
            const assumptions = ParserUtils.parseAssumptions(frameworkCode);
            const contraries = ParserUtils.parseContraries(frameworkCode);
            const rules = ParserUtils.parseRules(frameworkCode);
            const weights = ParserUtils.parseWeights(frameworkCode);

            // Build vis.js nodes (one per assumption)
            const visNodes = [];
            const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

            assumptions.forEach(assumption => {
                const weight = weights[assumption] || '?';
                const nodeColor = {
                    border: '#5568d3',
                    background: '#667eea',
                    highlight: {
                        border: '#4557c2',
                        background: '#5568d3'
                    }
                };

                visNodes.push({
                    id: assumption,
                    label: assumption,
                    size: 25,  // Increased for labels inside nodes
                    color: nodeColor,
                    title: `Assumption: ${assumption}\nWeight: ${weight}`,
                    font: {
                        color: isDark ? '#f1f5f9' : '#1e293b'
                    },
                    isAssumption: true
                });
            });

            // Build vis.js edges (attacks between assumptions) - DIRECT MODE
            const visEdges = [];
            const factBasedAttacks = []; // Track attacks from facts (via ⊤)

            console.log('=== FACT-BASED ATTACK DETECTION (DIRECT) ===');
            console.log('Total contraries:', contraries.length);
            console.log('Assumptions:', assumptions);
            console.log('Rules:', rules);

            // For each contrary relationship, determine how the contrary can be supported
            contraries.forEach(({ assumption, contrary }) => {
                // Find rules that derive this contrary
                const derivingRules = rules.filter(rule => rule.head === contrary);

                // Check if contrary has any rules with non-empty bodies (derived attacks)
                const hasNonFactRules = derivingRules.some(rule => rule.body && rule.body.length > 0);

                if (!hasNonFactRules) {
                    // Contrary is a fact (no rules, or only empty-body/fact rules)
                    if (assumptions.includes(contrary)) {
                        // Direct attack from one assumption to another (treat as derived)
                        const weight = weights[contrary] || 1;
                        const displayWeight = weight === '?' ? '' : weight;
                        const edgeColor = { color: '#f59e0b', highlight: '#d97706' };
                        visEdges.push({
                            id: `${contrary}-attacks-${assumption}`,
                            from: contrary,
                            to: assumption,
                            label: displayWeight,
                            width: 2,
                            color: edgeColor,
                            arrows: 'to',
                            title: `${contrary} attacks ${assumption}\nType: Direct\nWeight: ${weight}`,
                            attackType: 'direct',
                            attackingElement: contrary,
                            targetAssumption: assumption,
                            originalWidth: 2,
                            originalColor: edgeColor,
                            originalDashes: false
                        });
                    } else {
                        // Fact-based attack (contrary is not an assumption and only has fact rules) - attack via ⊤
                        const weight = weights[contrary] || 1;
                        console.log(`FACT-BASED ATTACK DETECTED: ${contrary} (weight=${weight}) attacks ${assumption}`);
                        factBasedAttacks.push({ assumption, contrary, weight });
                    }
                } else {
                    // Contrary is derived by rule(s)
                    derivingRules.forEach(rule => {
                        const attackers = rule.body;

                        if (attackers.length === 1) {
                            // Simple derived attack
                            const attacker = attackers[0];
                            if (assumptions.includes(attacker)) {
                                const weight = weights[contrary] || 1;
                                const displayWeight = weight === '?' ? '' : weight;
                                const edgeColor = { color: '#f59e0b', highlight: '#d97706' };
                                visEdges.push({
                                    id: `${attacker}-attacks-${assumption}-via-${contrary}`,
                                    from: attacker,
                                    to: assumption,
                                    label: displayWeight,
                                    width: 2,
                                    color: edgeColor,
                                    arrows: 'to',
                                    dashes: false,
                                    title: `${attacker} attacks ${assumption}\nType: Derived (${contrary})\nWeight: ${weight}`,
                                    attackType: 'derived',
                                    attackingElement: attacker,
                                    targetAssumption: assumption,
                                    contrary: contrary,
                                    originalWidth: 2,
                                    originalColor: edgeColor,
                                    originalDashes: false
                                });
                            }
                        } else if (attackers.length > 1) {
                            // Joint attack - use individual dashed edges
                            const assumptionAttackers = attackers.filter(a => assumptions.includes(a));

                            if (assumptionAttackers.length > 0) {
                                const weight = weights[contrary] || 1;
                                const displayWeight = weight === '?' ? '' : weight;

                                assumptionAttackers.forEach(attacker => {
                                    const otherAttackers = assumptionAttackers.filter(a => a !== attacker).join(', ');
                                    const edgeColor = { color: '#10b981', highlight: '#059669' };
                                    visEdges.push({
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
                                        contrary: contrary,
                                        jointWith: assumptionAttackers,
                                        originalWidth: 2,
                                        originalColor: edgeColor,
                                        originalDashes: false
                                    });
                                });
                            }
                        }
                    });
                }
            });

            console.log(`Total fact-based attacks detected: ${factBasedAttacks.length}`);
            if (factBasedAttacks.length > 0) {
                console.log('Fact-based attacks:', factBasedAttacks);
            }

            // Add ⊤ (top) node for fact-based attacks
            if (factBasedAttacks.length > 0) {
                const topNodeColor = {
                    border: '#5568d3',
                    background: '#667eea',
                    highlight: {
                        border: '#4557c2',
                        background: '#5568d3'
                    }
                };
                visNodes.push({
                    id: '⊤',
                    label: '⊤',
                    size: 25,  // Increased for labels inside nodes
                    shape: 'ellipse',
                    color: topNodeColor,
                    title: 'Top element (⊤): represents fact-based attacks',
                    font: {
                        color: isDark ? '#f1f5f9' : '#1e293b',
                        size: 26  // Increased for labels inside nodes
                    },
                    isTop: true
                });

                // Create edges from ⊤ to attacked assumptions
                factBasedAttacks.forEach(({ assumption, contrary, weight }) => {
                    const displayWeight = weight === '?' ? '' : weight;
                    const edgeColor = { color: '#f59e0b', highlight: '#ea580c' };
                    visEdges.push({
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
                        targetAssumption: assumption,
                        originalWidth: 2,
                        originalColor: edgeColor,
                        originalDashes: false
                    });
                });
            }

            // Track isolated assumptions (no incoming or outgoing attacks)
            const isolatedAssumptions = [];
            const connectedAssumptions = new Set();
            visEdges.forEach(edge => {
                if (edge.from !== '⊤' && assumptions.includes(edge.from)) {
                    connectedAssumptions.add(edge.from);
                }
                if (assumptions.includes(edge.to)) {
                    connectedAssumptions.add(edge.to);
                }
            });
            assumptions.forEach(assumption => {
                if (!connectedAssumptions.has(assumption)) {
                    isolatedAssumptions.push(assumption);
                }
            });

            // Update vis.js network
            this.networkData.nodes.clear();
            this.networkData.edges.clear();
            this.networkData.nodes.add(visNodes);
            this.networkData.edges.add(visEdges);

            // Hide graph empty state after successful render
            UIManager.hideGraphEmptyState();

            // Store isolated assumptions for display
            this.isolatedNodes = isolatedAssumptions.map(a => ({ id: a, assumptions: [a] }));

            // Run layout and fit to view
            this.runGraphLayout(true);

            setTimeout(() => {
                this.network.fit({
                    animation: {
                        duration: 500,
                        easingFunction: 'easeInOutQuad'
                    }
                });
                // Update isolated assumptions banner after layout
                this.updateIsolatedAssumptionsOverlay();
            }, 600);

        } catch (error) {
            console.error('Error updating assumption-level graph (direct):', error);
        }
    }

    /**
     * Assumption-level branching graph visualization
     * @param {string} frameworkCode - The WABA framework code
     * @param {ClingoManager} clingoManager - Reference to ClingoManager instance
     */
    async updateGraphAssumptionLevelBranching(frameworkCode, clingoManager) {
        if (!clingoManager.clingoReady) {
            return;
        }

        try {
            // Parse framework to extract assumptions, contraries, rules, and weights
            const assumptions = ParserUtils.parseAssumptions(frameworkCode);
            const contraries = ParserUtils.parseContraries(frameworkCode);
            const rules = ParserUtils.parseRules(frameworkCode);
            const weights = ParserUtils.parseWeights(frameworkCode);

            // DEBUG: Log parsed data
            console.log('=== ASSUMPTION-LEVEL GRAPH DEBUG (BRANCHING) ===');
            console.log('Assumptions:', assumptions);
            console.log('Contraries:', contraries);
            console.log('Rules:', rules);
            console.log('Weights:', weights);

            // Build vis.js nodes (one per assumption)
            const visNodes = [];
            const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

            assumptions.forEach(assumption => {
                const weight = weights[assumption] || '?';
                const nodeColor = {
                    border: '#5568d3',
                    background: '#667eea',
                    highlight: {
                        border: '#4557c2',
                        background: '#5568d3'
                    }
                };

                visNodes.push({
                    id: assumption,
                    label: assumption,
                    size: 25,  // Increased for labels inside nodes
                    color: nodeColor,
                    title: `Assumption: ${assumption}\nWeight: ${weight}`,
                    font: {
                        color: isDark ? '#f1f5f9' : '#1e293b'
                    },
                    isAssumption: true
                });
            });

            // Build vis.js edges (attacks between assumptions)
            const visEdges = [];
            const jointAttackGroups = new Map(); // Track joint attacks: target -> [{attackers: [...], contrary: ...}]
            const factBasedAttacks = []; // Track attacks from facts (via ⊤)

            console.log('=== FACT-BASED ATTACK DETECTION (BRANCHING) ===');
            console.log('Total contraries:', contraries.length);
            console.log('Assumptions:', assumptions);
            console.log('Rules:', rules);

            // For each contrary relationship, determine how the contrary can be supported
            contraries.forEach(({ assumption, contrary }) => {
                // Find rules that derive this contrary
                const derivingRules = rules.filter(rule => rule.head === contrary);

                // Check if contrary has any rules with non-empty bodies (derived attacks)
                const hasNonFactRules = derivingRules.some(rule => rule.body && rule.body.length > 0);

                if (!hasNonFactRules) {
                    // Contrary is a fact (no rules, or only empty-body/fact rules)
                    if (assumptions.includes(contrary)) {
                        // Direct attack from one assumption to another (treat as derived)
                        const weight = weights[contrary] || 1;
                        const displayWeight = weight === '?' ? '' : weight;
                        const edgeColor = { color: '#f59e0b', highlight: '#d97706' };
                        visEdges.push({
                            id: `${contrary}-attacks-${assumption}`,
                            from: contrary,
                            to: assumption,
                            label: displayWeight,
                            width: 2,
                            color: edgeColor,
                            arrows: 'to',
                            title: `${contrary} attacks ${assumption}\nType: Direct\nWeight: ${weight}`,
                            attackingElement: contrary,
                            targetAssumption: assumption,
                            originalWidth: 2,
                            originalColor: edgeColor,
                            originalDashes: false
                        });
                    } else {
                        // Fact-based attack (contrary is not an assumption and only has fact rules) - attack via ⊤
                        const weight = weights[contrary] || 1;
                        console.log(`FACT-BASED ATTACK DETECTED: ${contrary} (weight=${weight}) attacks ${assumption}`);
                        factBasedAttacks.push({ assumption, contrary, weight });
                    }
                } else {
                    // Contrary is derived by rule(s)
                    derivingRules.forEach(rule => {
                        const attackers = rule.body; // Array of atoms in the rule body

                        if (attackers.length === 1) {
                            // Simple derived attack: single attacker
                            const attacker = attackers[0];
                            // Only show if attacker is an assumption
                            if (assumptions.includes(attacker)) {
                                const weight = weights[contrary] || 1;
                                const displayWeight = weight === '?' ? '' : weight;
                                const edgeColor = { color: '#f59e0b', highlight: '#d97706' };
                                visEdges.push({
                                    id: `${attacker}-attacks-${assumption}-via-${contrary}`,
                                    from: attacker,
                                    to: assumption,
                                    label: displayWeight,
                                    width: 2,
                                    color: edgeColor,
                                    arrows: 'to',
                                    dashes: false,
                                    title: `${attacker} attacks ${assumption}\nType: Derived (${contrary})\nWeight: ${weight}`,
                                    attackingElement: attacker,
                                    targetAssumption: assumption,
                                    contrary: contrary,
                                    originalWidth: 2,
                                    originalColor: edgeColor,
                                    originalDashes: false
                                });
                            }
                        } else if (attackers.length > 1) {
                            // Joint attack: multiple attackers - use branching visualization
                            console.log(`Joint attack detected: ${attackers.join(', ')} -> ${assumption} via ${contrary}`);
                            const assumptionAttackers = attackers.filter(a => assumptions.includes(a));
                            console.log(`  Assumption attackers: ${assumptionAttackers.join(', ')}`);

                            if (assumptionAttackers.length > 0) {
                                // Track this as a joint attack
                                if (!jointAttackGroups.has(assumption)) {
                                    jointAttackGroups.set(assumption, []);
                                }
                                jointAttackGroups.get(assumption).push({
                                    attackers: assumptionAttackers,
                                    contrary: contrary,
                                    weight: weights[contrary] || 1,
                                    ruleId: rule.id
                                });

                                // Create junction node for this joint attack
                                const junctionId = `junction_${rule.id}`;
                                const junctionNode = {
                                    id: junctionId,
                                    label: '',
                                    size: 25,  // Increased for labels inside nodes
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
                                        color: isDark ? '#f1f5f9' : '#1e293b',
                                        size: 25  // Increased for labels inside nodes
                                    },
                                    isJunction: true,
                                    attackers: assumptionAttackers,
                                    target: assumption,
                                    contrary: contrary
                                };
                                console.log(`  Creating junction node:`, junctionNode);
                                visNodes.push(junctionNode);

                                // Create edges from each attacker to junction (dashed green)
                                assumptionAttackers.forEach(attacker => {
                                    const edgeColor = { color: '#10b981', highlight: '#059669' };
                                    const edge = {
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
                                        contrary: contrary,
                                        originalWidth: 2,
                                        originalColor: edgeColor,
                                        originalDashes: false
                                    };
                                    console.log(`  Creating edge to junction:`, edge);
                                    visEdges.push(edge);
                                });

                                // Create edge from junction to target (solid green, thicker)
                                const weight = weights[contrary] || 1;
                                const displayWeight = weight === '?' ? '' : weight;
                                const edgeColor = { color: '#10b981', highlight: '#059669' };
                                const finalEdge = {
                                    id: `${junctionId}-attacks-${assumption}`,
                                    from: junctionId,
                                    to: assumption,
                                    label: displayWeight,
                                    width: 2,
                                    color: edgeColor,
                                    arrows: 'to',
                                    dashes: false,
                                    title: `Joint attack on ${assumption}\nType: Joint Attack (${contrary})\nWeight: ${weight}`,
                                    targetAssumption: assumption,
                                    contrary: contrary,
                                    originalWidth: 2,
                                    originalColor: edgeColor,
                                    originalDashes: false
                                };
                                console.log(`  Creating junction-to-target edge:`, finalEdge);
                                visEdges.push(finalEdge);
                            }
                        }
                    });
                }
            });

            console.log('Total edges created:', visEdges.length);
            console.log('Edges:', visEdges.map(e => `${e.from} -> ${e.to} (${e.dashes ? 'DASHED' : 'SOLID'}, color: ${e.color.color})`));
            console.log(`Total fact-based attacks detected: ${factBasedAttacks.length}`);
            if (factBasedAttacks.length > 0) {
                console.log('Fact-based attacks:', factBasedAttacks);
            }
            console.log('================================');

            // Add ⊤ (top) node for fact-based attacks
            if (factBasedAttacks.length > 0) {
                const topNodeColor = {
                    border: '#5568d3',
                    background: '#667eea',
                    highlight: {
                        border: '#4557c2',
                        background: '#5568d3'
                    }
                };
                visNodes.push({
                    id: '⊤',
                    label: '⊤',
                    size: 25,  // Increased for labels inside nodes
                    shape: 'ellipse',
                    color: topNodeColor,
                    title: 'Top element (⊤): represents fact-based attacks',
                    font: {
                        color: isDark ? '#f1f5f9' : '#1e293b',
                        size: 26  // Increased for labels inside nodes
                    },
                    isTop: true
                });

                // Create edges from ⊤ to attacked assumptions
                factBasedAttacks.forEach(({ assumption, contrary, weight }) => {
                    const displayWeight = weight === '?' ? '' : weight;
                    const edgeColor = { color: '#f59e0b', highlight: '#ea580c' };
                    visEdges.push({
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
                        targetAssumption: assumption,
                        originalWidth: 2,
                        originalColor: edgeColor,
                        originalDashes: false
                    });
                });
                console.log(`Added ⊤ node with ${factBasedAttacks.length} fact-based attacks`);
            }

            // Track isolated assumptions (no incoming or outgoing attacks)
            const isolatedAssumptions = [];
            const connectedAssumptions = new Set();
            visEdges.forEach(edge => {
                if (edge.from !== '⊤' && !edge.from.startsWith('junction_') && assumptions.includes(edge.from)) {
                    connectedAssumptions.add(edge.from);
                }
                if (assumptions.includes(edge.to)) {
                    connectedAssumptions.add(edge.to);
                }
            });
            assumptions.forEach(assumption => {
                if (!connectedAssumptions.has(assumption)) {
                    isolatedAssumptions.push(assumption);
                }
            });

            // Update vis.js network
            this.networkData.nodes.clear();
            this.networkData.edges.clear();
            this.networkData.nodes.add(visNodes);
            this.networkData.edges.add(visEdges);

            // Hide graph empty state after successful render
            UIManager.hideGraphEmptyState();

            // Store isolated assumptions for display
            this.isolatedNodes = isolatedAssumptions.map(a => ({ id: a, assumptions: [a] }));

            // Run layout and fit to view
            this.runGraphLayout(true);

            setTimeout(() => {
                this.network.fit({
                    animation: {
                        duration: 500,
                        easingFunction: 'easeInOutQuad'
                    }
                });
                // Update isolated assumptions banner after layout
                this.updateIsolatedAssumptionsOverlay();
            }, 600);

        } catch (error) {
            console.error('Error updating assumption-level graph:', error);
        }
    }

    // ===================================
    // Fullscreen Mode
    // ===================================

    /**
     * Initialize fullscreen functionality
     * @param {HTMLElement} graphPanel - The graph panel container element
     */
    initFullscreen(graphPanel) {
        this.graphPanel = graphPanel;
        this.isFullscreen = false;
        this.fullscreenOverlay = null;

        // Add fullscreen button click handler
        if (this.fullscreenBtn) {
            this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        }
    }

    /**
     * Toggle fullscreen mode for the graph panel
     */
    toggleFullscreen() {
        if (!this.isFullscreen) {
            this.enterFullscreen();
        } else {
            this.exitFullscreen();
        }
    }

    /**
     * Enter custom fullscreen modal mode
     */
    enterFullscreen() {
        if (this.isFullscreen) return;

        // Create fullscreen overlay
        this.fullscreenOverlay = document.createElement('div');
        this.fullscreenOverlay.id = 'graph-fullscreen-overlay';
        this.fullscreenOverlay.innerHTML = `
            <div class="fullscreen-header">
                <h3>Argumentation Graph</h3>
                <div class="fullscreen-controls">
                    <button id="fullscreen-legend-btn" class="fullscreen-btn" aria-label="Toggle legend">📖 Legend</button>
                    <button id="fullscreen-reset-btn" class="fullscreen-btn" aria-label="Reset layout">🔄 Reset Layout</button>
                    <button id="fullscreen-close-btn" class="fullscreen-btn fullscreen-close" aria-label="Exit fullscreen">✕ Close</button>
                </div>
            </div>
            <div id="fullscreen-graph-container" class="fullscreen-graph-container"></div>
            <div id="fullscreen-extensions-panel" class="fullscreen-extensions-panel" hidden>
                <div class="extensions-panel-header">
                    <span>Extensions:</span>
                </div>
                <div id="fullscreen-extensions-list" class="fullscreen-extensions-list"></div>
            </div>
        `;

        document.body.appendChild(this.fullscreenOverlay);

        // Move graph canvas to fullscreen container
        const fullscreenContainer = document.getElementById('fullscreen-graph-container');
        const graphCanvas = document.getElementById('cy');
        const graphHeader = this.graphPanel.querySelector('.graph-header');
        const graphLegend = this.graphPanel.querySelector('.graph-legend');
        const isolatedBanner = this.graphPanel.querySelector('.isolated-assumptions-banner');

        // Store original parent for restoration
        this.originalParent = graphCanvas.parentNode;
        this.originalNextSibling = graphCanvas.nextSibling;

        // Move elements to fullscreen
        fullscreenContainer.appendChild(graphCanvas);
        if (graphLegend) {
            fullscreenContainer.appendChild(graphLegend);
        }
        if (isolatedBanner && !isolatedBanner.hasAttribute('hidden')) {
            fullscreenContainer.appendChild(isolatedBanner);
        }

        // Populate extensions panel
        this.populateExtensionsPanel();

        // Setup close handlers
        const closeBtn = document.getElementById('fullscreen-close-btn');
        const resetBtn = document.getElementById('fullscreen-reset-btn');
        const legendBtn = document.getElementById('fullscreen-legend-btn');

        closeBtn.addEventListener('click', () => this.exitFullscreen());

        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetLayout());
        }

        if (legendBtn && graphLegend) {
            legendBtn.addEventListener('click', () => {
                graphLegend.toggleAttribute('hidden');
                legendBtn.setAttribute('aria-expanded', !graphLegend.hasAttribute('hidden'));
            });
        }

        // ESC key handler
        this.escHandler = (e) => {
            if (e.key === 'Escape') {
                this.exitFullscreen();
            }
        };
        document.addEventListener('keydown', this.escHandler);

        // Update state
        this.isFullscreen = true;
        if (this.fullscreenBtn) {
            this.fullscreenBtn.innerHTML = '⛶ Exit Fullscreen';
            this.fullscreenBtn.setAttribute('aria-label', 'Exit fullscreen mode');
        }

        // Trigger network redraw to adjust to new container size
        setTimeout(() => {
            if (this.network) {
                this.network.fit();
            }
        }, 100);
    }

    /**
     * Exit custom fullscreen modal mode
     */
    exitFullscreen() {
        if (!this.isFullscreen) return;

        const graphCanvas = document.getElementById('cy');
        const graphLegend = this.graphPanel.querySelector('.graph-legend');
        const isolatedBanner = document.getElementById('isolated-assumptions-banner');

        // Restore elements to original positions
        if (this.originalNextSibling) {
            this.originalParent.insertBefore(graphCanvas, this.originalNextSibling);
        } else {
            this.originalParent.appendChild(graphCanvas);
        }

        // Restore legend and banner if they exist
        const panelContent = this.graphPanel.querySelector('.panel-content');
        if (graphLegend && !panelContent.contains(graphLegend)) {
            // Insert after graph-header
            const graphHeader = panelContent.querySelector('.graph-header');
            graphHeader.insertAdjacentElement('afterend', graphLegend);
        }

        if (isolatedBanner && !panelContent.contains(isolatedBanner)) {
            // Insert after graph canvas
            graphCanvas.insertAdjacentElement('afterend', isolatedBanner);
        }

        // Remove overlay
        if (this.fullscreenOverlay) {
            this.fullscreenOverlay.remove();
            this.fullscreenOverlay = null;
        }

        // Remove ESC handler
        if (this.escHandler) {
            document.removeEventListener('keydown', this.escHandler);
            this.escHandler = null;
        }

        // Update state
        this.isFullscreen = false;
        if (this.fullscreenBtn) {
            this.fullscreenBtn.innerHTML = '⛶ Fullscreen';
            this.fullscreenBtn.setAttribute('aria-label', 'Toggle fullscreen mode');
        }

        // Trigger network redraw
        setTimeout(() => {
            if (this.network) {
                this.network.fit();
            }
        }, 100);
    }

    /**
     * Populate the extensions panel with available extensions
     */
    populateExtensionsPanel() {
        const extensionsPanel = document.getElementById('fullscreen-extensions-panel');
        const extensionsList = document.getElementById('fullscreen-extensions-list');

        if (!extensionsPanel || !extensionsList) return;

        // Find all extension headers in the output panel
        const answerHeaders = document.querySelectorAll('.answer-header');

        if (answerHeaders.length === 0) {
            // No extensions, keep panel hidden
            extensionsPanel.setAttribute('hidden', '');
            return;
        }

        // Show panel
        extensionsPanel.removeAttribute('hidden');

        // Clear existing content
        extensionsList.innerHTML = '';

        // Create a button for each extension
        answerHeaders.forEach((header, index) => {
            const extensionId = header.dataset.extensionId;
            const answerNumber = parseInt(extensionId);
            const isActive = header.classList.contains('active-extension');

            // Extract cost/reward from the badge
            const costBadge = header.querySelector('.extension-cost-badge');
            const costText = costBadge ? costBadge.textContent.trim() : '';

            // Create extension button
            const button = document.createElement('button');
            button.className = 'fullscreen-extension-btn';
            button.dataset.extensionId = extensionId;

            if (isActive) {
                button.classList.add('active');
            }

            button.innerHTML = `
                <span class="extension-number">Ext ${answerNumber}</span>
                ${costText ? `<span class="extension-cost">${costText}</span>` : ''}
            `;

            // Click handler - trigger the original header's click
            button.addEventListener('click', () => {
                // Trigger click on the original header to reuse all existing logic
                header.click();

                // Update active state on all fullscreen buttons
                document.querySelectorAll('.fullscreen-extension-btn').forEach(btn => {
                    btn.classList.remove('active');
                });

                // Check if this extension is now active (could have been toggled off)
                if (header.classList.contains('active-extension')) {
                    button.classList.add('active');
                }
            });

            extensionsList.appendChild(button);
        });
    }

    /**
     * Handle fullscreen state changes (legacy - no longer used with custom overlay)
     */
    handleFullscreenChange() {
        // Legacy method - kept for compatibility but not used with custom overlay
    }
}
