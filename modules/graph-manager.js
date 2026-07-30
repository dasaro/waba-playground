/**
 * GraphManager - Handles graph visualization using vis.js
 * Note: This is a simplified version. Full graph update logic remains in app.js temporarily.
 */
import { GraphUtils } from './graph-utils.js?v=20260730-34';
import { ParserUtils } from './parser-utils.js?v=20260730-34';
import { UIManager } from './ui-manager.js?v=20260730-34';
import { buildBranchingAssumptionGraph, buildDirectAssumptionGraph } from './graph-assumption-builder.js?v=20260730-34';
import { buildHighlightUpdates, buildResetUpdates, renderIsolatedAssumptionsOverlay } from './graph-highlighting.js?v=20260730-34';
import { buildSetAttackTooltip, buildSetNodeTooltip } from './graph-tooltip-builder.js?v=20260730-34';

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

        // Track the container's box rather than listening for specific events. A panel
        // collapse, a fullscreen transition and a window resize all change it, and only the
        // fullscreen case was handled.
        if (typeof ResizeObserver !== 'undefined' && this.graphCanvas) {
            let pending = null;
            this._resizeObserver = new ResizeObserver(() => {
                // Coalesce: the observer fires per frame during a drag-resize.
                if (pending) clearTimeout(pending);
                pending = setTimeout(() => {
                    pending = null;
                    this.resizeToContainer();
                }, 120);
            });
            this._resizeObserver.observe(this.graphCanvas);
        }

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
        // Both handlers used to DISABLE physics, removing it from the one moment it is
        // unambiguously wanted. vis pins the dragged node for the duration, so neighbours relax
        // around it and nothing else drifts; physics goes back off immediately after, so a
        // highlight update cannot restart the simulation.
        this.network.on('dragStart', () => {
            this.network.setOptions({ physics: { enabled: true, stabilization: { enabled: false } } });
        });

        this.network.on('dragEnd', () => {
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

        // vis caches its canvas dimensions; redraw() re-paints but never re-measures the
        // container. So entering fullscreen grew the panel to 100vh while the canvas kept its
        // windowed height, leaving the graph in a short band with dead space beneath it -- the
        // CSS even claimed "vis.js is explicitly resized via setSize()", which nothing did.
        // One frame later, so the browser has applied the fullscreen box.
        requestAnimationFrame(() => this.resizeToContainer({ animate: true }));
    }

    /**
     * Re-measure the container and hand vis the new size.
     *
     * Used for fullscreen transitions AND ordinary window resizes: before this, nothing
     * re-fitted on resize either, so dragging the window narrower cropped the graph instead of
     * rescaling it.
     */
    resizeToContainer({ animate = false } = {}) {
        if (!this.network || !this.graphCanvas) {
            return;
        }
        try {
            const { width, height } = this.graphCanvas.getBoundingClientRect();
            if (width < 1 || height < 1) {
                return;
            }
            this.network.setSize(`${Math.round(width)}px`, `${Math.round(height)}px`);
            this.network.redraw();
            this.network.fit(animate
                ? { animation: { duration: 300, easingFunction: 'easeInOutQuad' } }
                : {});
        } catch (error) {
            console.warn('Graph resize failed:', error);
        }
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
        // Curvature ladder + self-loop angles, assigned once here so every builder gets it and
        // no build site has to remember. See GraphUtils.assignEdgeGeometry.
        const laidOut = GraphUtils.assignEdgeGeometry(visEdges || []);
        this.networkData.edges.add(laidOut.map((edge) => withElementTitle(edge)));
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

        // Settle = physics finished AND the camera finished moving.
        //
        // This used to be three uncoordinated timers: stabilisation ran for as long as it
        // needed, a fit was queued at a blind +600 ms, and its animation ran another 500. So
        // the fit could fire mid-stabilisation, and anything waiting on the settle could
        // resume while the layout was still visibly rearranging itself -- measured: node
        // positions moved by up to 200 units after the "settled" signal. Chain them instead:
        // fit when the layout is actually done, resolve when the fit animation is done.
        const FIT_DURATION = 500;
        const SETTLE_CEILING = 4000;
        this.cameraSettled = new Promise((resolve) => {
            let finished = false;
            const finish = () => {
                if (finished) return;
                finished = true;
                this.network.fit({
                    animation: { duration: FIT_DURATION, easingFunction: 'easeInOutQuad' }
                });
                setTimeout(resolve, FIT_DURATION + 50);
            };
            this.network.once('stabilizationIterationsDone', finish);
            // Safety net: a graph small enough to be stable already may never emit the event.
            setTimeout(finish, SETTLE_CEILING);
            // Started AFTER the listener is attached. Attaching afterwards raced a
            // stabilisation that vis can complete synchronously inside setOptions, in which
            // case the event was already gone and every settle waited out the full ceiling --
            // it took the browser suite from 1.4 to 5.1 minutes.
            this.runGraphLayout(true);
        });
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

            // Attack edges: ONE per (source set, attacked assumption).
            //
            // This used to nest a second loop over every set CONTAINING the attacked
            // assumption, emitting 2^(n-1) copies of each attack. The Three-Way Standoff --
            // three assumptions, three real attacks -- became 48 edges over 7 nodes, and at
            // the n=5 cap it reached four figures. Worse, the fan mechanically manufactured
            // true parallel edges: a source set attacking two assumptions that both live in
            // one target set produced two edges with identical endpoints carrying different
            // weights, one drawn exactly on top of the other.
            //
            // Every one of those edges was deducible from "S attacks A" plus "A is a member of
            // T", and membership is already written on the node label. So draw the attack at
            // the singleton {A}, which is the minimal set carrying it, and let the lattice say
            // the rest. No information is lost and no edge is drawn twice.
            setsMap.forEach(set => {
                set.attacks.forEach(attack => {
                    const { assumption, attackingElement, weight, derivedBy } = attack;
                    const displayWeight = weight === Infinity ? '#sup'
                        : (weight === -Infinity ? '#inf' : weight);
                    // Prefer the singleton; fall back to the smallest set carrying the
                    // assumption if the cap dropped it.
                    let targetId = assumption;
                    if (!setsMap.has(targetId)) {
                        let best = null;
                        setsMap.forEach((candidate) => {
                            if (!candidate.assumptions.includes(assumption)) return;
                            if (best === null || candidate.assumptions.length < best.assumptions.length) {
                                best = candidate;
                            }
                        });
                        if (!best) return;
                        targetId = best.id;
                    }
                    elements.push({
                        data: {
                            id: `${set.id}-attacks-${assumption}-from-${attackingElement}`,
                            source: set.id,
                            target: targetId,
                            label: `${displayWeight}`,
                            width: GraphUtils.baseWidthForWeight(weight),
                            baseWidth: GraphUtils.baseWidthForWeight(weight),
                            weight: attack.weight,
                            attackType: 'attack',
                            attackedAssumption: assumption,
                            attackingElement: attackingElement,
                            derivedBy: derivedBy,
                            sourceSet: set.id,
                            targetSet: targetId,
                            title: buildSetAttackTooltip({
                                sourceSet: set.id,
                                targetSet: targetId,
                                targetAssumption: assumption,
                                attackingElement,
                                weight: attack.weight,
                                derivedBy
                            })
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
                    const p = GraphUtils.palette();
                    const edgeColor = { color: p.line, highlight: p.lineStrong, hover: p.lineStrong };
                    visEdges.push({
                        id: el.data.id,
                        from: el.data.source,
                        to: el.data.target,
                        label: el.data.label,
                        width: el.data.width,
                        baseWidth: el.data.baseWidth ?? el.data.width,
                        originalWidth: el.data.width,  // Store original for reset
                        color: edgeColor,
                        originalColor: edgeColor,  // Store original for reset
                        dashes: false,
                        originalDashes: false,  // Store original for reset
                        attackType: 'attack',
                        // Which set SUPPORTS this attack. In the set graph an attack is live
                        // exactly when the selected extension is the set that mounts it -- the
                        // generic "are all its contributors IN" test cannot decide that,
                        // because attackingElement here is a DERIVED atom, not an assumption,
                        // so it never matched and no standard-mode attack could ever be active.
                        sourceSetMembers: el.data.sourceSet === '∅'
                            ? [] : String(el.data.sourceSet).split(','),
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
                    const p = GraphUtils.palette();
                    const nodeColor = {
                        background: p.surface,
                        border: p.line,
                        highlight: { background: p.surface, border: p.lineStrong }
                    };

                    const nodeData = {
                        id: el.data.id,
                        label: el.data.label,
                        shape: 'box',
                        shapeProperties: { borderRadius: 8 },
                        color: nodeColor,
                        title: buildSetNodeTooltip({
                            setId: el.data.id,
                            assumptions: el.data.id === '∅' ? [] : el.data.id.split(','),
                            supported: el.data.supported ? el.data.supported.split(', ').filter(Boolean) : [],
                            attacks: Array.from(setsMap.get(el.data.id)?.attacks || [])
                        }),
                        font: { color: p.ink },
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
