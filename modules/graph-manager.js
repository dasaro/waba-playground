/**
 * GraphManager - Handles graph visualization using vis.js
 * Note: This is a simplified version. Full graph update logic remains in app.js temporarily.
 */
import { GraphUtils } from './graph-utils.js?v=20260730-8';
import { ParserUtils } from './parser-utils.js?v=20260730-8';
import { UIManager } from './ui-manager.js?v=20260730-8';
import { buildBranchingAssumptionGraph, buildDirectAssumptionGraph } from './graph-assumption-builder.js?v=20260730-8';
import { buildHighlightUpdates, buildResetUpdates, renderIsolatedAssumptionsOverlay } from './graph-highlighting.js?v=20260730-8';
import { buildSetAttackTooltip, buildSetNodeTooltip } from './graph-tooltip-builder.js?v=20260730-8';

// vis.js shows a string `title` as escaped text; an HTMLElement is rendered as markup.
// The tooltip builders emit an HTML string, so parse it into an element before handing it to vis.
function htmlToElement(html) {
    const template = document.createElement('template');
    template.innerHTML = String(html).trim();
    return template.content.firstElementChild || document.createTextNode(String(html));
}

// Initial add: keep the source HTML string in `titleHtml` (so the highlighter can restyle
// it as a string) and give vis the rendered element as `title`.
function withElementTitle(item) {
    if (item && typeof item.title === 'string' && item.title.trim().startsWith('<')) {
        return { ...item, titleHtml: item.title, title: htmlToElement(item.title) };
    }
    return item;
}

// Update: an edge/node update may carry a fresh HTML-string `title` (e.g. the highlighter
// injects a State row); render it to an element for vis without disturbing `titleHtml`.
function toVisTitle(update) {
    if (update && typeof update.title === 'string' && update.title.trim().startsWith('<')) {
        return { ...update, title: htmlToElement(update.title) };
    }
    return update;
}

export class GraphManager {
    /**
     * Largest number of candidate sets the Standard set-graph will draw. 2^n nodes, so this
     * caps n at 5. See the rationale in updateGraphStandard.
     */
    static MAX_STANDARD_SETS = 32;

    constructor(graphCanvas, resetLayoutBtn, fullscreenBtn = null, options = {}) {
        this.graphCanvas = graphCanvas;
        this.resetLayoutBtn = resetLayoutBtn;
        this.fullscreenBtn = fullscreenBtn;
        this.isolatedBanner = options.isolatedBanner || null;
        this.isolatedList = options.isolatedList || null;
        this.network = null;
        this.networkData = { nodes: null, edges: null };
        this.isolatedNodes = [];
        this.currentFrameworkCode = '';
        this.currentGraphMode = 'standard';
        this.graphPanel = null;
        this.isFullscreen = false;
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
                if (onNodeClick) {
                    onNodeClick(node, screenX, screenY);
                }
            } else if (params.edges.length > 0) {
                // Clicked on an edge
                const edgeId = params.edges[0];
                const edge = this.networkData.edges.get(edgeId);
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
        });
    }

    triggerInitialLayout() {
        // Trigger initial layout when graph data is loaded
        if (!this.network) return;
        this.runGraphLayout(false);
    }

    initFullscreen(graphPanel) {
        this.graphPanel = graphPanel;

        if (this.fullscreenBtn) {
            this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        }

        document.addEventListener('fullscreenchange', () => this.handleFullscreenChange());
        document.addEventListener('webkitfullscreenchange', () => this.handleFullscreenChange());
        document.addEventListener('mozfullscreenchange', () => this.handleFullscreenChange());
        document.addEventListener('MSFullscreenChange', () => this.handleFullscreenChange());
    }

    async toggleFullscreen() {
        if (!this.graphPanel) {
            console.error('Graph panel not initialized for fullscreen');
            return;
        }

        try {
            if (!this.isFullscreen) {
                if (this.graphPanel.requestFullscreen) {
                    await this.graphPanel.requestFullscreen();
                } else if (this.graphPanel.webkitRequestFullscreen) {
                    await this.graphPanel.webkitRequestFullscreen();
                } else if (this.graphPanel.mozRequestFullScreen) {
                    await this.graphPanel.mozRequestFullScreen();
                } else if (this.graphPanel.msRequestFullscreen) {
                    await this.graphPanel.msRequestFullscreen();
                }
            } else if (document.exitFullscreen) {
                await document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                await document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                await document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                await document.msExitFullscreen();
            }
        } catch (error) {
            console.error('Fullscreen error:', error);
        }
    }

    handleFullscreenChange() {
        this.isFullscreen = !!(
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement
        );

        if (this.fullscreenBtn) {
            if (this.isFullscreen) {
                this.fullscreenBtn.innerHTML = '⛶ Exit Fullscreen';
                this.fullscreenBtn.setAttribute('aria-label', 'Exit fullscreen mode');
            } else {
                this.fullscreenBtn.innerHTML = '⛶ Fullscreen';
                this.fullscreenBtn.setAttribute('aria-label', 'Toggle fullscreen mode');
            }
        }

        if (!this.network) {
            return;
        }

        setTimeout(() => {
            try {
                this.network.redraw();
                this.network.fit({
                    animation: {
                        duration: 300,
                        easingFunction: 'easeInOutQuad'
                    }
                });
            } catch (error) {
                console.warn('Graph resize after fullscreen change failed:', error);
            }
        }, 150);
    }

    resetGraphColors() {
        if (!this.network) return;
        const { nodeUpdates, edgeUpdates } = buildResetUpdates(this.networkData);
        this.networkData.nodes.update(nodeUpdates.map(toVisTitle));
        this.networkData.edges.update(edgeUpdates.map(toVisTitle));
    }

    highlightExtension(inAssumptions, discardedAttacks, successfulAttacks) {
        if (!this.network) {
            return;
        }

        const updates = buildHighlightUpdates(this.networkData, inAssumptions, discardedAttacks, successfulAttacks);
        if (updates.resetOnly) {
            this.resetGraphColors();
            return;
        }
        if (updates.nodeUpdates.length > 0) {
            this.networkData.nodes.update(updates.nodeUpdates.map(toVisTitle));
        }
        if (updates.edgeUpdates.length > 0) {
            this.networkData.edges.update(updates.edgeUpdates.map(toVisTitle));
        }
    }

    updateIsolatedAssumptionsOverlay() {
        renderIsolatedAssumptionsOverlay(this.isolatedBanner, this.isolatedList, this.isolatedNodes);
    }

    applyGraphData(visNodes, visEdges, isolatedNodes) {
        this.networkData.nodes.clear();
        this.networkData.edges.clear();
        // vis.js renders a STRING `title` as escaped text (so the raw "<div …>" markup
        // showed through). Pass a DOM element instead so the tooltip HTML is rendered.
        this.networkData.nodes.add((visNodes || []).map((node) => withElementTitle(node)));
        this.networkData.edges.add((visEdges || []).map((edge) => withElementTitle(edge)));
        this.isolatedNodes = isolatedNodes;

        if (!visNodes || visNodes.length === 0) {
            // Empty / degenerate framework: show the empty-state instead of a blank
            // canvas (there are no assumptions/attacks to draw).
            UIManager.showGraphEmptyState();
            this.updateIsolatedAssumptionsOverlay();
            return;
        }

        UIManager.hideGraphEmptyState();
        this.updateIsolatedAssumptionsOverlay();

        this.runGraphLayout(true);
        setTimeout(() => {
            this.network.fit({
                animation: {
                    duration: 500,
                    easingFunction: 'easeInOutQuad'
                }
            });
        }, 600);
    }

    /**
     * Main wrapper method to update graph based on selected mode
     * @param {string} frameworkCode - The WABA framework code
     * @param {string} graphMode - The graph visualization mode ('standard', 'assumption-direct', 'assumption-branching')
     * @param {ClingoManager} clingoManager - Reference to ClingoManager instance
     */
    async updateGraph(frameworkCode, graphMode, clingoManager, config) {
        this.currentFrameworkCode = frameworkCode;
        this.currentGraphMode = graphMode;
        // Generation token: a later updateGraph() supersedes earlier in-flight ones,
        // so a slow standard-mode (clingo) build cannot clobber a newer graph after
        // an example/mode switch.
        const generation = (this._graphGeneration = (this._graphGeneration || 0) + 1);

        if (graphMode === 'assumption-direct') {
            await this.updateGraphAssumptionLevelDirect(frameworkCode, clingoManager, config);
        } else if (graphMode === 'assumption-branching') {
            await this.updateGraphAssumptionLevelBranching(frameworkCode, clingoManager, config);
        } else {
            await this.updateGraphStandard(frameworkCode, clingoManager, config, generation);
        }
    }

    /**
     * Standard graph visualization: sets as attack graph
     * @param {string} frameworkCode - The WABA framework code
     * @param {ClingoManager} clingoManager - Reference to ClingoManager instance
     */
    async updateGraphStandard(frameworkCode, clingoManager, config, generation) {
        if (!clingoManager.clingoReady) {
            return;
        }

        // The standard graph is the POWER SET of the assumptions, so it renders 2^n set nodes
        // with up to n attack edges each. The bound therefore has to be stated in SETS, not in
        // assumptions: the previous `assumptionCount > 8` allowed 2^8 = 256 nodes and never
        // fired on any shipped example, the largest of which has n = 6 and so drew 64 nodes
        // with hundreds of crossing edges -- unreadable, and the thing this guard exists to
        // prevent. 32 sets (n <= 5) is the point at which the set graph is still legible; the
        // assumption-level views are linear in n and are the right view above it.
        const assumptionCount = ParserUtils.parseAssumptions(frameworkCode).length;
        const candidateSets = 2 ** assumptionCount;
        if (candidateSets > GraphManager.MAX_STANDARD_SETS) {
            if (generation !== undefined && generation !== this._graphGeneration) {
                return;
            }
            this.networkData.nodes.clear();
            this.networkData.edges.clear();
            this.isolatedNodes = [];
            this.updateIsolatedAssumptionsOverlay();
            UIManager.showGraphEmptyState(`${assumptionCount} assumptions ⇒ 2^${assumptionCount} = ${candidateSets} candidate sets, over the Standard set-graph limit of ${GraphManager.MAX_STANDARD_SETS}. Switch to Assumption-Direct or Assumption-Branching, which scale linearly in the number of assumptions.`);
            return;
        }

        try {
            // Build set-based attack graph program
            const setProgram = `
${frameworkCode}
${clingoManager.getCoreModule()}
${clingoManager.getSemiringModule({
                semiringKey: config.semiringKey
            })}
${clingoManager.getDefaultPolicyModule(config.defaultPolicy)}

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
            const result = await clingoManager.runRaw(setProgram, 0, ['--opt-mode=ignore'], 30000);

            // Parse sets and their attacks
            const setsMap = new Map(); // Map from set_id -> {assumptions: [], supported: Set, attacks: []}

            if (result.Call && result.Call[0] && result.Call[0].Witnesses) {
                result.Call[0].Witnesses.forEach((witness) => {
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
                            weight: attack.weight,
                            attackedAssumption: assumption,
                            attackingElement: attackingElement,
                            derivedBy: derivedBy,
                            sourceSet: set.id,
                            targetSet: targetSet.id,
                            title: buildSetAttackTooltip({
                                sourceSet: set.id,
                                targetSet: targetSet.id,
                                targetAssumption: assumption,
                                attackingElement,
                                weight: attack.weight,
                                derivedBy
                            })
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
                        targetSet: el.data.targetSet,
                        weight: el.data.weight,
                        title: el.data.title
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
                        title: buildSetNodeTooltip({
                            setId: el.data.id,
                            assumptions: el.data.id === '∅' ? [] : el.data.id.split(','),
                            supported: el.data.supported ? el.data.supported.split(', ').filter(Boolean) : [],
                            attacks: Array.from(setsMap.get(el.data.id)?.attacks || [])
                        }),
                        font: {
                            color: isDark ? '#f1f5f9' : '#1e293b'
                        },
                        assumptions: el.data.id.split(',').filter(a => a !== '∅'),
                        supportedAtoms: el.data.supported ? el.data.supported.split(', ').filter(Boolean) : [],
                        attackCount: el.data.attackCount
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

            // Drop this result if a newer graph build has since been requested.
            if (generation !== undefined && generation !== this._graphGeneration) {
                return;
            }
            this.applyGraphData(visNodes, visEdges, isolatedNodes);

        } catch (error) {
            console.error('Error updating graph:', error);
        }
    }

    /**
     * Assumption-level direct graph visualization
     * @param {string} frameworkCode - The WABA framework code
     * @param {ClingoManager} clingoManager - Reference to ClingoManager instance
     */
    async updateGraphAssumptionLevelDirect(frameworkCode, clingoManager, _config) {
        if (!clingoManager.clingoReady) {
            return;
        }

        try {
            const assumptions = ParserUtils.parseAssumptions(frameworkCode);
            const contraries = ParserUtils.parseContraries(frameworkCode);
            const rules = ParserUtils.parseRules(frameworkCode);
            const weights = ParserUtils.parseWeights(frameworkCode);
            const { visNodes, visEdges, isolatedNodes } = buildDirectAssumptionGraph(
                assumptions,
                contraries,
                rules,
                weights
            );
            this.applyGraphData(visNodes, visEdges, isolatedNodes);

        } catch (error) {
            console.error('Error updating assumption-level graph (direct):', error);
        }
    }

    /**
     * Assumption-level branching graph visualization
     * @param {string} frameworkCode - The WABA framework code
     * @param {ClingoManager} clingoManager - Reference to ClingoManager instance
     */
    async updateGraphAssumptionLevelBranching(frameworkCode, clingoManager, _config) {
        if (!clingoManager.clingoReady) {
            return;
        }

        try {
            const assumptions = ParserUtils.parseAssumptions(frameworkCode);
            const contraries = ParserUtils.parseContraries(frameworkCode);
            const rules = ParserUtils.parseRules(frameworkCode);
            const weights = ParserUtils.parseWeights(frameworkCode);
            const { visNodes, visEdges, isolatedNodes } = buildBranchingAssumptionGraph(
                assumptions,
                contraries,
                rules,
                weights
            );
            this.applyGraphData(visNodes, visEdges, isolatedNodes);

        } catch (error) {
            console.error('Error updating assumption-level graph:', error);
        }
    }
}
