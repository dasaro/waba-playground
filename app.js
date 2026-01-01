// WABA Playground - Modular Application (ES6)

import { ThemeManager } from './modules/theme-manager.js';
import { FontManager } from './modules/font-manager.js';
import { UIManager } from './modules/ui-manager.js';
import { FileManager } from './modules/file-manager.js';
import { ParserUtils } from './modules/parser-utils.js';
import { GraphUtils } from './modules/graph-utils.js';
import { GraphManager } from './modules/graph-manager.js';
import { PopupManager } from './modules/popup-manager.js';
import { ClingoManager } from './modules/clingo-manager.js';
import { OutputManager } from './modules/output-manager.js';
import { examples } from './examples.js';

class WABAPlayground {
    constructor() {
        // DOM element references
        this.editor = document.getElementById('code-editor');
        this.output = document.getElementById('output');
        this.stats = document.getElementById('stats');
        this.runBtn = document.getElementById('run-btn');
        this.clearBtn = document.getElementById('clear-btn');
        this.semiringSelect = document.getElementById('semiring-select');
        this.monoidSelect = document.getElementById('monoid-select');
        this.semanticsSelect = document.getElementById('semantics-select');
        this.exampleSelect = document.getElementById('example-select');
        this.budgetInput = document.getElementById('budget-input');
        this.numModelsInput = document.getElementById('num-models-input');
        this.optimizeSelect = document.getElementById('optimize-select');
        this.optModeSelect = document.getElementById('opt-mode-select');
        this.constraintSelect = document.getElementById('constraint-select');
        this.graphModeRadios = document.querySelectorAll('input[name="graph-mode"]');

        // Simple ABA mode elements
        this.inputMode = document.getElementById('input-mode');
        this.simpleMode = document.getElementById('simple-mode');
        this.rulesInput = document.getElementById('rules-input');
        this.assumptionsInput = document.getElementById('assumptions-input');
        this.contrariesInput = document.getElementById('contraries-input');
        this.weightsInput = document.getElementById('weights-input');

        // File upload elements
        this.fileUploadBtn = document.getElementById('file-upload-btn');
        this.fileUploadInput = document.getElementById('file-upload-input');

        // Graph visualization elements
        this.graphCanvas = document.getElementById('cy');
        this.graphContainer = document.getElementById('graph-container');
        this.resetLayoutBtn = document.getElementById('reset-layout-btn');
        this.fullscreenBtn = document.getElementById('fullscreen-btn');

        // Syntax guide and download
        this.syntaxGuideBtn = document.getElementById('syntax-guide-btn');
        this.syntaxGuideModal = document.getElementById('syntax-guide-modal');
        this.syntaxGuideClose = document.getElementById('syntax-guide-close');
        this.downloadLpBtn = document.getElementById('download-lp-btn');
        this.downloadWabaBtn = document.getElementById('download-waba-btn');

        // Legend
        this.legendToggleBtn = document.getElementById('legend-toggle-btn');
        this.graphLegend = document.getElementById('graph-legend');

        // Export buttons
        this.exportPngBtn = document.getElementById('export-png-btn');
        this.exportPdfBtn = document.getElementById('export-pdf-btn');

        // Theme toggle
        this.themeToggleBtn = document.getElementById('theme-toggle-btn');
        this.themeIcon = document.getElementById('theme-icon');

        // Font size controls
        this.fontIncreaseBtn = document.getElementById('font-increase-btn');
        this.fontDecreaseBtn = document.getElementById('font-decrease-btn');

        // Initialize managers (NEW MODULAR ARCHITECTURE)
        this.initializeManagers();

        // Show loading message
        this.output.innerHTML = '<div class="info-message">⏳ Loading Clingo WASM library...</div>';

        // Initialize app
        this.initializeApp();
    }

    initializeManagers() {
        // Initialize Graph Manager
        this.graphManager = new GraphManager(this.graphCanvas, this.resetLayoutBtn);
        // Share network references for backwards compatibility
        this.network = null; // Will be set by graphManager.initGraph()
        this.networkData = { nodes: null, edges: null };
        this.isolatedNodes = [];

        // Initialize Theme Manager
        this.themeManager = new ThemeManager(
            this.themeToggleBtn,
            this.themeIcon,
            () => this.network, // Lazy getter for network
            () => this.networkData // Lazy getter for networkData
        );

        // Initialize Font Manager
        this.fontManager = new FontManager(
            this.fontIncreaseBtn,
            this.fontDecreaseBtn
        );

        // Initialize UI Manager
        this.uiManager = new UIManager(
            this.syntaxGuideBtn,
            this.syntaxGuideModal,
            this.syntaxGuideClose,
            this.fullscreenBtn,
            this.graphContainer
        );

        // Initialize File Manager
        this.fileManager = new FileManager(
            this.fileUploadBtn,
            this.fileUploadInput,
            this.inputMode,
            this.simpleMode,
            this.editor,
            this.assumptionsInput,
            this.rulesInput,
            this.contrariesInput,
            this.weightsInput
        );

        // Initialize Clingo Manager
        this.clingoManager = new ClingoManager(this.runBtn);

        // Initialize Output Manager
        this.outputManager = new OutputManager(
            this.output,
            this.stats,
            this.semiringSelect,
            this.monoidSelect,
            this.optimizeSelect
        );
    }

    async initializeApp() {
        // Initialize theme
        this.themeManager.initTheme();

        // Initialize font size
        this.fontManager.initFontSize();

        // Initialize Clingo
        await this.clingoManager.initClingo();

        // Initialize graph
        this.graphManager.initGraph();
        // Share network references
        this.network = this.graphManager.network;
        this.networkData = this.graphManager.networkData;

        // Update theme manager with initialized network
        this.themeManager.network = this.network;
        this.themeManager.networkData = this.networkData;

        // Setup graph click event listeners for popups
        this.graphManager.setupEventListeners(
            (node, x, y) => this.handleNodeClick(node, x, y),
            (edge, x, y) => this.handleEdgeClick(edge, x, y)
        );

        // Setup fullscreen change callback to resize graph
        this.uiManager.setFullscreenChangeCallback(() => {
            if (this.network) {
                this.network.redraw();
                this.network.fit();
            }
        });

        // Attach event listeners
        this.attachEventListeners();

        // Initialize simple mode
        this.initSimpleMode();

        // Initialize empty states
        UIManager.initializeEmptyStates();

        // Preload selected example on startup
        setTimeout(() => {
            const selectedExample = this.exampleSelect.value;
            if (selectedExample) {
                this.loadExample(selectedExample);
            }
        }, 100);
    }

    // ===================================
    // Event Listeners
    // ===================================
    attachEventListeners() {
        // Run and clear buttons
        this.runBtn.addEventListener('click', () => this.runWABA());
        this.clearBtn.addEventListener('click', () => this.clearOutput());

        // Example selection
        this.exampleSelect.addEventListener('change', (e) => this.loadExample(e.target.value));

        // File upload
        this.fileUploadBtn.addEventListener('click', () => this.fileUploadInput.click());
        this.fileUploadInput.addEventListener('change', (e) => {
            this.fileManager.handleFileUpload(
                e,
                (code) => this.updateGraph(code),
                () => this.parseSimpleABA(),
                (msg, type) => this.outputManager.log(msg, type)
            );
        });

        // Graph mode changes
        this.semiringSelect.addEventListener('change', () => this.regenerateGraph());
        this.semanticsSelect.addEventListener('change', () => this.regenerateGraph());
        this.graphModeRadios.forEach(radio => {
            radio.addEventListener('change', () => this.regenerateGraph());
        });

        // Disable budget when optimization is enabled
        this.optimizeSelect.addEventListener('change', (e) => {
            const isOptimizing = e.target.value !== 'none';
            this.constraintSelect.disabled = isOptimizing;
            this.budgetInput.disabled = isOptimizing;
            if (isOptimizing) {
                this.constraintSelect.style.opacity = '0.5';
                this.budgetInput.style.opacity = '0.5';
            } else {
                this.constraintSelect.style.opacity = '1';
                this.budgetInput.style.opacity = '1';
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.runWABA();
            }
        });

        // Syntax guide modal
        this.syntaxGuideBtn.addEventListener('click', () => this.uiManager.openSyntaxGuide());
        this.syntaxGuideClose.addEventListener('click', () => this.uiManager.closeSyntaxGuide());
        this.syntaxGuideModal.addEventListener('click', (e) => {
            if (e.target === this.syntaxGuideModal) {
                this.uiManager.closeSyntaxGuide();
            }
        });

        // Download buttons
        this.downloadLpBtn.addEventListener('click', () => this.downloadAsLp());
        this.downloadWabaBtn.addEventListener('click', () => this.downloadAsWaba());

        // Fullscreen button
        this.fullscreenBtn.addEventListener('click', () => this.uiManager.toggleFullscreen());
        document.addEventListener('fullscreenchange', () => this.uiManager.updateFullscreenButton());

        // Legend toggle button
        this.legendToggleBtn.addEventListener('click', () => this.toggleLegend());

        // Export buttons
        this.exportPngBtn.addEventListener('click', () => this.exportGraphAsPng());
        this.exportPdfBtn.addEventListener('click', () => this.exportGraphAsPdf());
    }

    toggleLegend() {
        const isHidden = this.graphLegend.hasAttribute('hidden');
        if (isHidden) {
            this.graphLegend.removeAttribute('hidden');
            this.legendToggleBtn.setAttribute('aria-expanded', 'true');
        } else {
            this.graphLegend.setAttribute('hidden', '');
            this.legendToggleBtn.setAttribute('aria-expanded', 'false');
        }
    }

    exportGraphInLightMode(callback) {
        // Temporarily switch to light mode for export
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const wasLight = currentTheme === 'light';

        if (!wasLight) {
            // Switch to light mode
            document.documentElement.setAttribute('data-theme', 'light');
            this.themeManager.updateGraphTheme();

            // Wait for graph to re-render
            setTimeout(() => {
                callback();
                // Restore original theme
                setTimeout(() => {
                    document.documentElement.setAttribute('data-theme', currentTheme || 'dark');
                    this.themeManager.updateGraphTheme();
                }, 100);
            }, 200);
        } else {
            // Already in light mode
            callback();
        }
    }

    addWatermark(sourceCanvas) {
        // Create a new canvas with watermark
        const watermarkedCanvas = document.createElement('canvas');
        watermarkedCanvas.width = sourceCanvas.width;
        watermarkedCanvas.height = sourceCanvas.height;
        const ctx = watermarkedCanvas.getContext('2d');

        // Draw original canvas
        ctx.drawImage(sourceCanvas, 0, 0);

        // Add watermark in bottom-right corner
        ctx.save();

        // Generate timestamp
        const now = new Date();
        const dateTime = now.toISOString().slice(0, 19).replace('T', ' ');

        // Watermark text
        const line1 = `Generated with WABA Playground by Fabio Aurelio d'Asaro (${dateTime})`;
        const line2 = 'https://github.com/dasaro/waba-playground';

        // Small font
        const fontSize = 11;
        ctx.font = `${fontSize}px Arial`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';

        const padding = 8;
        const lineHeight = fontSize + 3;
        const x = watermarkedCanvas.width - padding;
        const y2 = watermarkedCanvas.height - padding;
        const y1 = y2 - lineHeight;

        // Measure text to create background rectangle
        const text1Width = ctx.measureText(line1).width;
        const text2Width = ctx.measureText(line2).width;
        const maxWidth = Math.max(text1Width, text2Width);

        const bgPadding = 4;
        const bgX = x - maxWidth - bgPadding;
        const bgY = y1 - fontSize - bgPadding;
        const bgWidth = maxWidth + bgPadding * 2;
        const bgHeight = lineHeight * 2 + bgPadding * 2;

        // Draw white background rectangle
        ctx.fillStyle = 'white';
        ctx.fillRect(bgX, bgY, bgWidth, bgHeight);

        // Draw black text
        ctx.fillStyle = 'black';
        ctx.fillText(line1, x, y1);
        ctx.fillText(line2, x, y2);

        ctx.restore();
        return watermarkedCanvas;
    }

    exportGraphAsPng() {
        if (!this.graphManager.network) {
            alert('No graph to export. Please run WABA first.');
            return;
        }

        // Export in light mode
        this.exportGraphInLightMode(() => {
            const sourceCanvas = this.graphManager.network.canvas.frame.canvas;
            const watermarkedCanvas = this.addWatermark(sourceCanvas);

            watermarkedCanvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'waba-graph.png';
                link.click();
                URL.revokeObjectURL(url);
            });
        });
    }

    exportGraphAsPdf() {
        if (!this.graphManager.network) {
            alert('No graph to export. Please run WABA first.');
            return;
        }

        // Export in light mode
        this.exportGraphInLightMode(() => {
            const sourceCanvas = this.graphManager.network.canvas.frame.canvas;
            const watermarkedCanvas = this.addWatermark(sourceCanvas);

            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            watermarkedCanvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `waba-graph-${timestamp}.png`;
                link.click();
                URL.revokeObjectURL(url);
            }, 'image/png', 1.0);  // Quality 1.0 for high-resolution export
        });
    }

    // ===================================
    // Main WABA Execution
    // ===================================
    async runWABA() {
        UIManager.showLoadingOverlay('Running WABA...', 'Computing extensions and visualizing results');

        try {
            // Get framework code
            let framework;
            if (this.inputMode.value === 'simple') {
                framework = this.parseSimpleABA();
            } else {
                framework = this.editor.value.trim();
            }

            if (!framework) {
                this.outputManager.log('⚠️ No framework code to run', 'warning');
                UIManager.hideLoadingOverlay();
                return;
            }

            // Build configuration
            const config = {
                semiring: this.semiringSelect.value,
                monoid: this.monoidSelect.value,
                direction: 'minimization', // Default to minimization
                semantics: this.semanticsSelect.value,
                constraint: this.constraintSelect.value,
                budget: parseInt(this.budgetInput.value) || 0,
                numModels: parseInt(this.numModelsInput.value) || 0,
                optMode: this.optModeSelect.value, // 'ignore' or 'optN'
                filterType: 'standard'
            };

            // Run WABA via Clingo Manager
            const result = await this.clingoManager.runWABA(
                framework,
                config,
                (msg, type) => this.outputManager.log(msg, type)
            );

            if (result) {
                // Clear previous output
                this.clearOutput();

                // Update graph visualization FIRST (before displaying results)
                // This ensures the graph is ready when click handlers are set up
                await this.updateGraph(framework);

                // THEN display results (with click handlers that reference the now-ready graph)
                this.outputManager.displayResults(
                    result.result,
                    result.elapsed,
                    (inAssumptions, discarded, successful) => this.graphManager.highlightExtension(inAssumptions, discarded, successful),
                    () => this.graphManager.resetGraphColors()
                );

                // Hide output empty state
                UIManager.hideOutputEmptyState();
            }

        } catch (error) {
            console.error('Error in runWABA:', error);
            this.outputManager.log(`❌ Error: ${error.message}`, 'error');
        } finally {
            UIManager.hideLoadingOverlay();
        }
    }

    // ===================================
    // Graph Visualization
    // ===================================
    async regenerateGraph() {
        let framework;
        if (this.inputMode.value === 'simple') {
            framework = this.parseSimpleABA();
        } else {
            framework = this.editor.value.trim();
        }

        if (framework) {
            await this.updateGraph(framework);
        }
    }

    async updateGraph(frameworkCode) {
        // Get selected graph mode
        const selectedMode = Array.from(this.graphModeRadios).find(r => r.checked);
        const mode = selectedMode ? selectedMode.value : 'standard';

        // Delegate to appropriate update method based on mode
        if (mode === 'assumption-direct') {
            await this.updateGraphAssumptionLevelDirect(frameworkCode);
        } else if (mode === 'assumption-branching') {
            await this.updateGraphAssumptionLevelBranching(frameworkCode);
        } else {
            await this.updateGraphStandard(frameworkCode);
        }
    }

    // Note: The full graph update methods (updateGraphStandard, updateGraphAssumptionLevelDirect,
    // updateGraphAssumptionLevelBranching) are very large. For now, they remain as simplified stubs.
    // The full implementations from app.js.backup can be migrated here if needed.

    async updateGraphStandard(frameworkCode) {
        if (!this.clingoManager.clingoReady) {
            return;
        }

        try {
            const semiring = this.semiringSelect.value;

            // Build set-based attack graph program
            const setProgram = `
${frameworkCode}
${this.clingoManager.getCoreModule()}
${this.clingoManager.getSemiringModule(semiring)}

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
            this.graphManager.isolatedNodes = isolatedNodes;
            if (isolatedNodes.length > 0) {
                console.log(`Filtered ${isolatedNodes.length} isolated nodes:`, isolatedNodes.map(n => n.id));
            }

            // Update vis.js network
            this.graphManager.networkData.nodes.clear();
            this.graphManager.networkData.edges.clear();
            this.graphManager.networkData.nodes.add(visNodes);
            this.graphManager.networkData.edges.add(visEdges);

            // Hide graph empty state after successful render
            UIManager.hideGraphEmptyState();

            // Store framework code and mode
            this.currentFrameworkCode = frameworkCode;
            this.currentGraphMode = 'standard';

            // Update banner with isolated assumptions
            this.graphManager.updateIsolatedAssumptionsOverlay();

            // Run layout and then fit to view with animation
            this.graphManager.runGraphLayout(true); // Use quick mode for cleaner initial layout

            // Auto-zoom and center after layout stabilizes
            setTimeout(() => {
                this.graphManager.network.fit({
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
    async updateGraphAssumptionLevelDirect(frameworkCode) {
        if (!this.clingoManager.clingoReady) {
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
            this.graphManager.networkData.nodes.clear();
            this.graphManager.networkData.edges.clear();
            this.graphManager.networkData.nodes.add(visNodes);
            this.graphManager.networkData.edges.add(visEdges);

            // Hide graph empty state after successful render
            UIManager.hideGraphEmptyState();

            // Store framework code and mode
            this.currentFrameworkCode = frameworkCode;
            this.currentGraphMode = 'assumption-direct';

            // Store isolated assumptions for display
            this.graphManager.isolatedNodes = isolatedAssumptions.map(a => ({ id: a, assumptions: [a] }));
            this.graphManager.updateIsolatedAssumptionsOverlay();

            // Run layout and fit to view
            this.graphManager.runGraphLayout(true);

            setTimeout(() => {
                this.graphManager.network.fit({
                    animation: {
                        duration: 500,
                        easingFunction: 'easeInOutQuad'
                    }
                });
            }, 600);

        } catch (error) {
            console.error('Error updating assumption-level graph (direct):', error);
        }
    }

    async updateGraphAssumptionLevelBranching(frameworkCode) {
        if (!this.clingoManager.clingoReady) {
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
            this.graphManager.networkData.nodes.clear();
            this.graphManager.networkData.edges.clear();
            this.graphManager.networkData.nodes.add(visNodes);
            this.graphManager.networkData.edges.add(visEdges);

            // Hide graph empty state after successful render
            UIManager.hideGraphEmptyState();

            // Store framework code and mode
            this.currentFrameworkCode = frameworkCode;
            this.currentGraphMode = 'assumption-branching';

            // Store isolated assumptions for display
            this.graphManager.isolatedNodes = isolatedAssumptions.map(a => ({ id: a, assumptions: [a] }));
            this.graphManager.updateIsolatedAssumptionsOverlay();

            // Run layout and fit to view
            this.graphManager.runGraphLayout(true);

            setTimeout(() => {
                this.graphManager.network.fit({
                    animation: {
                        duration: 500,
                        easingFunction: 'easeInOutQuad'
                    }
                });
            }, 600);

        } catch (error) {
            console.error('Error updating assumption-level graph:', error);
        }
    }


    // ===================================
    // Simple Mode
    // ===================================
    initSimpleMode() {
        // Toggle between simple and advanced mode
        this.inputMode.addEventListener('change', (e) => {
            if (e.target.value === 'simple') {
                this.simpleMode.style.display = 'block';
                this.editor.style.display = 'none';
            } else {
                this.simpleMode.style.display = 'none';
                this.editor.style.display = 'block';
            }
        });

        // Update graph when simple mode inputs change
        [this.assumptionsInput, this.rulesInput, this.contrariesInput, this.weightsInput].forEach(input => {
            input.addEventListener('input', () => {
                if (this.inputMode.value === 'simple') {
                    this.regenerateGraph();
                }
            });
        });

        // Initial state
        if (this.inputMode.value === 'simple') {
            this.simpleMode.style.display = 'block';
            this.editor.style.display = 'none';
        } else {
            this.simpleMode.style.display = 'none';
            this.editor.style.display = 'block';
        }
    }

    parseSimpleABA() {
        const rulesText = this.rulesInput.value.trim().split('\n').map(s => s.trim()).filter(s => s);
        const assumptions = this.assumptionsInput.value.trim().split('\n').map(s => s.trim()).filter(s => s);
        const contrariesText = this.contrariesInput.value.trim().split('\n').map(s => s.trim()).filter(s => s);
        const weightsText = this.weightsInput.value.trim().split('\n').map(s => s.trim()).filter(s => s);

        let clingoCode = '%% Auto-generated from Simple ABA Mode\n\n';

        // Parse assumptions
        if (assumptions.length > 0) {
            clingoCode += '%% Assumptions\n';
            assumptions.forEach(a => {
                clingoCode += `assumption(${a}).\n`;
            });
            clingoCode += '\n';
        }

        // Parse weights
        if (weightsText.length > 0) {
            clingoCode += '%% Weights\n';
            weightsText.forEach(line => {
                const match = line.match(/^([a-z_][a-z0-9_]*)\s*:\s*(\d+)$/i);
                if (match) {
                    const [, atom, weight] = match;
                    clingoCode += `weight(${atom}, ${weight}).\n`;
                }
            });
            clingoCode += '\n';
        }

        // Parse rules
        if (rulesText.length > 0) {
            clingoCode += '%% Rules\n';
            let ruleCounter = 1;
            rulesText.forEach((rule) => {
                const match = rule.match(/^([a-z_][a-z0-9_]*)\s*<-\s*(.*)$/i);
                if (match) {
                    const [, head, bodyStr] = match;
                    const ruleId = `r${ruleCounter++}`;

                    if (bodyStr.trim() === '') {
                        clingoCode += `% ${ruleId}: ${head} <- (fact)\n`;
                        clingoCode += `head(${ruleId}, ${head}).\n`;
                    } else {
                        const bodyAtoms = bodyStr.split(',').map(s => s.trim()).filter(s => s);
                        clingoCode += `% ${ruleId}: ${head} <- ${bodyAtoms.join(', ')}\n`;
                        clingoCode += `head(${ruleId}, ${head}). body(${ruleId}, ${bodyAtoms.join(`; ${ruleId}, `)}).\n`;
                    }
                }
            });
            clingoCode += '\n';
        }

        // Parse contraries
        if (contrariesText.length > 0) {
            clingoCode += '%% Contraries\n';
            contrariesText.forEach(line => {
                const match = line.match(/^\(\s*([a-z_][a-z0-9_]*)\s*,\s*([a-z_][a-z0-9_]*)\s*\)$/i);
                if (match) {
                    const [, assumption, contrary] = match;
                    clingoCode += `contrary(${assumption}, ${contrary}).\n`;
                }
            });
        }

        return clingoCode;
    }

    populateSimpleModeFromClingo(clingoCode) {
        // Parse clingo code and populate simple mode fields
        const assumptions = ParserUtils.parseAssumptions(clingoCode);
        const contraries = ParserUtils.parseContraries(clingoCode);
        const rules = ParserUtils.parseRules(clingoCode);
        const weights = ParserUtils.parseWeights(clingoCode);

        // Populate assumptions
        this.assumptionsInput.value = assumptions.join('\n');

        // Populate rules
        const rulesFormatted = rules.map(r => {
            const bodyStr = r.body.length > 0 ? r.body.join(', ') : '';
            return `${r.head} <- ${bodyStr}`;
        });
        this.rulesInput.value = rulesFormatted.join('\n');

        // Populate contraries
        const contrariesFormatted = contraries.map(c => `(${c.assumption}, ${c.contrary})`);
        this.contrariesInput.value = contrariesFormatted.join('\n');

        // Populate weights
        const weightsFormatted = Object.entries(weights).map(([atom, weight]) => `${atom}: ${weight}`);
        this.weightsInput.value = weightsFormatted.join('\n');
    }

    // ===================================
    // Example Loading
    // ===================================
    async loadExample(exampleName) {
        if (exampleName && examples && examples[exampleName]) {
            try {
                const clingoCode = examples[exampleName];
                this.editor.value = clingoCode;

                // Also parse and populate simple mode fields
                this.populateSimpleModeFromClingo(clingoCode);

                // Update graph visualization
                await this.updateGraph(clingoCode);

                this.outputManager.log(`📚 Loaded example: ${exampleName}`, 'info');
            } catch (error) {
                console.error(`Error loading example ${exampleName}:`, error);
                this.outputManager.log(`❌ Error loading example: ${error.message}`, 'error');
            }
        } else if (exampleName) {
            console.error(`Example not found: ${exampleName}`);
            console.log('Available examples:', Object.keys(examples || {}));
            this.outputManager.log(`❌ Example "${exampleName}" not found`, 'error');
        }
    }

    // ===================================
    // File Download
    // ===================================
    downloadAsLp() {
        let frameworkCode;
        if (this.inputMode.value === 'simple') {
            frameworkCode = this.parseSimpleABA();
        } else {
            frameworkCode = this.editor.value.trim();
        }

        this.fileManager.downloadAsLp(
            frameworkCode,
            (msg, type) => this.outputManager.log(msg, type)
        );
    }

    downloadAsWaba() {
        let wabaContent;
        if (this.inputMode.value === 'simple') {
            wabaContent = this.fileManager.generateWabaFormat();
        } else {
            const clingoCode = this.editor.value.trim();
            if (!clingoCode) {
                this.outputManager.log('⚠️ No framework code to download', 'warning');
                return;
            }
            wabaContent = this.fileManager.convertLpToWaba(clingoCode);
        }

        this.fileManager.downloadAsWaba(
            wabaContent,
            (msg, type) => this.outputManager.log(msg, type)
        );
    }

    // ===================================
    // Output Management
    // ===================================
    clearOutput() {
        this.outputManager.clearOutput();
    }

    // ===================================
    // Graph Event Handlers
    // ===================================
    handleNodeClick(node, x, y) {
        // Show node popup with details
        PopupManager.showNodePopup(node, x, y, {
            frameworkCode: this.currentFrameworkCode,
            graphMode: this.currentGraphMode
        });
    }

    handleEdgeClick(edge, x, y) {
        // Show edge popup with attack details
        PopupManager.showEdgePopup(edge, x, y);
    }
}

// Initialize the playground when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.playground = new WABAPlayground();

    // Expose examples globally for backwards compatibility
    window.WABAExamples = examples;
});
