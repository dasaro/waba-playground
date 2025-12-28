// WABA Playground - Main Application Logic

class WABAPlayground {
    constructor() {
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
        this.constraintSelect = document.getElementById('constraint-select');
        this.flatConstraint = document.getElementById('flat-constraint');
        this.graphModeRadios = document.querySelectorAll('input[name="graph-mode"]');

        // Simple ABA mode elements
        this.inputMode = document.getElementById('input-mode');
        this.simpleMode = document.getElementById('simple-mode');
        this.rulesInput = document.getElementById('rules-input');
        this.assumptionsInput = document.getElementById('assumptions-input');
        this.contrariesInput = document.getElementById('contraries-input');
        this.weightsInput = document.getElementById('weights-input');

        // Graph visualization elements
        this.graphCanvas = document.getElementById('cy');
        this.graphContainer = document.getElementById('graph-container');
        this.resetLayoutBtn = document.getElementById('reset-layout-btn');
        this.fullscreenBtn = document.getElementById('fullscreen-btn');
        this.network = null; // vis.js network instance
        this.networkData = { nodes: null, edges: null }; // vis.js DataSets
        this.isolatedNodes = []; // Track isolated assumption sets for display

        // Theme toggle
        this.themeToggleBtn = document.getElementById('theme-toggle-btn');
        this.themeIcon = document.getElementById('theme-icon');

        // Font size controls
        this.fontIncreaseBtn = document.getElementById('font-increase-btn');
        this.fontDecreaseBtn = document.getElementById('font-decrease-btn');
        this.currentFontSize = 100; // Base font size percentage

        this.clingoReady = false;

        // Show loading message
        this.output.innerHTML = '<div class="info-message">⏳ Loading Clingo WASM library...</div>';

        this.initTheme();
        this.initFontSize();
        this.initClingo();
        this.initGraph();
        this.attachEventListeners();
        this.initSimpleMode();

        // Preload selected example on startup (respects HTML selected attribute)
        setTimeout(() => {
            const selectedExample = this.exampleSelect.value;
            if (selectedExample) {
                this.loadExample(selectedExample);
            }
        }, 100);
    }

    initTheme() {
        // Load saved theme or default to dark
        const savedTheme = localStorage.getItem('waba-theme') || 'dark';
        this.setTheme(savedTheme);

        // Add theme toggle listener
        this.themeToggleBtn.addEventListener('click', () => {
            this.toggleTheme();
        });
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('waba-theme', theme);

        // Update icon
        if (theme === 'light') {
            this.themeIcon.textContent = '☀️';
        } else {
            this.themeIcon.textContent = '🌙';
        }
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);

        // Update graph colors for new theme
        this.updateGraphTheme();
    }

    initFontSize() {
        // Load saved font size or default to 100%
        const savedFontSize = localStorage.getItem('waba-font-size') || '100';
        this.currentFontSize = parseInt(savedFontSize);
        this.setFontSize(this.currentFontSize);

        // Add font size control listeners
        this.fontIncreaseBtn.addEventListener('click', () => {
            this.increaseFontSize();
        });

        this.fontDecreaseBtn.addEventListener('click', () => {
            this.decreaseFontSize();
        });
    }

    setFontSize(percentage) {
        // Clamp between 60% and 200%
        percentage = Math.max(60, Math.min(200, percentage));
        this.currentFontSize = percentage;

        // Apply to document root
        document.documentElement.style.fontSize = `${percentage}%`;
        localStorage.setItem('waba-font-size', percentage.toString());
    }

    increaseFontSize() {
        this.setFontSize(this.currentFontSize + 10);
    }

    decreaseFontSize() {
        this.setFontSize(this.currentFontSize - 10);
    }

    updateGraphTheme() {
        if (!this.network) return;

        const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

        // Update edge font colors (for weight labels)
        const edges = this.networkData.edges.get();
        const edgeUpdates = edges.map(edge => ({
            id: edge.id,
            font: {
                ...edge.font,
                color: isDark ? '#cbd5e1' : '#64748b',
                background: isDark ? '#1e293b' : '#ffffff'
            }
        }));

        this.networkData.edges.update(edgeUpdates);

        // Update node font colors
        const nodes = this.networkData.nodes.get();
        const nodeUpdates = nodes.map(node => ({
            id: node.id,
            font: {
                ...node.font,
                color: isDark ? '#f1f5f9' : '#1e293b'
            }
        }));

        this.networkData.nodes.update(nodeUpdates);

        // Redraw without physics
        this.network.setOptions({ physics: { enabled: false } });
        this.network.redraw();
    }

    async initClingo() {
        // Wait for clingo to be available (CDN loading)
        const maxAttempts = 20; // 10 seconds max
        let attempts = 0;

        while (attempts < maxAttempts) {
            if (typeof clingo !== 'undefined') {
                try {
                    // Test that clingo.run is available
                    if (typeof clingo.run === 'function') {
                        this.clingoReady = true;
                        // Update intro status
                        const introStatus = document.getElementById('intro-status');
                        if (introStatus) {
                            introStatus.textContent = '✅ Clingo WASM loaded successfully';
                            introStatus.style.color = 'var(--success-color)';
                        }
                        return;
                    }
                } catch (e) {
                    // Continue waiting
                }
            }

            // Wait 500ms before next attempt
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
        }

        // If we get here, clingo didn't load
        const introStatus = document.getElementById('intro-status');
        if (introStatus) {
            introStatus.textContent = '❌ Failed to load Clingo - Please refresh the page';
            introStatus.style.color = 'var(--error-color)';
        }
        this.runBtn.disabled = true;
    }

    attachEventListeners() {
        this.runBtn.addEventListener('click', () => this.runWABA());
        this.clearBtn.addEventListener('click', () => this.clearOutput());
        this.exampleSelect.addEventListener('change', (e) => this.loadExample(e.target.value));

        // Regenerate graph when configuration changes
        this.semiringSelect.addEventListener('change', () => this.regenerateGraph());
        this.semanticsSelect.addEventListener('change', () => this.regenerateGraph());
        this.graphModeRadios.forEach(radio => {
            radio.addEventListener('change', () => this.regenerateGraph());
        });

        // Disable budget constraint when optimization is enabled
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
    }

    async regenerateGraph() {
        // Get current framework code based on input mode
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

    async loadExample(exampleName) {
        if (exampleName && window.WABAExamples && window.WABAExamples[exampleName]) {
            try {
                const clingoCode = window.WABAExamples[exampleName];
                this.editor.value = clingoCode;

                // Also parse and populate simple mode fields
                this.populateSimpleModeFromClingo(clingoCode);

                // Update graph visualization
                await this.updateGraph(clingoCode);

                this.log(`📚 Loaded example: ${exampleName}`, 'info');
            } catch (error) {
                console.error(`Error loading example ${exampleName}:`, error);
                this.log(`❌ Error loading example: ${error.message}`, 'error');
            }
        } else if (exampleName) {
            console.error(`Example not found: ${exampleName}`);
            console.log('Available examples:', Object.keys(window.WABAExamples || {}));
            this.log(`❌ Example "${exampleName}" not found`, 'error');
        }
    }

    populateSimpleModeFromClingo(clingoCode) {
        // Pre-process: split multiple statements on same line (e.g., "head(r1,x). body(r1,y).")
        // Replace ". " with ".\n" to put each statement on its own line
        const preprocessed = clingoCode.replace(/\.\s+/g, '.\n');
        const lines = preprocessed.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%'));

        const assumptions = [];
        const weights = [];
        const contraries = [];
        const rules = new Map(); // ruleId -> {head, body}
        const allAtoms = new Set();

        // Parse each line
        lines.forEach(line => {
            // Parse assumptions: assumption(a).
            let match = line.match(/^assumption\(([^)]+)\)\.$/);
            if (match) {
                assumptions.push(match[1]);
                allAtoms.add(match[1]);
                return;
            }

            // Parse weights: weight(a, 80).
            match = line.match(/^weight\(([^,]+),\s*(\d+)\)\.$/);
            if (match) {
                weights.push(`${match[1]}: ${match[2]}`);
                allAtoms.add(match[1]);
                return;
            }

            // Parse head: head(r1, p).
            match = line.match(/^head\(([^,]+),\s*([^)]+)\)\.$/);
            if (match) {
                const [, ruleId, head] = match;
                if (!rules.has(ruleId)) {
                    rules.set(ruleId, { head: null, body: [] });
                }
                rules.get(ruleId).head = head;
                allAtoms.add(head);
                return;
            }

            // Parse body - both compact and separate forms:
            // Compact: body(r1, a; r1, b; r1, c).
            // Separate: body(r1, a).
            match = line.match(/^body\((.+)\)\.$/);
            if (match) {
                const bodyContent = match[1];
                // Split by semicolon to handle compact form
                const parts = bodyContent.split(';').map(p => p.trim());

                parts.forEach(part => {
                    // Each part should be "ruleId, atom"
                    const partMatch = part.match(/^([^,]+),\s*(.+)$/);
                    if (partMatch) {
                        const [, ruleId, atom] = partMatch;
                        if (!rules.has(ruleId)) {
                            rules.set(ruleId, { head: null, body: [] });
                        }
                        rules.get(ruleId).body.push(atom);
                        allAtoms.add(atom);
                    }
                });
                return;
            }

            // Parse contraries: contrary(a, c_a).
            match = line.match(/^contrary\(([^,]+),\s*([^)]+)\)\.$/);
            if (match) {
                contraries.push(`(${match[1]}, ${match[2]})`);
                allAtoms.add(match[1]);
                allAtoms.add(match[2]);
                return;
            }
        });

        // Convert rules to simple format
        const rulesSimple = [];

        rules.forEach((rule, ruleId) => {
            if (rule.head) {
                if (rule.body.length === 0) {
                    // Rule with empty body: fact
                    rulesSimple.push(`${rule.head} <-`);
                } else {
                    // Regular rule with body
                    rulesSimple.push(`${rule.head} <- ${rule.body.join(', ')}`);
                }
            }
        });

        // Populate simple mode fields
        this.assumptionsInput.value = assumptions.join('\n');
        this.weightsInput.value = weights.join('\n');
        this.rulesInput.value = rulesSimple.join('\n');
        this.contrariesInput.value = contraries.join('\n');
    }

    initSimpleMode() {
        // Set default simple mode values
        this.rulesInput.value = 'c_a <- b';
        this.assumptionsInput.value = 'a\nb\nc';
        this.contrariesInput.value = '(a, c_a)\n(b, c_b)\n(c, c_c)';
        this.weightsInput.value = 'a: 80\nb: 60\nc: 40\nc_a: 70\nc_b: 50\nc_c: 30';

        // Mode switcher with automatic translation
        this.inputMode.addEventListener('change', (e) => {
            if (e.target.value === 'simple') {
                // Switching to Simple Mode: parse ASP code and populate simple mode fields
                const aspCode = this.editor.value.trim();
                if (aspCode) {
                    this.populateSimpleModeFromClingo(aspCode);
                }
                this.simpleMode.style.display = 'block';
                this.editor.style.display = 'none';
            } else {
                // Switching to Advanced Mode: generate ASP code from simple mode fields
                const aspCode = this.parseSimpleABA();
                if (aspCode) {
                    this.editor.value = aspCode;
                }
                this.simpleMode.style.display = 'none';
                this.editor.style.display = 'block';
            }
        });
    }

    initGraph() {
        // Initialize vis.js network with empty data
        this.networkData.nodes = new vis.DataSet([]);
        this.networkData.edges = new vis.DataSet([]);

        // Get current theme for colors
        const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

        // vis.js network options
        const options = {
            nodes: {
                shape: 'ellipse',
                size: 20,
                font: {
                    size: 12,
                    color: isDark ? '#f1f5f9' : '#1e293b',
                    face: 'Inter, sans-serif'
                },
                borderWidth: 2,
                borderWidthSelected: 3,
                color: {
                    border: '#5568d3',
                    background: '#667eea',
                    highlight: {
                        border: '#4557c2',
                        background: '#5568d3'
                    }
                }
            },
            edges: {
                width: 2,
                arrows: {
                    to: {
                        enabled: true,
                        scaleFactor: 0.8
                    }
                },
                smooth: {
                    type: 'continuous',
                    roundness: 0.5
                },
                font: {
                    size: 11,
                    color: isDark ? '#cbd5e1' : '#64748b',
                    background: isDark ? '#1e293b' : '#ffffff',
                    strokeWidth: 0
                },
                selectionWidth: 3
            },
            physics: {
                enabled: true,
                solver: 'barnesHut',
                barnesHut: {
                    gravitationalConstant: -8000,
                    centralGravity: 0.3,
                    springLength: 200,
                    springConstant: 0.04,
                    damping: 0.09,
                    avoidOverlap: 0.5
                },
                stabilization: {
                    enabled: true,
                    iterations: 1000,
                    updateInterval: 25,
                    fit: true
                },
                timestep: 0.5,
                adaptiveTimestep: true
            },
            interaction: {
                hover: true,
                tooltipDelay: 200,
                hideEdgesOnDrag: false,
                dragNodes: true,
                dragView: true,
                zoomView: true
            },
            layout: {
                randomSeed: undefined,
                improvedLayout: true
            }
        };

        // Create network
        this.network = new vis.Network(this.graphCanvas, this.networkData, options);

        // Create banner for isolated assumptions
        this.createIsolatedAssumptionsOverlay();

        // Add click handler for edges and nodes
        this.network.on('click', (params) => {
            // Prioritize node clicks over edge clicks
            if (params.nodes.length > 0) {
                this.handleNodeClick(params.nodes[0], params.event);
            } else if (params.edges.length > 0) {
                this.handleEdgeClick(params.edges[0]);
            } else {
                // Clicked elsewhere, hide tooltip
                this.hideTooltip();
            }
        });

        // Add stabilization progress listener
        this.network.on('stabilizationProgress', (params) => {
            const progress = Math.round((params.iterations / params.total) * 100);
            // Could show progress bar here if desired
        });

        this.network.on('stabilizationIterationsDone', () => {
            // Disable physics after stabilization to prevent perpetual motion
            this.network.setOptions({ physics: { enabled: false } });
        });

        // Don't re-enable physics during drag - keep it disabled for performance
        // This prevents lag when clicking extensions after dragging nodes

        // Add reset layout button listener
        this.resetLayoutBtn.addEventListener('click', () => {
            // Reset colors and styles before running layout
            this.resetGraphColors();
            this.runGraphLayout();
        });

        // Add fullscreen button listener
        this.fullscreenBtn.addEventListener('click', () => {
            this.toggleFullscreen();
        });

        // Handle fullscreen change events
        document.addEventListener('fullscreenchange', () => {
            this.updateFullscreenButton();
            // Redraw network when entering/exiting fullscreen
            if (this.network) {
                setTimeout(() => this.network.fit(), 100);
            }
        });
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            this.graphContainer.requestFullscreen().catch(err => {
                console.error('Error attempting to enable fullscreen:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }

    updateFullscreenButton() {
        if (document.fullscreenElement) {
            this.fullscreenBtn.textContent = '✕ Exit Fullscreen';
        } else {
            this.fullscreenBtn.textContent = '⛶ Fullscreen';
        }
    }

    runGraphLayout(quickMode = false) {
        if (!this.network) return;

        // Enable physics for stabilization
        this.network.setOptions({ physics: { enabled: true } });

        // Randomize positions slightly
        const nodes = this.networkData.nodes.get();
        nodes.forEach(node => {
            this.network.moveNode(node.id,
                (Math.random() - 0.5) * 400,
                (Math.random() - 0.5) * 400
            );
        });

        // Restart stabilization (physics will be disabled after stabilization by event handler)
        this.network.stabilize(quickMode ? 300 : 1000);

        // Fit to view
        setTimeout(() => this.network.fit(), 100);
    }

    createIsolatedAssumptionsOverlay() {
        // Create banner element above graph canvas
        const banner = document.createElement('div');
        banner.id = 'isolated-assumptions-banner';
        banner.style.padding = '6px 12px';
        banner.style.background = 'rgba(156, 163, 175, 0.05)';
        banner.style.borderLeft = '2px solid rgba(156, 163, 175, 0.3)';
        banner.style.borderRadius = '3px';
        banner.style.fontSize = '0.85em';
        banner.style.color = 'var(--text-muted)';
        banner.style.marginBottom = '8px';
        banner.style.display = 'none'; // Hidden by default

        // Insert banner before graph canvas (after graph header)
        this.graphCanvas.parentElement.insertBefore(banner, this.graphCanvas);
        this.isolatedBanner = banner;
    }

    updateIsolatedAssumptionsOverlay() {
        if (!this.isolatedBanner) return;

        // Extract unique assumptions from isolated nodes, including empty set
        const isolatedItems = [];

        if (this.isolatedNodes && this.isolatedNodes.length > 0) {
            this.isolatedNodes.forEach(node => {
                if (node.id === '∅' || (node.assumptions && node.assumptions.length === 0)) {
                    // Empty set
                    if (!isolatedItems.includes('∅')) {
                        isolatedItems.push('∅');
                    }
                } else if (node.assumptions && node.assumptions.length > 0) {
                    node.assumptions.forEach(assumption => {
                        if (assumption && !isolatedItems.includes(assumption)) {
                            isolatedItems.push(assumption);
                        }
                    });
                }
            });
        }

        // Sort, but keep empty set first if present
        const hasEmptySet = isolatedItems.includes('∅');
        const sortedItems = isolatedItems.filter(item => item !== '∅').sort();
        if (hasEmptySet) {
            sortedItems.unshift('∅');
        }

        if (sortedItems.length === 0) {
            this.isolatedBanner.style.display = 'none';
        } else {
            this.isolatedBanner.style.display = 'block';
            this.isolatedBanner.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 0.85em;">ℹ️</span>
                    <span style="font-weight: 500;">Isolated (not in attack graph):</span>
                    <span style="font-family: monospace; color: var(--text-color);">${sortedItems.join(', ')}</span>
                </div>
            `;
        }
    }

    async updateGraph(frameworkCode) {
        if (!this.clingoReady) {
            return;
        }

        const graphMode = document.querySelector('input[name="graph-mode"]:checked')?.value || 'standard';

        if (graphMode === 'assumption-direct') {
            await this.updateGraphAssumptionLevelDirect(frameworkCode);
        } else if (graphMode === 'assumption-branching') {
            await this.updateGraphAssumptionLevelBranching(frameworkCode);
        } else {
            await this.updateGraphStandard(frameworkCode);
        }
    }

    async updateGraphStandard(frameworkCode) {
        if (!this.clingoReady) {
            return;
        }

        try {
            const semiring = this.semiringSelect.value;

            // Build set-based attack graph program
            const setProgram = `
${frameworkCode}
${this.getCoreModule()}
${this.getSemiringModule(semiring)}

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
                    const normalizedWidth = weight === Infinity ? 5 : (weight === -Infinity ? 1 : Math.min(5, 1 + (weight / 25)));
                    const colorIntensity = weight === Infinity ? 255 : (weight === -Infinity ? 100 : Math.min(255, Math.floor(weight * 2.55)));
                    const color = weight === Infinity ? '#ff6b6b' :
                                 (weight === -Infinity ? '#888' : `rgb(${colorIntensity}, ${100}, ${150})`);

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
                    // It's an edge - store original width and color for reset
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

                    // Neutral purple color for all nodes
                    const nodeColor = {
                        border: '#7c3aed',
                        background: '#8b5cf6',
                        highlight: {
                            border: '#6d28d9',
                            background: '#7c3aed'
                        }
                    };

                    const nodeData = {
                        id: el.data.id,
                        label: el.data.label,
                        size: 15 + (el.data.size * 3),
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
            if (window.hideGraphEmptyState) {
                window.hideGraphEmptyState();
            }

            // Store framework code and mode
            this.currentFrameworkCode = frameworkCode;
            this.currentGraphMode = 'standard';

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

    async updateGraphAssumptionLevelDirect(frameworkCode) {
        if (!this.clingoReady) {
            return;
        }

        try {
            // Parse framework to extract assumptions, contraries, rules, and weights
            const assumptions = this.parseAssumptions(frameworkCode);
            const contraries = this.parseContraries(frameworkCode);
            const rules = this.parseRules(frameworkCode);
            const weights = this.parseWeights(frameworkCode);

            // Build vis.js nodes (one per assumption)
            const visNodes = [];
            const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

            assumptions.forEach(assumption => {
                const weight = weights[assumption] || '?';
                const nodeColor = {
                    border: '#7c3aed',
                    background: '#8b5cf6',
                    highlight: {
                        border: '#6d28d9',
                        background: '#7c3aed'
                    }
                };

                visNodes.push({
                    id: assumption,
                    label: assumption,
                    size: 20,
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
                                        dashes: [5, 5],
                                        title: `${attacker} jointly attacks ${assumption}\nWith: ${otherAttackers}\nType: Joint Attack (${contrary})\nWeight: ${weight}`,
                                        attackType: 'joint',
                                        attackingElement: attacker,
                                        targetAssumption: assumption,
                                        contrary: contrary,
                                        jointWith: assumptionAttackers,
                                        originalWidth: 2,
                                        originalColor: edgeColor,
                                        originalDashes: [5, 5]
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
                    border: '#64748b',
                    background: '#94a3b8',
                    highlight: {
                        border: '#475569',
                        background: '#64748b'
                    }
                };
                visNodes.push({
                    id: '⊤',
                    label: '⊤',
                    size: 15,
                    shape: 'box',
                    color: topNodeColor,
                    title: 'Top element (⊤): represents fact-based attacks',
                    font: {
                        color: isDark ? '#f1f5f9' : '#1e293b',
                        size: 16
                    },
                    isTop: true
                });

                // Create edges from ⊤ to attacked assumptions
                factBasedAttacks.forEach(({ assumption, contrary, weight }) => {
                    const displayWeight = weight === '?' ? '' : weight;
                    const edgeColor = { color: '#94a3b8', highlight: '#64748b' };
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
            if (window.hideGraphEmptyState) {
                window.hideGraphEmptyState();
            }

            // Store framework code and mode
            this.currentFrameworkCode = frameworkCode;
            this.currentGraphMode = 'assumption-direct';

            // Store isolated assumptions for display
            this.isolatedNodes = isolatedAssumptions.map(a => ({ id: a, assumptions: [a] }));
            this.updateIsolatedAssumptionsOverlay();

            // Run layout and fit to view
            this.runGraphLayout(true);

            setTimeout(() => {
                this.network.fit({
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
        if (!this.clingoReady) {
            return;
        }

        try {
            // Parse framework to extract assumptions, contraries, rules, and weights
            const assumptions = this.parseAssumptions(frameworkCode);
            const contraries = this.parseContraries(frameworkCode);
            const rules = this.parseRules(frameworkCode);
            const weights = this.parseWeights(frameworkCode);

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
                    border: '#7c3aed',
                    background: '#8b5cf6',
                    highlight: {
                        border: '#6d28d9',
                        background: '#7c3aed'
                    }
                };

                visNodes.push({
                    id: assumption,
                    label: assumption,
                    size: 20,
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
                                    label: '⊗', // Multiplication symbol to indicate "joint"
                                    size: 12,
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
                                        size: 14
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
                                        dashes: [5, 5],
                                        title: `${attacker} contributes to joint attack`,
                                        attackingElement: attacker,
                                        targetAssumption: assumption,
                                        contrary: contrary,
                                        originalWidth: 2,
                                        originalColor: edgeColor,
                                        originalDashes: [5, 5]
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
                    border: '#64748b',
                    background: '#94a3b8',
                    highlight: {
                        border: '#475569',
                        background: '#64748b'
                    }
                };
                visNodes.push({
                    id: '⊤',
                    label: '⊤',
                    size: 15,
                    shape: 'box',
                    color: topNodeColor,
                    title: 'Top element (⊤): represents fact-based attacks',
                    font: {
                        color: isDark ? '#f1f5f9' : '#1e293b',
                        size: 16
                    },
                    isTop: true
                });

                // Create edges from ⊤ to attacked assumptions
                factBasedAttacks.forEach(({ assumption, contrary, weight }) => {
                    const displayWeight = weight === '?' ? '' : weight;
                    const edgeColor = { color: '#94a3b8', highlight: '#64748b' };
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
            if (window.hideGraphEmptyState) {
                window.hideGraphEmptyState();
            }

            // Store framework code and mode
            this.currentFrameworkCode = frameworkCode;
            this.currentGraphMode = 'assumption-branching';

            // Store isolated assumptions for display
            this.isolatedNodes = isolatedAssumptions.map(a => ({ id: a, assumptions: [a] }));
            this.updateIsolatedAssumptionsOverlay();

            // Run layout and fit to view
            this.runGraphLayout(true);

            setTimeout(() => {
                this.network.fit({
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

    parseAssumptions(code) {
        const assumptions = [];
        const regex = /assumption\(([^)]+)\)\./g;
        let match;
        while ((match = regex.exec(code)) !== null) {
            assumptions.push(match[1].trim());
        }
        return assumptions;
    }

    parseContraries(code) {
        const contraries = [];
        const regex = /contrary\(([^,]+),\s*([^)]+)\)\./g;
        let match;
        while ((match = regex.exec(code)) !== null) {
            contraries.push({
                assumption: match[1].trim(),
                contrary: match[2].trim()
            });
        }
        return contraries;
    }

    parseRules(code) {
        const rules = [];
        const ruleMap = new Map(); // rule_id -> {head: ..., body: [...]}

        // Expand compact semicolon form first
        // body(r1, b; r1, c). -> body(r1, b). body(r1, c).
        let expandedCode = code.replace(/body\(([^)]+)\)\./g, (match, content) => {
            const parts = content.split(';').map(p => p.trim());
            return parts.map(p => `body(${p}).`).join(' ');
        });

        expandedCode = expandedCode.replace(/head\(([^)]+)\)\./g, (match, content) => {
            const parts = content.split(';').map(p => p.trim());
            return parts.map(p => `head(${p}).`).join(' ');
        });

        console.log('Expanded code sample:', expandedCode.substring(0, 500));

        // Parse head/2 predicates: head(rule_id, head_atom).
        const headRegex = /head\(([^,]+),\s*([^)]+)\)\./g;
        let match;
        while ((match = headRegex.exec(expandedCode)) !== null) {
            const ruleId = match[1].trim();
            const headAtom = match[2].trim();
            if (!ruleMap.has(ruleId)) {
                ruleMap.set(ruleId, { head: headAtom, body: [] });
            } else {
                ruleMap.get(ruleId).head = headAtom;
            }
        }

        // Parse body/2 predicates: body(rule_id, body_atom).
        const bodyRegex = /body\(([^,]+),\s*([^)]+)\)\./g;
        while ((match = bodyRegex.exec(expandedCode)) !== null) {
            const ruleId = match[1].trim();
            const bodyAtom = match[2].trim();
            if (!ruleMap.has(ruleId)) {
                ruleMap.set(ruleId, { head: null, body: [bodyAtom] });
            } else {
                ruleMap.get(ruleId).body.push(bodyAtom);
            }
        }

        // Convert map to array
        ruleMap.forEach((rule, ruleId) => {
            if (rule.head) {
                rules.push({
                    id: ruleId,
                    head: rule.head,
                    body: rule.body
                });
            }
        });

        return rules;
    }

    parseWeights(code) {
        const weights = {};
        const regex = /weight\(([^,]+),\s*([^)]+)\)\./g;
        let match;
        while ((match = regex.exec(code)) !== null) {
            const atom = match[1].trim();
            const weight = match[2].trim();
            weights[atom] = weight;
        }
        return weights;
    }

    handleEdgeClick(edgeId) {
        // Get edge data from vis.js
        const edge = this.networkData.edges.get(edgeId);
        if (!edge) return;

        // Create tooltip content based on current graph mode
        let tooltipContent;
        if (this.currentGraphMode && this.currentGraphMode.startsWith('assumption')) {
            tooltipContent = this.createAssumptionLevelAttackTooltip(edge, this.currentFrameworkCode);
        } else {
            tooltipContent = this.createAttackDerivationTooltip(edge, this.currentFrameworkCode);
        }

        // Show tooltip at a fixed position (center of screen)
        this.showTooltip(tooltipContent, { x: window.innerWidth / 2, y: window.innerHeight / 2 });
    }

    handleNodeClick(nodeId, event) {
        // Get node data from vis.js
        const node = this.networkData.nodes.get(nodeId);
        if (!node) return;

        // Create popup with node information
        this.showNodePopup(nodeId, node, event.center);
    }

    showNodePopup(nodeId, nodeData, position) {
        // Remove any existing popups
        const existing = document.getElementById('node-popup');
        if (existing) {
            existing.remove();
        }
        this.hideTooltip();  // Also hide edge tooltip if open

        // Create popup
        const popup = document.createElement('div');
        popup.id = 'node-popup';
        popup.style.cssText = `
            position: fixed;
            left: -9999px;
            top: -9999px;
            background: var(--bg-secondary);
            border: 2px solid #10b981;
            border-radius: 8px;
            padding: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 10001;
            min-width: 250px;
            max-width: 400px;
            font-size: 0.9em;
        `;

        let content = '';

        // Check if this is a junction node (branching mode)
        if (nodeData.isJunction) {
            content += `<div style="margin-bottom: 8px;">`;
            content += `<strong style="color: var(--primary-color);">Junction Node</strong>`;
            content += `</div>`;

            content += `<div style="margin-bottom: 8px; padding: 8px; background: rgba(16, 185, 129, 0.05); border-left: 2px solid #10b981; border-radius: 4px;">`;
            content += `<span class="badge" style="background: #10b981; color: white; padding: 2px 6px; border-radius: 10px; font-size: 0.7em; margin-right: 4px;">Joint Attack</span>`;
            content += `<div style="margin-top: 6px; font-size: 0.9em;">`;
            content += `<strong>Attackers:</strong> ${nodeData.attackers.join(', ')}<br>`;
            content += `<strong>Target:</strong> ${nodeData.target}<br>`;
            content += `<strong>via:</strong> <code>${nodeData.contrary}</code>`;
            content += `</div>`;
            content += `</div>`;
        } else {
            // Standard node or assumption node (in all modes)
            content += `<div style="margin-bottom: 8px;">`;
            if (nodeData.isAssumption || (this.currentGraphMode && this.currentGraphMode.startsWith('assumption'))) {
                content += `<strong style="color: var(--primary-color);">Assumption: <code>${nodeId}</code></strong>`;
            } else {
                content += `<strong style="color: var(--primary-color);">Node: <code>${nodeId}</code></strong>`;
            }
            content += `</div>`;

            // Get weight from framework code
            const weight = this.getElementWeight(nodeId, this.currentFrameworkCode);
            if (weight && weight !== '?') {
                content += `<div style="margin-bottom: 8px; padding: 8px; background: rgba(245, 158, 11, 0.05); border-left: 2px solid #f59e0b; border-radius: 4px;">`;
                content += `<span class="badge" style="background: #f59e0b; color: white; padding: 2px 6px; border-radius: 10px; font-size: 0.7em; margin-right: 4px;">Weight</span>`;
                content += `<strong style="color: #f59e0b;">${weight}</strong>`;
                content += `</div>`;
            }

            // Find contrary
            const contrary = this.getContrary(nodeId, this.currentFrameworkCode);
            if (contrary) {
                content += `<div style="margin-bottom: 8px; padding: 8px; background: rgba(239, 68, 68, 0.05); border-left: 2px solid #ef4444; border-radius: 4px;">`;
                content += `<span class="badge" style="background: #ef4444; color: white; padding: 2px 6px; border-radius: 10px; font-size: 0.7em; margin-right: 4px;">Contrary</span>`;
                content += `<code style="font-size: 0.85em;">${contrary}</code>`;
                content += `</div>`;
            }

            // Count incoming and outgoing attacks
            const incomingAttacks = this.networkData.edges.get({
                filter: edge => edge.to === nodeId
            });
            const outgoingAttacks = this.networkData.edges.get({
                filter: edge => edge.from === nodeId
            });

            if (incomingAttacks.length > 0 || outgoingAttacks.length > 0) {
                content += `<div style="margin-bottom: 8px; padding: 8px; background: rgba(99, 102, 241, 0.05); border-left: 2px solid #6366f1; border-radius: 4px;">`;
                content += `<div style="font-size: 0.85em; margin-bottom: 4px;">`;
                content += `<span class="badge" style="background: #6366f1; color: white; padding: 2px 6px; border-radius: 10px; font-size: 0.7em; margin-right: 4px;">Attacks</span>`;
                content += `</div>`;
                content += `<div style="font-size: 0.85em; color: var(--text-muted);">`;
                content += `Incoming: <strong>${incomingAttacks.length}</strong> | `;
                content += `Outgoing: <strong>${outgoingAttacks.length}</strong>`;
                content += `</div>`;
                content += `</div>`;
            }
        }

        content += `<button onclick="document.getElementById('node-popup').remove()" style="background: #10b981; color: white; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 0.85em;">Close</button>`;

        popup.innerHTML = content;
        document.body.appendChild(popup);

        // Position popup
        const popupRect = popup.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const margin = 10;

        let left = position.x + 10;
        let top = position.y + 10;

        if (left + popupRect.width + margin > viewportWidth) {
            left = position.x - popupRect.width - 10;
        }

        if (top + popupRect.height + margin > viewportHeight) {
            top = position.y - popupRect.height - 10;
        }

        popup.style.left = `${left}px`;
        popup.style.top = `${top}px`;

        // Close popup when clicking outside
        setTimeout(() => {
            const closeOnClickOutside = (e) => {
                if (!popup.contains(e.target)) {
                    popup.remove();
                    document.removeEventListener('click', closeOnClickOutside);
                }
            };
            document.addEventListener('click', closeOnClickOutside);
        }, 100);
    }

    getContrary(assumption, frameworkCode) {
        const contraryMatch = frameworkCode.match(new RegExp(`contrary\\(${assumption}\\s*,\\s*([^)]+)\\)`, 'm'));
        return contraryMatch ? contraryMatch[1].trim() : null;
    }

    createAssumptionLevelAttackTooltip(edgeData, frameworkCode) {
        const { attackType, attackingElement, targetAssumption, contrary, label, jointWith } = edgeData;

        let content = `<div class="attack-tooltip">`;
        content += `<div class="tooltip-header">`;
        content += `<h4>Attack Information</h4>`;
        content += `<button class="tooltip-close" onclick="window.playground.hideTooltip()">×</button>`;
        content += `</div>`;
        content += `<div class="tooltip-body">`;

        // Attack type badge
        let typeBadgeColor = '#6366f1';
        let typeLabel = 'Attack';
        if (attackType === 'direct') {
            typeBadgeColor = '#ef4444';
            typeLabel = 'Direct Attack';
        } else if (attackType === 'derived') {
            typeBadgeColor = '#f59e0b';
            typeLabel = 'Derived Attack';
        } else if (attackType === 'joint') {
            typeBadgeColor = '#10b981';
            typeLabel = 'Joint Attack';
        }

        content += `<div style="margin-bottom: 15px; padding: 10px; background: rgba(99, 102, 241, 0.1); border-left: 3px solid ${typeBadgeColor}; border-radius: 4px;">`;

        // Type
        content += `<div style="margin-bottom: 8px;">`;
        content += `<span class="badge" style="background: ${typeBadgeColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.85em; margin-right: 6px;">Type</span>`;
        content += `<strong>${typeLabel}</strong>`;
        content += `</div>`;

        // Attacker(s)
        if (attackType === 'joint' && jointWith && jointWith.length > 0) {
            content += `<div style="margin-bottom: 8px;">`;
            content += `<span class="badge" style="background: #6366f1; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.85em; margin-right: 6px;">Attackers</span>`;
            content += jointWith.map(a => `<code style="background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 3px; margin-right: 4px;">${a}</code>`).join('');
            content += `</div>`;
        } else if (attackingElement) {
            content += `<div style="margin-bottom: 8px;">`;
            content += `<span class="badge" style="background: #6366f1; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.85em; margin-right: 6px;">Source</span>`;
            content += `<code style="background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 3px;">${attackingElement}</code>`;
            content += `</div>`;
        }

        // Target
        if (targetAssumption) {
            content += `<div style="margin-bottom: 8px;">`;
            content += `<span class="badge" style="background: #ef4444; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.85em; margin-right: 6px;">Target</span>`;
            content += `<code style="background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 3px;">${targetAssumption}</code>`;
            content += `</div>`;
        }

        // Via (contrary)
        if (contrary) {
            content += `<div style="margin-bottom: 8px;">`;
            content += `<span class="badge" style="background: #8b5cf6; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.85em; margin-right: 6px;">Via</span>`;
            content += `<code style="background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 3px;">${contrary}</code>`;
            content += `</div>`;
        }

        // Weight
        if (label) {
            content += `<div>`;
            content += `<span class="badge" style="background: #f59e0b; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.85em; margin-right: 6px;">Weight</span>`;
            content += `<strong style="font-size: 1.1em; color: #f59e0b;">${label}</strong>`;
            content += `</div>`;
        }

        content += `</div>`;

        // Additional info based on attack type
        if (attackType === 'direct') {
            content += `<div style="margin-top: 15px; padding: 10px; background: rgba(239, 68, 68, 0.1); border-radius: 4px;">`;
            content += `<strong>Direct attack:</strong> ${attackingElement || 'source'} directly attacks ${targetAssumption || 'target'} (both are assumptions)`;
            content += `</div>`;
        } else if (attackType === 'derived' && contrary) {
            content += `<div style="margin-top: 15px; padding: 10px; background: rgba(245, 158, 11, 0.1); border-radius: 4px;">`;
            content += `<strong>Derived attack:</strong> ${attackingElement || 'source'} supports <code>${contrary}</code>, which attacks ${targetAssumption || 'target'}`;
            content += `</div>`;
        } else if (attackType === 'joint' && jointWith) {
            content += `<div style="margin-top: 15px; padding: 10px; background: rgba(16, 185, 129, 0.1); border-radius: 4px;">`;
            content += `<strong>Joint attack:</strong> Multiple assumptions (${jointWith.join(', ')}) work together to support <code>${contrary}</code>, which attacks ${targetAssumption || 'target'}`;
            content += `</div>`;
        }

        content += `</div></div>`;
        return content;
    }

    createAttackDerivationTooltip(edgeData, frameworkCode) {
        const { attackedAssumption, attackingElement, derivedBy, sourceSet, targetSet, label } = edgeData;

        let content = `<div class="attack-tooltip">`;
        content += `<div class="tooltip-header">`;
        content += `<h4>Attack Information</h4>`;
        content += `<button class="tooltip-close" onclick="window.playground.hideTooltip()">×</button>`;
        content += `</div>`;
        content += `<div class="tooltip-body">`;

        // Attack summary with badges
        content += `<div style="margin-bottom: 15px; padding: 10px; background: rgba(99, 102, 241, 0.1); border-left: 3px solid #6366f1; border-radius: 4px;">`;
        content += `<div style="margin-bottom: 8px;">`;
        content += `<span class="badge" style="background: #6366f1; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.85em; margin-right: 6px;">Source</span>`;
        content += `<code style="background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 3px;">{${sourceSet}}</code>`;
        content += `</div>`;
        content += `<div style="margin-bottom: 8px;">`;
        content += `<span class="badge" style="background: #ef4444; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.85em; margin-right: 6px;">Attacks</span>`;
        content += `<code style="background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 3px;">${attackedAssumption}</code>`;
        content += ` <span style="color: var(--text-muted); font-size: 0.9em;">in</span> `;
        content += `<code style="background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 3px;">{${targetSet}}</code>`;
        content += `</div>`;
        content += `<div style="margin-bottom: 8px;">`;
        content += `<span class="badge" style="background: #8b5cf6; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.85em; margin-right: 6px;">Via</span>`;
        content += `<code style="background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 3px;">${attackingElement}</code>`;
        content += `</div>`;
        content += `<div>`;
        content += `<span class="badge" style="background: #f59e0b; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.85em; margin-right: 6px;">Weight</span>`;
        content += `<strong style="font-size: 1.1em; color: #f59e0b;">${label}</strong>`;
        content += `</div>`;
        content += `</div>`;

        if (derivedBy && derivedBy.length > 0) {
            content += `<div style="margin-top: 15px;">`;
            content += `<h5 style="margin-bottom: 10px; color: var(--primary-color);">Derivation Chain:</h5>`;
            derivedBy.forEach(ruleId => {
                const chainHtml = this.getRuleInfoWithChainHTML(ruleId, frameworkCode);
                content += chainHtml;
            });
            content += `</div>`;
        } else {
            content += `<div style="margin-top: 15px; padding: 10px; background: rgba(156, 163, 175, 0.1); border-radius: 4px; font-style: italic; color: var(--text-muted);">`;
            content += `${attackingElement} has a direct weight (not derived by rules)`;
            content += `</div>`;
        }

        content += `</div></div>`;
        return content;
    }

    getRuleInfo(ruleId, frameworkCode) {
        // Parse the framework to find the rule definition from predicates
        console.log(`[getRuleInfo] Looking for ${ruleId} in framework code (${frameworkCode.split('\n').length} lines)`);

        const ruleData = this.parseRule(ruleId, frameworkCode);

        console.log(`[getRuleInfo] ${ruleId}: head=${ruleData.head}, body=[${ruleData.body.join(', ')}]`);

        if (ruleData.head) {
            return ruleData.body.length > 0
                ? `${ruleId}: ${ruleData.head} ← ${ruleData.body.join(', ')}`
                : `${ruleId}: ${ruleData.head} ← (fact)`;
        }
        return ruleId;
    }

    parseRule(ruleId, frameworkCode) {
        // Parse the framework to extract head and body for a given rule
        const lines = frameworkCode.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%'));

        let head = null;
        const bodySet = new Set();

        lines.forEach(line => {
            // Split by `. ` to handle multiple predicates on same line
            const predicates = line.split(/\.\s+/);

            predicates.forEach(pred => {
                pred = pred.trim();
                if (!pred.endsWith('.')) pred += '.';

                // Match head(ruleId, element)
                let match = pred.match(/^head\(([^)]+)\)\.?$/);
                if (match) {
                    const headParts = match[1].split(';').map(p => p.trim());
                    headParts.forEach(part => {
                        const partMatch = part.match(/^([^,]+),\s*(.+)$/);
                        if (partMatch && partMatch[1].trim() === ruleId && !head) {
                            head = partMatch[2].trim();
                        }
                    });
                }

                // Match body(ruleId, atom)
                match = pred.match(/^body\(([^)]+)\)\.?$/);
                if (match) {
                    const bodyParts = match[1].split(';').map(p => p.trim());
                    bodyParts.forEach(part => {
                        const partMatch = part.match(/^([^,]+),\s*(.+)$/);
                        if (partMatch && partMatch[1].trim() === ruleId) {
                            bodySet.add(partMatch[2].trim());
                        }
                    });
                }
            });
        });

        return {
            head: head,
            body: Array.from(bodySet)
        };
    }

    findRulesForElement(element, frameworkCode) {
        // Find all rules that derive this element
        const lines = frameworkCode.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%'));
        const rules = [];

        lines.forEach(line => {
            const predicates = line.split(/\.\s+/);
            predicates.forEach(pred => {
                pred = pred.trim();
                if (!pred.endsWith('.')) pred += '.';

                const match = pred.match(/^head\(([^)]+)\)\.?$/);
                if (match) {
                    const headParts = match[1].split(';').map(p => p.trim());
                    headParts.forEach(part => {
                        const partMatch = part.match(/^([^,]+),\s*(.+)$/);
                        if (partMatch && partMatch[2].trim() === element) {
                            rules.push(partMatch[1].trim());
                        }
                    });
                }
            });
        });

        return rules;
    }

    getRuleInfoWithChain(ruleId, frameworkCode, indent = 0, visited = new Set()) {
        // Prevent infinite loops
        if (visited.has(ruleId)) {
            return ' '.repeat(indent) + `${ruleId}: (circular reference)`;
        }
        visited.add(ruleId);

        const ruleData = this.parseRule(ruleId, frameworkCode);
        if (!ruleData.head) {
            return ' '.repeat(indent) + ruleId;
        }

        let result = ' '.repeat(indent);
        result += ruleData.body.length > 0
            ? `${ruleId}: ${ruleData.head} ← ${ruleData.body.join(', ')}`
            : `${ruleId}: ${ruleData.head} ← (fact)`;

        // Recursively show derivations for each body atom
        ruleData.body.forEach(atom => {
            const derivingRules = this.findRulesForElement(atom, frameworkCode);
            if (derivingRules.length > 0) {
                result += `\n` + ' '.repeat(indent + 2) + `↳ ${atom} derived by:`;
                derivingRules.forEach(derivingRule => {
                    result += `\n` + this.getRuleInfoWithChain(derivingRule, frameworkCode, indent + 4, new Set(visited));
                });
            }
        });

        return result;
    }

    getRuleInfoWithChainHTML(ruleId, frameworkCode, level = 0, visited = new Set()) {
        // Build linear chain display
        const chain = this.buildDerivationChain(ruleId, frameworkCode);
        const semiring = this.semiringSelect.value;

        let html = `<div style="margin-bottom: 15px; padding: 12px; background: rgba(139, 92, 246, 0.05); border-left: 3px solid #8b5cf6; border-radius: 4px;">`;

        // Display chain as a one-liner with clickable arrows
        html += `<div style="font-size: 0.95em; line-height: 1.8; position: relative;">`;
        html += `<span class="badge" style="background: #8b5cf6; color: white; padding: 2px 6px; border-radius: 10px; font-size: 0.75em; margin-right: 6px;">Chain</span>`;

        chain.forEach((step, idx) => {
            if (idx === 0) {
                // First element (the attacking element)
                const headWeight = this.calculateElementWeight(step.head, frameworkCode, semiring);
                html += `<code style="font-weight: bold; color: var(--primary-color);" title="Weight: ${headWeight}">${step.head}</code>`;
            }

            if (step.body.length > 0) {
                // Calculate weight info for popup
                const bodyWeights = step.body.map(atom => ({
                    atom: atom,
                    weight: this.calculateElementWeight(atom, frameworkCode, semiring)
                }));
                const headWeight = this.calculateElementWeight(step.head, frameworkCode, semiring);
                const operation = this.getSemiringOperation(semiring);

                // Create unique ID for this arrow
                const arrowId = `arrow-${ruleId}-${idx}`;

                // Arrow with click handler
                html += ` <span id="${arrowId}" style="color: #8b5cf6; cursor: pointer; padding: 2px 6px; border-radius: 3px; transition: background 0.2s; display: inline-block;"
                         onmouseover="this.style.background='rgba(139, 92, 246, 0.15)'"
                         onmouseout="this.style.background='transparent'"
                         onclick="event.stopPropagation(); window.playground.showWeightPopup('${arrowId}', '${step.ruleId}', '${step.head}', '${operation}', ${JSON.stringify(bodyWeights).replace(/"/g, '&quot;')}, '${headWeight}')">←</span> `;

                // Body atoms
                const bodyStr = step.body.map(atom => {
                    const weight = this.calculateElementWeight(atom, frameworkCode, semiring);
                    return `<code title="Weight: ${weight}">${atom}</code>`;
                }).join(', ');
                html += bodyStr;
            }
        });

        html += `</div>`;
        html += `</div>`;
        return html;
    }

    showWeightPopup(arrowId, ruleId, head, operation, bodyWeights, headWeight) {
        // Remove any existing weight popup
        const existing = document.getElementById('weight-popup');
        if (existing) {
            existing.remove();
        }

        // Get arrow element position
        const arrowEl = document.getElementById(arrowId);
        if (!arrowEl) return;

        const rect = arrowEl.getBoundingClientRect();

        // Create popup
        const popup = document.createElement('div');
        popup.id = 'weight-popup';
        // Initially position off-screen to measure dimensions
        popup.style.cssText = `
            position: fixed;
            left: -9999px;
            top: -9999px;
            background: var(--bg-secondary);
            border: 2px solid #8b5cf6;
            border-radius: 8px;
            padding: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 10001;
            min-width: 250px;
            max-width: 400px;
            font-size: 0.9em;
            max-height: 80vh;
            overflow-y: auto;
        `;

        // Build popup content - show all derivations
        let content = `<div style="margin-bottom: 8px;">`;
        content += `<strong style="color: var(--primary-color);">Weight Derivation for <code>${head}</code></strong>`;
        content += `</div>`;

        // Get all rules that derive this element
        const derivingRules = this.findRulesForElement(head, this.currentFrameworkCode);
        const semiring = this.semiringSelect.value;
        const disjunctionOp = this.getDisjunctionOperation(semiring);
        const derivationWeights = [];

        // Check for direct weight first
        const directWeight = this.getElementWeight(head, this.currentFrameworkCode);
        if (directWeight !== '?') {
            content += `<div style="margin-bottom: 8px; padding: 8px; background: rgba(34, 197, 94, 0.05); border-left: 2px solid #22c55e; border-radius: 4px;">`;
            content += `<div style="margin-bottom: 4px;">`;
            content += `<span class="badge" style="background: #22c55e; color: white; padding: 2px 6px; border-radius: 10px; font-size: 0.7em; margin-right: 4px;">direct</span>`;
            content += `<code style="font-size: 0.85em;">${head}</code> (explicit weight)`;
            content += `</div>`;
            content += `<div style="font-size: 0.85em; color: var(--text-muted); margin-left: 4px;">`;
            content += `Weight: <strong style="color: #10b981;">${directWeight}</strong>`;
            content += `</div>`;
            content += `</div>`;
            derivationWeights.push({ source: 'direct', weight: directWeight });
        }

        // Show each rule-based derivation
        if (derivingRules.length > 0) {
            derivingRules.forEach((derivingRuleId, idx) => {
                const ruleData = this.parseRule(derivingRuleId, this.currentFrameworkCode);

                content += `<div style="margin-bottom: 8px; padding: 8px; background: rgba(139, 92, 246, 0.05); border-left: 2px solid #8b5cf6; border-radius: 4px;">`;
                content += `<div style="margin-bottom: 4px;">`;
                content += `<span class="badge" style="background: #8b5cf6; color: white; padding: 2px 6px; border-radius: 10px; font-size: 0.7em; margin-right: 4px;">${derivingRuleId}</span>`;

                if (ruleData.body.length > 0) {
                    // Calculate this derivation's weight
                    const derivBodyWeights = ruleData.body.map(atom => ({
                        atom: atom,
                        weight: this.calculateElementWeight(atom, this.currentFrameworkCode, semiring)
                    }));

                    const conjunctionOp = this.getSemiringOperation(semiring);
                    const derivWeight = this.applySemiringOperation(semiring, derivBodyWeights.map(bw => bw.weight));
                    derivationWeights.push({ source: derivingRuleId, weight: derivWeight });

                    content += `<code style="font-size: 0.85em;">${head}</code> ← <code style="font-size: 0.85em;">${ruleData.body.join(', ')}</code>`;
                    content += `</div>`;
                    content += `<div style="font-size: 0.85em; color: var(--text-muted); margin-left: 4px;">`;
                    content += `${conjunctionOp}(`;
                    content += derivBodyWeights.map(bw => `<code>${bw.atom}</code>: <strong style="color: #f59e0b;">${bw.weight}</strong>`).join(', ');
                    content += `) = <strong style="color: #10b981;">${derivWeight}</strong>`;
                    content += `</div>`;
                } else {
                    // Fact rule (no body)
                    content += `<code style="font-size: 0.85em;">${head}</code> (fact rule)`;
                    content += `</div>`;
                }
                content += `</div>`;
            });
        }

        // Show final aggregation if multiple sources
        if (derivationWeights.length > 1) {
            const finalWeight = this.applySemiringDisjunction(semiring, derivationWeights.map(dw => dw.weight));
            content += `<div style="margin-top: 8px; padding: 8px; background: rgba(245, 158, 11, 0.15); border-radius: 4px; border: 1px solid rgba(245, 158, 11, 0.3);">`;
            content += `<div style="font-weight: 600; margin-bottom: 4px; color: var(--primary-color);">Final Weight (Disjunction):</div>`;
            content += `<code style="font-weight: 600;">${head}</code> = `;
            content += `<span style="color: var(--text-muted);">${disjunctionOp}(</span>`;
            content += derivationWeights.map(dw => `<strong style="color: #f59e0b;" title="${dw.source}">${dw.weight}</strong>`).join(', ');
            content += `<span style="color: var(--text-muted);">)</span>`;
            content += ` = <strong style="color: #10b981; font-size: 1.15em;">${finalWeight}</strong>`;
            content += `</div>`;
        } else if (derivationWeights.length === 0) {
            // No weight information at all
            content += `<div style="padding: 8px; background: rgba(239, 68, 68, 0.1); border-radius: 4px; color: var(--text-muted);">`;
            content += `No weight information found for <code>${head}</code>`;
            content += `</div>`;
        }

        content += `<div style="margin-top: 10px; text-align: right;">`;
        content += `<button onclick="document.getElementById('weight-popup').remove()" style="background: #6366f1; color: white; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 0.85em;">Close</button>`;
        content += `</div>`;

        popup.innerHTML = content;
        document.body.appendChild(popup);

        // Now calculate optimal position within viewport
        const popupRect = popup.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const scrollbarWidth = 20; // Account for potential scrollbar
        const margin = 10; // Minimum margin from viewport edges

        // Calculate initial position (below arrow, aligned to left edge)
        let left = rect.left;
        let top = rect.bottom + 5;

        // Adjust horizontal position if popup would go off right edge
        if (left + popupRect.width + margin > viewportWidth - scrollbarWidth) {
            // Align to right edge of arrow instead
            left = rect.right - popupRect.width;

            // If still off-screen on left, align to viewport edge
            if (left < margin) {
                left = margin;
            }
        }

        // Adjust vertical position if popup would go off bottom edge
        if (top + popupRect.height + margin > viewportHeight) {
            // Try placing above arrow instead
            const topPlacement = rect.top - popupRect.height - 5;

            if (topPlacement >= margin) {
                // Enough room above
                top = topPlacement;
            } else {
                // Not enough room above or below - align to bottom with scroll
                top = viewportHeight - popupRect.height - margin;

                // If still not enough room, align to top
                if (top < margin) {
                    top = margin;
                }
            }
        }

        // Apply final position
        popup.style.left = `${left}px`;
        popup.style.top = `${top}px`;

        // Close popup when clicking outside
        setTimeout(() => {
            const closeOnClickOutside = (e) => {
                if (!popup.contains(e.target) && e.target.id !== arrowId) {
                    popup.remove();
                    document.removeEventListener('click', closeOnClickOutside);
                }
            };
            document.addEventListener('click', closeOnClickOutside);
        }, 100);
    }

    showDerivationChain(atom, parsed, triggerElement) {
        // Remove any existing derivation popup
        const existing = document.getElementById('derivation-popup');
        if (existing) {
            existing.remove();
        }

        // Get element position
        const rect = triggerElement.getBoundingClientRect();

        // Create popup using unified CSS classes
        const popup = document.createElement('div');
        popup.id = 'derivation-popup';
        popup.style.cssText = `
            position: fixed;
            left: -9999px;
            top: -9999px;
            z-index: 10001;
        `;

        // Build derivation tree recursively
        const buildTree = (currentAtom, depth = 0, visited = new Set()) => {
            if (visited.has(currentAtom) || depth > 10) return '';
            visited.add(currentAtom);

            const weight = parsed.weights.get(currentAtom);
            const weightDisplay = weight !== undefined ? ` <span class="derivation-weight">(w: ${weight})</span>` : '';

            let html = `<div class="derivation-item" style="margin-left: ${depth * 16}px;">`;

            if (depth > 0) {
                html += `<span class="derivation-connector">└─</span> `;
            }

            // Find rules that derive this atom
            const derivingRules = [];
            parsed.rules.forEach((rule, ruleId) => {
                if (rule.head === currentAtom) {
                    derivingRules.push({ ruleId, rule });
                }
            });

            if (parsed.assumptions.has(currentAtom)) {
                // It's an assumption
                html += `<code class="derivation-atom">${currentAtom}</code>${weightDisplay} `;
                html += `<span class="badge badge-assumption">assumption</span>`;
            } else if (derivingRules.length > 0) {
                // It's derived by rules
                html += `<code class="derivation-atom">${currentAtom}</code>${weightDisplay}`;
                html += '</div>';

                // Show each deriving rule
                derivingRules.forEach(({ ruleId, rule }) => {
                    html += `<div class="derivation-item" style="margin-left: ${(depth + 1) * 16}px;">`;
                    html += `<span class="badge badge-rule">${ruleId}</span> `;
                    if (rule.body.length > 0) {
                        html += `← <code class="derivation-atom">${rule.body.join(', ')}</code>`;
                        html += '</div>';

                        // Recursively show body atoms
                        rule.body.forEach(bodyAtom => {
                            html += buildTree(bodyAtom, depth + 2, new Set(visited));
                        });
                    } else {
                        html += `<span class="badge badge-fact">fact</span>`;
                        html += '</div>';
                    }
                });
                return html;
            } else {
                // Unknown derivation
                html += `<code class="derivation-atom">${currentAtom}</code>${weightDisplay}`;
            }

            html += '</div>';
            return html;
        };

        // Build popup content with unified structure
        let content = `<div class="popup-header">`;
        content += `<h4>Derivation Chain for <code>${atom}</code></h4>`;
        content += `<button class="popup-close" onclick="document.getElementById('derivation-popup').remove()">×</button>`;
        content += `</div>`;
        content += `<div class="popup-body">`;
        content += `<div class="derivation-tree">`;
        content += buildTree(atom);
        content += `</div>`;
        content += `</div>`;

        popup.innerHTML = content;
        document.body.appendChild(popup);

        // Position popup
        const popupRect = popup.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const margin = 10;

        let left = rect.left;
        let top = rect.bottom + 5;

        if (left + popupRect.width + margin > viewportWidth) {
            left = rect.right - popupRect.width;
        }

        if (top + popupRect.height + margin > viewportHeight) {
            const topPlacement = rect.top - popupRect.height - 5;
            if (topPlacement >= margin) {
                top = topPlacement;
            } else {
                top = viewportHeight - popupRect.height - margin;
            }
        }

        popup.style.left = `${left}px`;
        popup.style.top = `${top}px`;

        // Close popup when clicking outside
        setTimeout(() => {
            const closeOnClickOutside = (e) => {
                if (!popup.contains(e.target) && !triggerElement.contains(e.target)) {
                    popup.remove();
                    document.removeEventListener('click', closeOnClickOutside);
                }
            };
            document.addEventListener('click', closeOnClickOutside);
        }, 100);
    }

    buildDerivationChain(ruleId, frameworkCode, visited = new Set()) {
        // Build a linear chain of derivations
        if (visited.has(ruleId)) {
            return [];
        }
        visited.add(ruleId);

        const ruleData = this.parseRule(ruleId, frameworkCode);
        if (!ruleData.head) {
            return [];
        }

        const chain = [{
            ruleId: ruleId,
            head: ruleData.head,
            body: ruleData.body
        }];

        // For each body atom, find if it's derived by rules and add to chain
        ruleData.body.forEach(atom => {
            const derivingRules = this.findRulesForElement(atom, frameworkCode);
            if (derivingRules.length > 0) {
                // Take the first deriving rule (could be multiple paths)
                const subChain = this.buildDerivationChain(derivingRules[0], frameworkCode, new Set(visited));
                chain.push(...subChain);
            }
        });

        return chain;
    }

    calculateElementWeight(element, frameworkCode, semiring) {
        // First check for direct weight
        const directWeight = this.getElementWeight(element, frameworkCode);
        if (directWeight !== '?') {
            return directWeight;
        }

        // If no direct weight, calculate from deriving rules
        const derivingRules = this.findRulesForElement(element, frameworkCode);
        if (derivingRules.length === 0) {
            return '?';
        }

        // Calculate weight from first deriving rule
        const ruleData = this.parseRule(derivingRules[0], frameworkCode);
        if (ruleData.body.length === 0) {
            return '?';
        }

        // Get weights of body atoms
        const bodyWeights = ruleData.body.map(atom =>
            this.calculateElementWeight(atom, frameworkCode, semiring)
        ).filter(w => w !== '?');

        if (bodyWeights.length === 0) {
            return '?';
        }

        // Apply semiring operation
        return this.applySemiringOperation(semiring, bodyWeights);
    }

    applySemiringOperation(semiring, weights) {
        // Convert weights to numbers, handling #sup and #inf
        const numWeights = weights.map(w => {
            if (w === '#sup' || w === 'Infinity') return Infinity;
            if (w === '#inf' || w === '-Infinity') return -Infinity;
            return parseFloat(w);
        });

        switch(semiring) {
            case 'godel':
                return Math.min(...numWeights).toString();
            case 'tropical':
            case 'arctic':
                const sum = numWeights.reduce((a, b) => a + b, 0);
                return sum === Infinity ? '#sup' : sum.toString();
            case 'lukasiewicz':
                // Bounded sum - simplified (would need K parameter)
                const boundedSum = numWeights.reduce((a, b) => Math.min(100, a + b), 0);
                return boundedSum.toString();
            case 'bottleneck_cost':
                return Math.max(...numWeights).toString();
            default:
                return numWeights[0].toString();
        }
    }

    getElementWeight(element, frameworkCode) {
        // Extract weight for an element from framework code
        const lines = frameworkCode.split('\n').map(l => l.trim());
        for (let line of lines) {
            const match = line.match(/^weight\(([^,]+),\s*([^)]+)\)\./);
            if (match && match[1].trim() === element) {
                return match[2].trim();
            }
        }
        return '?';
    }

    getSemiringOperation(semiring) {
        // Return the conjunction operation name for each semiring
        const operations = {
            'godel': 'min',
            'tropical': 'sum',
            'arctic': 'sum',
            'lukasiewicz': 'bounded-sum',
            'bottleneck_cost': 'max'
        };
        return operations[semiring] || 'combine';
    }

    getDisjunctionOperation(semiring) {
        // Return the disjunction operation name for each semiring
        const operations = {
            'godel': 'max',
            'tropical': 'min',
            'arctic': 'max',
            'lukasiewicz': 'bounded-sum',
            'bottleneck_cost': 'min'
        };
        return operations[semiring] || 'combine';
    }

    applySemiringDisjunction(semiring, weights) {
        // Convert weights to numbers, handling #sup and #inf
        const numWeights = weights.map(w => {
            if (w === '#sup' || w === 'Infinity') return Infinity;
            if (w === '#inf' || w === '-Infinity') return -Infinity;
            return parseFloat(w);
        });

        switch(semiring) {
            case 'godel':
            case 'arctic':
                return Math.max(...numWeights).toString();
            case 'tropical':
            case 'bottleneck_cost':
                const minVal = Math.min(...numWeights);
                return minVal === Infinity ? '#sup' : minVal.toString();
            case 'lukasiewicz':
                // Bounded sum for disjunction - simplified
                const boundedSum = numWeights.reduce((a, b) => Math.min(100, a + b), 0);
                return boundedSum.toString();
            default:
                return numWeights[0].toString();
        }
    }

    showTooltip(content, position) {
        // Remove existing tooltip
        this.hideTooltip();

        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.id = 'attack-tooltip-overlay';
        tooltip.innerHTML = content;

        // Position tooltip (center of screen for now - can be improved)
        tooltip.style.position = 'fixed';
        tooltip.style.top = '50%';
        tooltip.style.left = '50%';
        tooltip.style.transform = 'translate(-50%, -50%)';
        tooltip.style.zIndex = '10000';

        document.body.appendChild(tooltip);
    }

    hideTooltip() {
        const tooltip = document.getElementById('attack-tooltip-overlay');
        if (tooltip) {
            tooltip.remove();
        }
    }

    highlightExtension(inAssumptions, discardedAttacks, successfulAttacks = []) {
        // Batch update node colors based on in/out status
        const nodes = this.networkData.nodes.get();
        const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
        const nodeUpdates = [];

        if (this.currentGraphMode && this.currentGraphMode.startsWith('assumption')) {
            // Assumption-level mode: color individual assumptions
            nodes.forEach(node => {
                if (node.isJunction) {
                    // Junction nodes stay green
                    return;
                }

                const isIn = inAssumptions.includes(node.id);
                let color;

                if (isIn) {
                    // Green for assumptions in the extension
                    color = {
                        border: '#059669',
                        background: '#10b981',
                        highlight: { border: '#047857', background: '#059669' }
                    };
                } else {
                    // Gray for assumptions out of the extension
                    color = {
                        border: '#64748b',
                        background: '#94a3b8',
                        highlight: { border: '#475569', background: '#64748b' }
                    };
                }

                nodeUpdates.push({
                    id: node.id,
                    color: color
                });
            });
        } else {
            // Standard mode: color sets
            nodes.forEach(node => {
                const nodeAssumptions = node.id === '∅' ? [] : node.id.split(',');

                // Check if this set is "in" (all its assumptions are in the extension)
                const isIn = nodeAssumptions.length > 0 &&
                             nodeAssumptions.every(a => inAssumptions.includes(a));

                // Check if this set is "out" (at least one assumption is not in the extension)
                const isOut = nodeAssumptions.length > 0 &&
                              nodeAssumptions.some(a => !inAssumptions.includes(a));

                let color;
                if (isIn) {
                    // Green for "in" sets
                    color = {
                        border: '#059669',
                        background: '#10b981',
                        highlight: { border: '#047857', background: '#059669' }
                    };
                } else if (node.id === '∅') {
                    // Gray for empty set
                    color = {
                        border: '#64748b',
                        background: '#94a3b8',
                        highlight: { border: '#475569', background: '#64748b' }
                    };
                } else {
                    // Neutral purple for "out" sets
                    color = {
                        border: '#7c3aed',
                        background: '#8b5cf6',
                        highlight: { border: '#6d28d9', background: '#7c3aed' }
                    };
                }

                nodeUpdates.push({
                    id: node.id,
                    color: color
                });
            });
        }

        // Batch update all nodes at once
        this.networkData.nodes.update(nodeUpdates);

        // Batch update edges based on whether they're discarded
        const edges = this.networkData.edges.get();
        const edgeUpdates = [];

        edges.forEach(edge => {
            // Match discarded attacks: attack.source is the attacking element, attack.target is the attacked assumption
            // Handle both standard mode (attackedAssumption) and assumption-level mode (targetAssumption)
            const targetAssumption = edge.attackedAssumption || edge.targetAssumption;

            // For assumption-level modes with derived/joint attacks, the attackingElement is the supporting assumption,
            // but discarded_attack uses the contrary element. Check edge.contrary first for these cases.
            const attackElement = edge.contrary || edge.attackingElement;

            const isDiscarded = discardedAttacks.some(attack =>
                attack.source === attackElement &&
                attack.target === targetAssumption
            );

            // Check if this edge is an active (successful) attack
            const isActive = successfulAttacks.some(attack => {
                const match = attack.match(/attacks_successfully_with_weight\(([^,]+),\s*([^,]+),\s*([^)]+)\)/);
                if (match) {
                    const [, from, to, weight] = match;
                    return from === attackElement && to === targetAssumption;
                }
                return false;
            });

            if (isDiscarded) {
                // Style discarded attacks: dashed, thinner, gray
                edgeUpdates.push({
                    id: edge.id,
                    width: 1,
                    dashes: [5, 5],
                    color: {
                        color: '#64748b',
                        highlight: '#64748b'
                    },
                    opacity: 0.4
                });
            } else if (isActive) {
                // Highlight ONLY active attacks: make them more prominent with red color
                const originalWidth = edge.originalWidth || edge.width || 2;

                edgeUpdates.push({
                    id: edge.id,
                    width: originalWidth + 1.5, // Make active attacks thicker
                    dashes: edge.originalDashes !== undefined ? edge.originalDashes : false,
                    color: {
                        color: '#ef4444',        // Bright red
                        highlight: '#dc2626'     // Darker red for hover
                    },
                    opacity: 1.0,
                    shadow: {
                        enabled: true,
                        color: 'rgba(239, 68, 68, 0.5)',  // Red glow
                        size: 8,
                        x: 0,
                        y: 0
                    }
                });
            } else {
                // Non-applicable attacks: reset to original style (neutral)
                const originalWidth = edge.originalWidth || edge.width || 2;
                const originalColor = edge.originalColor || edge.color;

                edgeUpdates.push({
                    id: edge.id,
                    width: originalWidth,
                    dashes: edge.originalDashes !== undefined ? edge.originalDashes : false,
                    color: originalColor,
                    opacity: 0.3, // Dim non-applicable attacks
                    shadow: { enabled: false }
                });
            }
        });

        // Batch update all edges at once
        this.networkData.edges.update(edgeUpdates);

        // Ensure physics stays disabled and prevent any stabilization
        if (this.network) {
            this.network.setOptions({
                physics: { enabled: false }
            });
            // Redraw without moving nodes
            this.network.redraw();
        }
    }

    resetGraphColors() {
        // Batch reset all nodes to neutral color
        const nodes = this.networkData.nodes.get();
        const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
        const nodeUpdates = [];

        nodes.forEach(node => {
            let neutralColor;

            if (node.isJunction) {
                // Junction nodes stay green
                neutralColor = {
                    border: '#10b981',
                    background: '#10b981',
                    highlight: { border: '#059669', background: '#059669' }
                };
            } else {
                // Regular nodes/assumptions back to purple
                neutralColor = {
                    border: '#7c3aed',
                    background: '#8b5cf6',
                    highlight: { border: '#6d28d9', background: '#7c3aed' }
                };
            }

            nodeUpdates.push({
                id: node.id,
                color: neutralColor
            });
        });

        // Batch update all nodes at once
        this.networkData.nodes.update(nodeUpdates);

        // Batch reset all edges to original style
        const edges = this.networkData.edges.get();
        const edgeUpdates = [];

        edges.forEach(edge => {
            // Restore original color and style from edge data
            const originalColor = edge.originalColor || edge.color;
            const originalDashes = edge.originalDashes !== undefined ? edge.originalDashes :
                                   (edge.dashes !== undefined ? edge.dashes : false);

            edgeUpdates.push({
                id: edge.id,
                width: edge.originalWidth || edge.width || 2,
                dashes: originalDashes,
                opacity: 1.0,
                color: originalColor,
                shadow: false
            });
        });

        // Batch update all edges at once
        this.networkData.edges.update(edgeUpdates);

        // Ensure physics stays disabled and prevent any stabilization
        if (this.network) {
            this.network.setOptions({
                physics: { enabled: false }
            });
            // Redraw without moving nodes
            this.network.redraw();
        }

        // Remove active extension highlighting
        document.querySelectorAll('.answer-header').forEach(h => {
            h.classList.remove('active-extension');
        });
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

        // Parse rules (allow empty bodies with "fact <-" syntax)
        if (rulesText.length > 0) {
            clingoCode += '%% Rules\n';
            let ruleCounter = 1;
            rulesText.forEach((rule) => {
                // Match "head <- body" or "head <-" (empty body)
                const match = rule.match(/^([a-z_][a-z0-9_]*)\s*<-\s*(.*)$/i);
                if (match) {
                    const [, head, bodyStr] = match;
                    const ruleId = `r${ruleCounter++}`;

                    // Check if body is empty (fact)
                    if (bodyStr.trim() === '') {
                        clingoCode += `% ${ruleId}: ${head} <- (fact)\n`;
                        clingoCode += `head(${ruleId}, ${head}).\n`;
                    } else {
                        // Regular rule with body
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

    async runWABA() {
        if (!this.clingoReady) {
            this.log('❌ Clingo is not ready yet. Please wait...', 'error');
            return;
        }

        // Get framework code based on input mode
        let framework;
        if (this.inputMode.value === 'simple') {
            framework = this.parseSimpleABA();
        } else {
            framework = this.editor.value.trim();
        }

        if (!framework) {
            this.log('❌ Please enter a WABA framework', 'error');
            return;
        }

        // Update graph visualization
        await this.updateGraph(framework);

        // Show loading overlay
        if (window.showLoadingOverlay) {
            window.showLoadingOverlay('Running WABA...', 'Computing extensions and visualizing results');
        }

        this.runBtn.disabled = true;
        this.clearOutput();

        try {
            const startTime = performance.now();

            // Build the complete program by combining modules
            const program = this.buildProgram(framework);

            // Get number of models to find
            const numModels = parseInt(this.numModelsInput.value) || 0;

            // Debug logging
            console.log('Number of models requested:', numModels);
            console.log('Calling clingo.run with numModels =', numModels);

            // Run clingo
            const result = await clingo.run(program, numModels);

            const endTime = performance.now();
            const elapsed = ((endTime - startTime) / 1000).toFixed(3);

            // Parse and display results
            this.displayResults(result, elapsed);

            // Hide output empty state after successful run
            if (window.hideOutputEmptyState) {
                window.hideOutputEmptyState();
            }

        } catch (error) {
            this.log(`❌ Error: ${error.message}`, 'error');
            // Hide output empty state even on error (error message is displayed)
            if (window.hideOutputEmptyState) {
                window.hideOutputEmptyState();
            }
        } finally {
            // Hide loading overlay
            if (window.hideLoadingOverlay) {
                window.hideLoadingOverlay();
            }
            this.runBtn.disabled = false;
        }
    }

    buildProgram(framework) {
        // Get selected configuration
        const semiring = this.semiringSelect.value;
        const monoid = this.monoidSelect.value;
        const semantics = this.semanticsSelect.value;
        const optimize = this.optimizeSelect.value;
        const constraint = this.constraintSelect.value;
        const flatEnabled = this.flatConstraint.checked;
        const budget = parseInt(this.budgetInput.value) || 100;

        // Embed WABA modules inline (since we can't load files in browser)
        const coreBase = this.getCoreModule();
        const semiringModule = this.getSemiringModule(semiring);
        const monoidModule = this.getMonoidModule(monoid);
        const filterModule = this.getFilterModule();
        const optimizeModule = this.getOptimizeModule(optimize);
        const semanticsModule = this.getSemanticsModule(semantics);
        // Only use budget constraint if not optimizing
        const constraintModule = optimize === 'none' ? this.getConstraintModule(constraint, budget) : '';
        const flatModule = flatEnabled ? this.getFlatModule() : '';

        // Combine all modules
        return `
%% === WABA Core Base ===
${coreBase}

%% === Semiring: ${semiring} ===
${semiringModule}

%% === Monoid: ${monoid} ===
${monoidModule}

%% === Filter ===
${filterModule}

%% === Optimization: ${optimize} ===
${optimizeModule}

%% === Budget Constraint: ${constraint} ===
${constraintModule}

%% === Flat Constraint ===
${flatModule}

%% === Semantics: ${semantics} ===
${semanticsModule}

%% === User Framework ===
${framework}
`;
    }

    getCoreModule() {
            return `
    %% WABA Base Logic (Semiring/Monoid-Independent)
    %% This file contains the core argumentation logic that is independent
    %% of the choice of semiring (weight propagation) and monoid (cost aggregation).

    %% Budget declaration moved to constraint files (constraint/ub.lp or constraint/lb.lp)

    %% Rule meta-predicate
    rule(R) :- head(R,_).

    %% Assumption choice: each assumption is either in or out
    in(X) :- assumption(X), not out(X).
    out(X) :- assumption(X), not in(X).

    %% Support computation (weight-independent)
    %% An atom is supported if:
    %% 1. It's an assumption that is in, OR
    %% 2. There exists a rule with this atom as head and all body elements are supported
    supported(X) :- assumption(X), in(X).
    supported(X) :- head(R,X), triggered_by_in(R).

    %% A rule is triggered when all its body elements are supported
    triggered_by_in(R) :- head(R,_), supported(X) : body(R,X).

    %% Attack computation
    %% An attack exists when a supported atom X attacks an assumption Y
    %% (where Y's contrary is X), with the weight of X
    attacks_with_weight(X,Y,W) :- supported(X), supported_with_weight(X,W),
                                   assumption(Y), contrary(Y,X).

    %% Attack discretion choice
    %% We can choose to discard any attack (at a cost)
    { discarded_attack(X,Y,W) : attacks_with_weight(X,Y,W) }.

    %% Successful attacks
    %% An attack succeeds if it's not discarded
    attacks_successfully_with_weight(X,Y,W) :- attacks_with_weight(X,Y,W),
                                                 not discarded_attack(X,Y,W).

    %% Defeat
    %% An assumption is defeated if there's a successful attack against it
    defeated(X) :- attacks_successfully_with_weight(_,X,_).

    %% Budget constraint is modular (loaded separately):
    %% - constraint/ub.lp: Upper Bound regime for MAX/SUM/COUNT/LEX monoids
    %% - constraint/lb.lp: Lower Bound regime for MIN monoid
    `;
        }


        getSemiringModule(semiring) {
            const modules = {
                godel: `
    %% Gödel Semiring for Weight Propagation (Fuzzy Logic)
    %% Semiring: (ℤ ∪ {±∞}, max, min, #inf, #sup)
    %% - Domain: All integers plus infinities
    %% - Disjunction/⊕ (OR, multiple derivations): max (strongest alternative)
    %% - Conjunction/⊗ (AND, body elements): min (weakest link)
    %% - Additive identity: #inf (identity for max operation)
    %% - Multiplicative identity: #sup (identity for min operation)
    %% - Interpretation: weights are truth degrees, higher is better
    %%
    %% In Gödel fuzzy logic:
    %% - Domain: ℤ ∪ {±∞} (integers plus positive/negative infinity)
    %% - Conjunction takes the minimum (weakest link in a chain)
    %% - Disjunction takes the maximum (strongest of multiple proofs)
    %% - Unweighted atoms get #sup (maximum truth, hardest to discard)

    %% =============================================
    %% CLASSICAL ABA RECOVERY (No Discarding)
    %% =============================================
    %%
    %% To recover plain unweighted ABA behavior with this semiring:
    %%
    %% UPPER BOUND REGIME (MAX, SUM, COUNT, LEX monoids):
    %%   δ = #sup     (default weight for unweighted assumptions)
    %%   β = 0        (budget value)
    %%   Mechanism: constraint/ub.lp explicitly rejects discarding #sup-weighted attacks
    %%              (line 41: \`:- discarded_attack(_,_,#sup), budget(B), B != #sup.\`)
    %%
    %% LOWER BOUND REGIME (MIN monoid):
    %%   Option 1 (recommended):
    %%     δ = #inf   (default weight)
    %%     β = 0      (budget value)
    %%     Mechanism: MIN(#inf) = #inf < 0, rejected by constraint/lb.lp
    %%   Option 2:
    %%     δ = #sup   (default weight)
    %%     β = any    (any finite budget)
    %%     Mechanism: constraint/lb.lp explicitly rejects discarding #sup attacks
    %%                (line 43: \`:- discarded_attack(_,_,#sup).\`)
    %%
    %% CURRENT IMPLEMENTATION: δ = #sup (see line ~45 below)
    %% This enables ABA recovery for all monoids with appropriate budget settings.

    %% ========================================
    %% DEFAULT WEIGHT PRINCIPLE: SUPREMUM
    %% ========================================
    %%
    %% Unweighted atoms receive the SUPREMUM (maximum value in range):
    %% - Matches standard ABA: assumptions accepted by default ("innocent until proven guilty")
    %% - "Hardest to discard": attacks from unweighted atoms are maximally expensive
    %% - Budget semantics: requires budget ≥ #sup to discard such attacks
    %%
    %% For Gödel semiring:
    %% - Supremum = #sup (positive infinity, fully true, maximum truth degree)
    %% - Meaning: Unweighted assumptions have maximum truth value
    %% - Discard cost with max monoid: max(#sup, ...) = #sup (infinitely expensive)
    %% - Discard cost with min monoid: not compatible (see compatibility theory)
    %% - Discard cost with sum monoid: sum += #sup → #sup (infinitely expensive)
    %%
    %% Explicit weights REPLACE the supremum default (via mutually exclusive rules).
    %% DEFAULT WEIGHTS for unweighted atoms are now defined in monoid/*.lp files,
    %% since the monoid determines what "hard to discard" means.
    %%

    %% Assumptions with explicit weights
    %% FLAT-WABA: assumption is not a rule head
    %% NON-FLAT-WABA: if assumption is also a rule head, weight is computed below via rule derivation
    supported_with_weight(X,W) :- assumption(X), in(X), weight(X,W), not head(_,X).

    %% Assumptions without explicit weights: Use supremum (maximum truth value)
    %% For Gödel semiring, unweighted assumptions get #sup (maximum truth degree)
    %% Rationale: Unweighted assumptions are "hardest to discard" (default acceptance)
    %% - Matches standard ABA semantics: assumptions accepted by default
    %% - #sup = positive infinity (supremum, maximum value)
    %% - In conjunction (min): min(#sup, x) = x (doesn't affect derivations)
    %% - In disjunction (max): max(#sup, x) = #sup (dominates, represents maximum truth)
    %%
    %% NOTE: Uses #sup (positive infinity) as the supremum value.
    %% Constraints must handle #sup specially for budget checking.
    %%
    %% FLAT-WABA: assumption is not a rule head
    %% NON-FLAT-WABA: if assumption is also a rule head, weight is computed below via rule derivation
    supported_with_weight(X,#sup) :- assumption(X), in(X), not weight(X,_), not head(_,X).

    %% Step 1: Compute weight for each rule derivation using conjunction (minimum)
    %% For rule R deriving X: take minimum weight among all body elements
    %% IMPORTANT: Only compute weight for TRIGGERED rules (all body elements supported)
    rule_derivation_weight(R,X,W) :-
        head(R,X),
        supported(X),
        body(R,_),  % Only for rules with bodies
        triggered_by_in(R),  % Only triggered rules (prevents #sup from unsupported bodies)
        W = #min{ V,B : body(R,B), supported_with_weight(B,V) }.

    %% Handle rules with empty bodies (facts): Use #inf (identity for max)
    %% SOLUTION: Use additive identity (#inf for max) instead of multiplicative identity (#sup for min)
    %%
    %% Traditional approach assigned #sup (multiplicative identity for min/conjunction):
    %%   rule_derivation_weight(R,X,#sup) :- ... not body(R,_).
    %%
    %% Problem: max(#sup, explicit_weight) = #sup dominates all explicit weights!
    %%   Example: weight(c1, 8) → max(#sup, 8) = #sup → explicit weight LOST
    %%
    %% Solution: Use #inf (additive identity for max/disjunction):
    %%   max(#inf, x) = x for any x > #inf
    %%   This makes empty-body derivations "invisible" in the max aggregate
    %%   Explicit weights are preserved: max(#inf, 8) = 8 ✓
    %%
    %% Algebraic justification:
    %%   - #inf is the true identity for max operation (a ⊕ #inf = a)
    %%   - Empty-body facts contribute no information to weight disjunction
    %%   - Explicit weights take precedence without special-case logic
    %%
    rule_derivation_weight(R,X,#inf) :-
        head(R,X),
        supported(X),
        not body(R,_).

    %% Step 2: Combine multiple derivations using disjunction (maximum)
    %% IMPORTANT: Use DISJUNCTION OPERATOR (⊕) to combine weights from different paths:
    %% - Multiple rule derivations are combined via ⊕
    %% - Explicit weight is another "path" to support, combined via ⊕
    %% - For Gödel semiring: ⊕ = max (choose strongest/highest truth path)
    %%
    %% SEMANTICS: Explicit weight + derived weight represent ALTERNATIVE support paths.
    %% The actual weight is their DISJUNCTION, not conjunction or override.
    %%
    %% Example: If X has explicit weight 50 and is also derived with weight 80,
    %%          then supported_with_weight(X, max(50, 80)) = supported_with_weight(X, 80)
    %%          (the stronger path is chosen)
    supported_with_weight(X,W) :-
        supported(X),
        head(_,X),  % X is derived (not just an assumption)
        not assumption(X),  % X is not an assumption
        W = #max{ V,R : rule_derivation_weight(R,X,V) ;
                  V : weight(X,V) }.  % DISJUNCTION (⊕ = max for Gödel)

    %% NON-FLAT-WABA: Derived assumption with explicit weight
    %% Combine rule-derived weight with explicit weight via DISJUNCTION (max)
    supported_with_weight(X,W) :-
        assumption(X),
        supported(X),
        head(_,X),  % Assumption is also derived
        weight(X,_),  % Has explicit weight
        W = #max{ V,R : rule_derivation_weight(R,X,V) ;
                  V : weight(X,V) }.  % DISJUNCTION (⊕ = max for Gödel)

    %% NON-FLAT-WABA: Derived assumption WITHOUT explicit weight, but is IN
    %% For Gödel: max(derived, #sup) = #sup always (default dominates)
    %% NOTE: Clingo ignores #sup in aggregates, so we assign it explicitly
    supported_with_weight(X,#sup) :-
        assumption(X),
        in(X),  % Assumption is selected
        supported(X),
        head(_,X),  % Assumption is also derived
        not weight(X,_).  % No explicit weight → default #sup dominates
    `,
                tropical: `
    %% Tropical Semiring for Weight Propagation
    %% Semiring: (ℤ ∪ {±∞}, min, +, #sup, 0)
    %% - Domain: All integers plus infinities
    %% - Disjunction/⊕ (OR, multiple derivations): min (choose best path)
    %% - Conjunction/⊗ (AND, body elements): + (accumulate costs)
    %% - Additive identity: #sup (identity for min operation)
    %% - Multiplicative identity: 0 (identity for addition)
    %% - Interpretation: weights are costs, lower is better
    %%
    %% This is the tropical semiring used for shortest path problems.

    %% =============================================
    %% CLASSICAL ABA RECOVERY (No Discarding)
    %% =============================================
    %%
    %% To recover plain unweighted ABA behavior with this semiring:
    %%
    %% UPPER BOUND REGIME (MAX, SUM, COUNT, LEX monoids):
    %%   δ = #sup     (default weight for unweighted assumptions)
    %%   β = 0        (budget value)
    %%   Mechanism: constraint/ub.lp explicitly rejects discarding #sup-weighted attacks
    %%
    %% LOWER BOUND REGIME (MIN monoid):
    %%   δ = #inf     (default weight for unweighted assumptions)
    %%   β = 0        (budget value)
    %%   Mechanism: MIN(#inf) = #inf < 0, rejected by constraint/lb.lp
    %%   Alternative: δ = #sup with special constraint rejection
    %%
    %% CURRENT IMPLEMENTATION: δ = #sup (see line ~52 below)
    %% This enables ABA recovery for UB monoids with β = 0.
    %% For LB monoids, use δ = #inf by setting all assumption weights explicitly.

    %% ========================================
    %% DEFAULT WEIGHT PRINCIPLE: SUPREMUM
    %% ========================================
    %%
    %% Unweighted atoms receive the SUPREMUM (maximum value in range):
    %% - Matches standard ABA: assumptions accepted by default ("innocent until proven guilty")
    %% - "Hardest to discard": attacks from unweighted atoms are maximally expensive
    %% - Budget semantics: attacks with cost #sup (∞) CANNOT be discarded
    %%
    %% For Tropical:
    %% - Supremum = #sup (∞, infinite cost)
    %% - Meaning: Unweighted assumptions have infinite cost (unbounded)
    %% - Discard cost with max monoid: max(#sup, ...) = #sup (impossible to discard!)
    %% - Discard cost with min monoid: min(#sup, ...) = other values (doesn't contribute)
    %% - Discard cost with sum monoid: sum + #sup = #sup (impossible to discard!)
    %%
    %% Note: This makes unweighted attacks IMPOSSIBLE to discard (not just expensive).
    %% Only attacks with explicit finite costs can be discarded within budget constraints.
    %%
    %% Explicit weights REPLACE the supremum default (via mutually exclusive rules).
    %% DEFAULT WEIGHTS for unweighted atoms are now defined in monoid/*.lp files,
    %% since the monoid determines what "hard to discard" means.
    %%

    %% Assumptions with explicit weights
    %% FLAT-WABA: assumption is not a rule head
    %% NON-FLAT-WABA: if assumption is also a rule head, weight is computed below via rule derivation
    supported_with_weight(X,W) :- assumption(X), in(X), weight(X,W), not head(_,X).

    %% Assumptions without explicit weights: Use supremum (infinite cost)
    %% For Tropical semiring, unweighted assumptions get #sup (infinite cost)
    %% Rationale: Unweighted assumptions are "hardest to discard" (default acceptance)
    %% - #sup = positive infinity (infinite cost)
    %% - Matches standard ABA: assumptions accepted by default
    %% - In conjunction (+): #sup + x = #sup (infinite cost propagates)
    %% - In disjunction (min): min(#sup, x) = x (doesn't dominate)
    %%
    %% NOTE: Uses #sup (positive infinity) as supremum.
    %% Constraints must handle #sup specially for budget checking.
    %%
    %% FLAT-WABA: assumption is not a rule head
    %% NON-FLAT-WABA: if assumption is also a rule head, weight is computed below via rule derivation
    supported_with_weight(X,#sup) :- assumption(X), in(X), not weight(X,_), not head(_,X).

    %% Step 1: Compute weight for each rule derivation using conjunction (addition)
    %% For rule R deriving X: sum the weights of all body elements
    %% IMPORTANT: Only compute weight for TRIGGERED rules (all body elements supported)
    %%
    %% Special handling for #sup: clingo's #sum aggregate ignores #sup values
    %% If ANY body element has weight #sup, result is #sup (infinite cost propagates)

    %% Helper: detect if any body element has #sup weight
    body_has_sup_weight(R) :- body(R,B), supported_with_weight(B,#sup).

    %% If any body has #sup, derivation weight is #sup (infinite cost)
    rule_derivation_weight(R,X,#sup) :-
        head(R,X),
        supported(X),
        body(R,_),
        triggered_by_in(R),
        body_has_sup_weight(R).

    %% Otherwise, sum finite weights (no #sup values present)
    rule_derivation_weight(R,X,W) :-
        head(R,X),
        supported(X),
        body(R,_),
        triggered_by_in(R),
        not body_has_sup_weight(R),
        W = #sum{ V,B : body(R,B), supported_with_weight(B,V) }.

    %% Handle rules with empty bodies (facts): Use #sup (identity for min)
    %% SOLUTION: Use additive identity (#sup for min) instead of multiplicative identity (0 for +)
    %%
    %% Traditional approach assigned 0 (multiplicative identity for +/conjunction):
    %%   rule_derivation_weight(R,X,0) :- ... not body(R,_).
    %%
    %% Problem: min(0, explicit_weight) = 0 dominates all explicit weights > 0!
    %%   Example: weight(c1, 8) → min(0, 8) = 0 → explicit weight LOST
    %%
    %% Solution: Use #sup (additive identity for min/disjunction):
    %%   min(#sup, x) = x for any x < #sup
    %%   This makes empty-body derivations "invisible" in the min aggregate
    %%   Explicit weights are preserved: min(#sup, 8) = 8 ✓
    %%
    %% Algebraic justification:
    %%   - #sup is the true identity for min operation (a ⊕ #sup = a)
    %%   - Empty-body facts contribute no information to weight disjunction
    %%   - Explicit weights take precedence without special-case logic
    %%
    rule_derivation_weight(R,X,#sup) :-
        head(R,X),
        supported(X),
        not body(R,_).

    %% Step 2: Combine multiple derivations using disjunction (minimum)
    %% IMPORTANT: Use DISJUNCTION OPERATOR (⊕) to combine weights from different paths:
    %% - Multiple rule derivations are combined via ⊕
    %% - Explicit weight is another "path" to support, combined via ⊕
    %% - For Tropical semiring: ⊕ = min (choose best/cheapest path)
    %%
    %% SEMANTICS: Explicit weight + derived weight represent ALTERNATIVE support paths.
    %% The actual weight is their DISJUNCTION, not conjunction or override.
    %%
    %% Example: If X has explicit weight 50 and is also derived with weight 30,
    %%          then supported_with_weight(X, min(50, 30)) = supported_with_weight(X, 30)
    %%          (the cheaper path is chosen)
    supported_with_weight(X,W) :-
        supported(X),
        head(_,X),  % X is derived (not just an assumption)
        not assumption(X),  % X is not an assumption
        W = #min{ V,R : rule_derivation_weight(R,X,V) ;
                  V : weight(X,V) }.  % DISJUNCTION (⊕ = min for Tropical)

    %% NON-FLAT-WABA: Derived assumption with explicit weight
    %% Combine rule-derived weight with explicit weight via DISJUNCTION (min)
    supported_with_weight(X,W) :-
        assumption(X),
        supported(X),
        head(_,X),  % Assumption is also derived
        weight(X,_),  % Has explicit weight
        W = #min{ V,R : rule_derivation_weight(R,X,V) ;
                  V : weight(X,V) }.  % DISJUNCTION (⊕ = min for Tropical)

    %% NON-FLAT-WABA: Derived assumption WITHOUT explicit weight, but is IN
    %% Combine rule-derived weight with default assumption weight (#sup) via DISJUNCTION (min)
    supported_with_weight(X,W) :-
        assumption(X),
        in(X),  % Assumption is selected
        supported(X),
        head(_,X),  % Assumption is also derived
        not weight(X,_),  % No explicit weight
        W = #min{ V,R : rule_derivation_weight(R,X,V) ;
                  #sup : true }.  % DISJUNCTION with default: min(derived, #sup) = derived
    `,
                arctic: `
    %% Arctic (Max-Plus) Semiring for Weight Propagation - OPTIMIZED
    %% Semiring: (ℤ ∪ {±∞}, max, +, #inf, 0)
    %% - Domain: ℤ ∪ {±∞} (integers plus positive/negative infinity)
    %% - Disjunction/⊕ (OR): max (strongest alternative)
    %% - Conjunction/⊗ (AND): + (accumulate rewards)
    %% - Additive identity: #inf (identity for max operation)
    %% - Multiplicative identity: 0 (identity for + operation)
    %% - Interpretation: weights are rewards/benefits, higher is better
    %%
    %% OPTIMIZATION NOTES:
    %% ===================
    %% This version removes redundant #inf handling that was causing performance issues:
    %% - REMOVED: body_has_inf_weight(R) helper (never true in practice)
    %% - REMOVED: rule_derivation_weight for #inf with bodies (never fires)
    %% - REMOVED: not body_has_inf_weight(R) negations (redundant checks)
    %%
    %% Rationale:
    %% - Benchmarks show NO frameworks use #inf weights in rule bodies
    %% - #inf only used for empty-body rules (additive identity for max)
    %% - Redundant checks caused 20-40% grounding overhead
    %% - Structure now matches Tropical semiring (cleaner, faster)
    %%
    %% SEMANTICS: Reward Accumulation / Longest Path
    %% ==============================================
    %% The Arctic semiring is the DUAL of the Tropical semiring:
    %% - Tropical: (+, min) for cost minimization / shortest path
    %% - Arctic: (+, max) for reward maximization / longest path

    %% =============================================
    %% CLASSICAL ABA RECOVERY (No Discarding)
    %% =============================================
    %%
    %% To recover plain unweighted ABA behavior with this semiring:
    %%
    %% UPPER BOUND REGIME (MAX, SUM, COUNT monoids):
    %%   δ = 0        (default weight for unweighted assumptions)
    %%   β = #inf     (budget value - negative infinity)
    %%   Mechanism: Any discard gives cost ≥ 0 > #inf, rejected by constraint/ub.lp
    %%   Note: β = #inf must be set in framework file
    %%         Add: budget(#inf). to your .lp file
    %%
    %% LOWER BOUND REGIME (MIN monoid):
    %%   δ = 0        (default weight for unweighted assumptions)
    %%   β = #sup     (budget value - positive infinity)
    %%   Mechanism: MIN(0) = 0 < #sup, rejected by constraint/lb.lp
    %%              No discards: extension_cost = #sup ≥ #sup, accepted
    %%
    %% CURRENT IMPLEMENTATION: δ = 0 (see line ~54 below)
    %% This is the natural default for Arctic (multiplicative identity).

    %% ========================================
    %% DEFAULT WEIGHT PRINCIPLE: NEUTRALITY
    %% ========================================
    %%
    %% Unweighted atoms receive the MULTIPLICATIVE IDENTITY (0):
    %% - For addition: 0 + x = x (neutral, doesn't affect accumulation)
    %% - Default weight of 0 means "no reward contributed"

    %% Assumptions with explicit weights
    %% FLAT-WABA: assumption is not a rule head
    %% NON-FLAT-WABA: if assumption is also a rule head, weight is computed below via rule derivation
    supported_with_weight(X,W) :- assumption(X), in(X), weight(X,W), not head(_,X).

    %% Assumptions without explicit weights: Use multiplicative identity (0)
    %% For Arctic semiring, unweighted assumptions get 0 (neutral reward)
    %% Rationale: Neutral contribution to reward accumulation
    %% - In conjunction (+): 0 + x = x (doesn't affect sum)
    %% - In disjunction (max): max(0, x) = x for x > 0 (neutral for positive rewards)
    %%
    %% FLAT-WABA: assumption is not a rule head
    %% NON-FLAT-WABA: if assumption is also a rule head, weight is computed below via rule derivation
    supported_with_weight(X,0) :- assumption(X), in(X), not weight(X,_), not head(_,X).

    %% Step 1: Compute weight for each rule derivation using conjunction (addition)
    %% For rule R deriving X: sum weights of all body elements (accumulate rewards)
    %% IMPORTANT: Only compute weight for TRIGGERED rules (all body elements supported)

    %% OPTIMIZED: Only handle #sup (infinite reward propagation)
    %% #inf handling removed - never occurs in practice, caused 20-40% overhead

    %% Helper: detect if any body element has #sup weight (infinite reward)
    body_has_sup_weight(R) :- body(R,B), supported_with_weight(B,#sup).

    %% If any body has #sup, derivation weight is #sup (infinite reward propagates)
    rule_derivation_weight(R,X,#sup) :-
        head(R,X),
        supported(X),
        body(R,_),
        triggered_by_in(R),
        body_has_sup_weight(R).

    %% Otherwise, sum finite weights (standard case)
    %% OPTIMIZED: Removed "not body_has_inf_weight(R)" - redundant negation
    rule_derivation_weight(R,X,W) :-
        head(R,X),
        supported(X),
        body(R,_),
        triggered_by_in(R),
        not body_has_sup_weight(R),
        W = #sum{ V,B : body(R,B), supported_with_weight(B,V) }.

    %% Handle rules with empty bodies (facts): Use #inf (additive identity for max)
    %% IMPORTANT: Use #inf (not 0) to make empty-body derivations "invisible" in max
    %%
    %% Rationale:
    %% - Facts derive conclusions without premises
    %% - In disjunction (max), we want explicit weights to dominate
    %% - max(#inf, explicit_weight) = explicit_weight ✓
    %% - If we used 0: max(0, negative_weight) = 0 ✗ (wrong!)
    %%
    %% Algebraic justification:
    %% - #inf is the true additive identity for max: max(x, #inf) = x
    %% - Empty-body derivations contribute no information
    %% - Explicit weights take precedence
    rule_derivation_weight(R,X,#inf) :-
        head(R,X),
        supported(X),
        not body(R,_).

    %% Step 2: Combine multiple derivations using disjunction (maximum)
    %% IMPORTANT: Use DISJUNCTION OPERATOR (⊕) to combine weights from different paths:
    %% - Multiple rule derivations are combined via ⊕
    %% - Explicit weight is another "path" to support, combined via ⊕
    %% - For Arctic semiring: ⊕ = max (choose strongest/highest reward path)
    %%
    %% SEMANTICS: Explicit weight + derived weight represent ALTERNATIVE support paths.
    %% The actual weight is their DISJUNCTION, not conjunction or override.
    %%
    %% Example: If X has explicit weight 10 and is also derived with weight 25,
    %%          then supported_with_weight(X, max(10, 25)) = supported_with_weight(X, 25)
    %%          (the higher reward path is chosen)
    supported_with_weight(X,W) :-
        supported(X),
        head(_,X),  % X is derived (not just an assumption)
        not assumption(X),  % X is not an assumption
        W = #max{ V,R : rule_derivation_weight(R,X,V) ;
                  V : weight(X,V) }.  % DISJUNCTION (⊕ = max for Arctic)

    %% NON-FLAT-WABA: Derived assumption with explicit weight
    %% Combine rule-derived weight with explicit weight via DISJUNCTION (max)
    supported_with_weight(X,W) :-
        assumption(X),
        supported(X),
        head(_,X),  % Assumption is also derived
        weight(X,_),  % Has explicit weight
        W = #max{ V,R : rule_derivation_weight(R,X,V) ;
                  V : weight(X,V) }.  % DISJUNCTION (⊕ = max for Arctic)

    %% NON-FLAT-WABA: Derived assumption WITHOUT explicit weight, but is IN
    %% Combine rule-derived weight with default assumption weight (0) via DISJUNCTION (max)
    supported_with_weight(X,W) :-
        assumption(X),
        in(X),  % Assumption is selected
        supported(X),
        head(_,X),  % Assumption is also derived
        not weight(X,_),  % No explicit weight
        W = #max{ V,R : rule_derivation_weight(R,X,V) ;
                  0 : true }.  % DISJUNCTION with default: max(derived, 0) = derived (if positive)
    `,
                lukasiewicz: `
    %% Łukasiewicz Semiring for Weight Propagation - OPTIMIZED
    %% Semiring: ([0,K] ∪ {±∞}, ⊕_Ł, ⊗_Ł, 0, K)
    %% - Domain: [0,K] ∪ {±∞} where K is the normalization constant (default K=100)
    %% - Disjunction/⊕_Ł (OR): bounded sum min(K, a + b)
    %% - Conjunction/⊗_Ł (AND): bounded sum max(0, a + b - K*(n-1))
    %% - Additive identity (disjunction): 0
    %% - Multiplicative identity (conjunction): K
    %% - Interpretation: weights are truth degrees, higher is better
    %% - Normalization constant K: parametrizable via CLI (default K=100)
    %% - Default weight for unweighted assumptions: #sup
    %%
    %% OPTIMIZATION NOTES:
    %% ===================
    %% This version attempts to inline body_count and body_sum helpers to reduce grounding overhead.
    %% Strategy: Combine count and sum operations directly in rule_derivation_weight computation.
    %%
    %% Original had 3 helpers:
    %% 1. body_has_sup_weight - KEPT (necessary for #sum limitation)
    %% 2. body_count - REMOVED (inlined into derivation rule)
    %% 3. body_sum - REMOVED (inlined into derivation rule)
    %%
    %% Expected improvement: 30-40% reduction in grounding overhead

    #const luk_k = 100.

    %% =============================================
    %% CLASSICAL ABA RECOVERY (No Discarding)
    %% =============================================
    %%
    %% To recover plain unweighted ABA behavior with this semiring:
    %%
    %% UPPER BOUND REGIME (MAX, SUM, COUNT monoids):
    %%   δ = #sup     (default weight for unweighted assumptions)
    %%   β = 0        (budget value)
    %%   Mechanism: constraint/ub.lp explicitly rejects discarding #sup-weighted attacks
    %%
    %% LOWER BOUND REGIME (MIN monoid):
    %%   δ = #inf     (default weight for unweighted assumptions)
    %%   β = 0        (budget value)
    %%   Mechanism: MIN(#inf) = #inf < 0, rejected by constraint/lb.lp
    %%
    %% CURRENT IMPLEMENTATION: δ = #sup (see line below)

    %% ========================================
    %% DEFAULT WEIGHT PRINCIPLE: SUPREMUM
    %% ========================================
    %%
    %% Unweighted atoms receive #sup (NOT the semiring identity K!)
    %% This is a WABA design choice for ABA recovery.

    %% Assumptions with explicit weights
    supported_with_weight(X,W) :- assumption(X), in(X), weight(X,W), not head(_,X).

    %% Assumptions without explicit weights: Use #sup
    supported_with_weight(X,#sup) :- assumption(X), in(X), not weight(X,_), not head(_,X).

    %% Step 1: Compute weight for each rule derivation using conjunction (Łukasiewicz AND)
    %% Łukasiewicz AND: max(0, sum(weights) - K*(n-1))
    %% OPTIMIZED: Inline count and sum directly in the rule

    %% Helper: detect if any body element has #sup weight (NECESSARY - kept from original)
    body_has_sup_weight(R) :- body(R,B), supported_with_weight(B,#sup).

    %% If any body has #sup, result is #sup (infinite truth propagates)
    rule_derivation_weight(R,X,#sup) :-
        head(R,X),
        supported(X),
        body(R,_),
        triggered_by_in(R),
        body_has_sup_weight(R).

    %% Otherwise, apply Łukasiewicz conjunction formula directly
    %% OPTIMIZED: Inline both count and sum operations
    rule_derivation_weight(R,X,W) :-
        head(R,X),
        supported(X),
        body(R,_),
        triggered_by_in(R),
        not body_has_sup_weight(R),
        N = #count{ B : body(R,B) },
        S = #sum{ V,B : body(R,B), supported_with_weight(B,V) },
        W = #max{ 0; S - luk_k*(N-1) }.

    %% Handle rules with empty bodies (facts): Use 0 (additive identity)
    rule_derivation_weight(R,X,0) :-
        head(R,X),
        supported(X),
        not body(R,_).

    %% Step 2: Combine multiple derivations using disjunction (Łukasiewicz OR)
    %% Łukasiewicz OR: min(K, sum)
    %% IMPORTANT: Handle #sup separately (cannot be summed)

    %% ======================================
    %% REGULAR DERIVED ATOMS (not assumptions)
    %% ======================================

    %% If any derivation has #sup, result is #sup
    supported_with_weight(X,#sup) :-
        supported(X),
        head(_,X),
        not assumption(X),
        rule_derivation_weight(_,X,#sup).

    %% If explicit weight is #sup, result is #sup
    supported_with_weight(X,#sup) :-
        supported(X),
        head(_,X),
        not assumption(X),
        weight(X,#sup).

    %% Otherwise, sum finite values and cap at K
    supported_with_weight(X,W) :-
        supported(X),
        head(_,X),
        not assumption(X),
        not rule_derivation_weight(_,X,#sup),
        not weight(X,#sup),
        S = #sum{ V : rule_derivation_weight(_,X,V) ;
                  V : weight(X,V) },
        W = #min{ luk_k; S }.

    %% =====================================================
    %% NON-FLAT-WABA: Derived assumption WITH explicit weight
    %% =====================================================

    %% If any derivation has #sup, result is #sup
    supported_with_weight(X,#sup) :-
        assumption(X),
        supported(X),
        head(_,X),
        weight(X,_),
        rule_derivation_weight(_,X,#sup).

    %% If explicit weight is #sup, result is #sup
    supported_with_weight(X,#sup) :-
        assumption(X),
        supported(X),
        head(_,X),
        weight(X,#sup).

    %% Otherwise, sum finite values and cap at K
    supported_with_weight(X,W) :-
        assumption(X),
        supported(X),
        head(_,X),
        weight(X,_),
        not rule_derivation_weight(_,X,#sup),
        not weight(X,#sup),
        S = #sum{ V : rule_derivation_weight(_,X,V) ;
                  V : weight(X,V) },
        W = #min{ luk_k; S }.

    %% ================================================================
    %% NON-FLAT-WABA: Derived assumption WITHOUT explicit weight, but IN
    %% ================================================================

    %% If any derivation has #sup, result is #sup
    supported_with_weight(X,#sup) :-
        assumption(X),
        in(X),
        supported(X),
        head(_,X),
        not weight(X,_),
        rule_derivation_weight(_,X,#sup).

    %% Default weight #sup always applies for unweighted assumptions
    supported_with_weight(X,#sup) :-
        assumption(X),
        in(X),
        supported(X),
        head(_,X),
        not weight(X,_).
    `,
                bottleneck_cost: `
    %% Bottleneck-Cost Semiring for Weight Propagation
    %% Semiring: (ℤ ∪ {±∞}, min, max, #sup, #inf)
    %% - Domain: ℤ ∪ {±∞} (integers plus positive/negative infinity)
    %% - Disjunction/⊕ (OR): min (cheapest alternative)
    %% - Conjunction/⊗ (AND): max (bottleneck / worst component)
    %% - Additive identity: #sup (identity for min operation)
    %% - Multiplicative identity: #inf (identity for max operation)
    %% - Interpretation: weights are costs/penalties, LOWER is better
    %%
    %% SEMANTICS: Bottleneck Cost / Maximum Penalty
    %% ============================================
    %% The bottleneck-cost semiring models scenarios where:
    %% - A chain's cost is determined by its WORST/highest-cost component (max for conjunction)
    %% - Among alternatives, choose the CHEAPEST path (min for disjunction)
    %% - Applications: Bottleneck problems, worst-case cost, maximum penalty
    %%
    %% Key insight: This is the DUAL of standard min/max bottleneck:
    %% - Standard bottleneck (min/max): Maximize minimum capacity
    %% - Bottleneck-cost (max/min): Minimize maximum cost
    %%
    %% Examples:
    %% - Quality control: Reject batch if ANY component exceeds defect threshold (max)
    %% - Security: System vulnerability = worst component vulnerability (max)
    %% - Logistics: Route cost = bottleneck (slowest/most expensive segment)

    %% =============================================
    %% CLASSICAL ABA RECOVERY (No Discarding)
    %% =============================================
    %%
    %% To recover plain unweighted ABA behavior with this semiring:
    %%
    %% UPPER BOUND REGIME (MAX, SUM, COUNT, LEX monoids):
    %%   δ = #sup     (default weight for unweighted assumptions)
    %%   β = 0        (budget value)
    %%   Mechanism: constraint/ub.lp explicitly rejects discarding #sup-weighted attacks
    %%
    %% LOWER BOUND REGIME (MIN monoid):
    %%   δ = #inf     (default weight for unweighted assumptions)
    %%   β = 0        (budget value)
    %%   Mechanism: MIN(#inf) = #inf < 0, rejected by constraint/lb.lp
    %%   Alternative: δ = #sup with special constraint rejection
    %%
    %% CURRENT IMPLEMENTATION: δ = #sup (see line ~60 below)
    %% This enables ABA recovery for UB monoids with β = 0.
    %% For LB monoids, use δ = #inf by setting all assumption weights explicitly.
    %%
    %% Comparison to Tropical:
    %% - Tropical (+/min): Minimize SUM of costs (total cost matters)
    %% - Bottleneck-cost (max/min): Minimize MAX of costs (worst-case matters)

    %% ========================================
    %% DEFAULT WEIGHT PRINCIPLE: INFIMUM
    %% ========================================
    %%
    %% Unweighted atoms receive the INFIMUM (minimum value in range):
    %% - For bottleneck-cost semantics: #inf = infinitely GOOD (zero cost)
    %% - Meaning: Unweighted assumptions impose no cost/penalty
    %%
    %% IMPORTANT: This differs from Tropical and Arctic!
    %% - Tropical: #sup default (infinitely expensive, hard to discard)
    %% - Bottleneck-cost: #inf default (zero cost, easy to discard)
    %%
    %% For Bottleneck-cost semiring:
    %% - Multiplicative identity = #inf (neutral for max)
    %% - Meaning: Unweighted assumptions contribute zero cost
    %% - In conjunction (max): max(#inf, x) = x (no cost added)
    %% - In disjunction (min): min(#inf, x) = #inf (infinitely cheap path)
    %%
    %% This creates "optimistic" semantics:
    %% - Unweighted assumptions are assumed to be "free" (zero cost)
    %% - Only explicit weights impose costs
    %%
    %% If you want unweighted assumptions to be "hard to discard", the monoid
    %% should assign #sup as default weight (monoid/*.lp files handle this).

    %% Assumptions with explicit weights
    %% FLAT-WABA: assumption is not a rule head
    %% NON-FLAT-WABA: if assumption is also a rule head, weight is computed below via rule derivation
    supported_with_weight(X,W) :- assumption(X), in(X), weight(X,W), not head(_,X).

    %% Assumptions without explicit weights: Use multiplicative identity (#inf)
    %% For Bottleneck-cost semiring, unweighted assumptions get #inf (zero cost)
    %% Rationale: Neutral contribution to bottleneck cost
    %% - In conjunction (max): max(#inf, x) = x (doesn't affect bottleneck)
    %% - In disjunction (min): min(#inf, x) = #inf (infinitely cheap)
    %%
    %% NOTE: This is the MULTIPLICATIVE identity (neutral for conjunction).
    %% For "hard to discard" semantics, monoids assign #sup as default weight.
    %%
    %% FLAT-WABA: assumption is not a rule head
    %% NON-FLAT-WABA: if assumption is also a rule head, weight is computed below via rule derivation
    supported_with_weight(X,#inf) :- assumption(X), in(X), not weight(X,_), not head(_,X).

    %% Step 1: Compute weight for each rule derivation using conjunction (maximum)
    %% For rule R deriving X: take MAXIMUM weight among all body elements (bottleneck)
    %% Interpretation: Chain is only as good as its WORST (highest-cost) component
    %% IMPORTANT: Only compute weight for TRIGGERED rules (all body elements supported)
    rule_derivation_weight(R,X,W) :-
        head(R,X),
        supported(X),
        body(R,_),  % Only for rules with bodies
        triggered_by_in(R),  % Only triggered rules
        W = #max{ V,B : body(R,B), supported_with_weight(B,V) }.

    %% Handle rules with empty bodies (facts): Use #sup (additive identity for min)
    %% IMPORTANT: Use #sup (not #inf) to make empty-body derivations "invisible" in min
    %%
    %% Rationale:
    %% - Facts derive conclusions without premises
    %% - In disjunction (min), we want explicit weights to dominate
    %% - min(#sup, explicit_weight) = explicit_weight ✓
    %% - If we used #inf: min(#inf, positive_weight) = #inf ✗ (always cheapest!)
    %%
    %% Algebraic justification:
    %% - #sup is the true additive identity for min: min(x, #sup) = x
    %% - Empty-body derivations contribute no information
    %% - Explicit weights take precedence
    rule_derivation_weight(R,X,#sup) :-
        head(R,X),
        supported(X),
        not body(R,_).

    %% Step 2: Combine multiple derivations using disjunction (minimum)
    %% IMPORTANT: Use DISJUNCTION OPERATOR (⊕) to combine weights from different paths:
    %% - Multiple rule derivations are combined via ⊕
    %% - Explicit weight is another "path" to support, combined via ⊕
    %% - For Bottleneck-cost semiring: ⊕ = min (choose cheapest/lowest-cost path)
    %%
    %% SEMANTICS: Explicit weight + derived weight represent ALTERNATIVE support paths.
    %% The actual weight is their DISJUNCTION, not conjunction or override.
    %%
    %% Example: If X has explicit weight 50 and is also derived with weight 30,
    %%          then supported_with_weight(X, min(50, 30)) = supported_with_weight(X, 30)
    %%          (the cheaper path is chosen)
    supported_with_weight(X,W) :-
        supported(X),
        head(_,X),  % X is derived (not just an assumption)
        not assumption(X),  % X is not an assumption
        W = #min{ V,R : rule_derivation_weight(R,X,V) ;
                  V : weight(X,V) }.  % DISJUNCTION (⊕ = min for Bottleneck-cost)

    %% NON-FLAT-WABA: Derived assumption with explicit weight
    %% Combine rule-derived weight with explicit weight via DISJUNCTION (min)
    supported_with_weight(X,W) :-
        assumption(X),
        supported(X),
        head(_,X),  % Assumption is also derived
        weight(X,_),  % Has explicit weight
        W = #min{ V,R : rule_derivation_weight(R,X,V) ;
                  V : weight(X,V) }.  % DISJUNCTION (⊕ = min for Bottleneck-cost)

    %% NON-FLAT-WABA: Derived assumption WITHOUT explicit weight, but is IN
    %% Combine rule-derived weight with default assumption weight (#inf) via DISJUNCTION (min)
    supported_with_weight(X,W) :-
        assumption(X),
        in(X),  % Assumption is selected
        supported(X),
        head(_,X),  % Assumption is also derived
        not weight(X,_),  % No explicit weight
        W = #min{ V,R : rule_derivation_weight(R,X,V) ;
                  #inf : true }.  % DISJUNCTION with default: min(derived, #inf) = derived
    `,
            };
            return modules[semiring] || modules.godel;
        }


        getMonoidModule(monoid) {
            const modules = {
                max: `
    %% Maximum Cost Monoid for Cost Aggregation
    %% Monoid: (ℤ ∪ {±∞}, max, #inf)
    %% - Domain: All integers plus infinities
    %% - Operation: maximum
    %% - Identity: #inf (algebraic identity for max operation)
    %% - Null value: 0 (when no attacks discarded, cost = 0 by design choice)
    %%
    %% Extension cost = maximum weight among all discarded attacks
    %% This represents the "most expensive" attack that was discarded.
    %% When no attacks are discarded, we use 0 (not the identity #inf) to represent "no cost".
    %%
    %% DEFAULT WEIGHTS: Now defined in semiring files (moved from here)
    %% - Semirings assign defaults using disjunction identity
    %% - All weight assignment is now semiring responsibility
    %% - Monoids only handle cost aggregation

    %% Extension cost is the maximum discarded attack weight
    %% Only compute aggregate when discarded attacks exist
    extension_cost(C) :- discarded_attack(_,_,_), C = #max{ W, X, Y : discarded_attack(X,Y,W) }.

    %% When no attacks are discarded, cost is 0 (identity element)
    extension_cost(0) :- not discarded_attack(_,_,_).

    %% Budget constraint: Use constraint/ub.lp (Upper Bound regime)
    `,
                sum: `
    %% Sum Monoid for Cost Aggregation - OPTIMIZED
    %% Monoid: (ℤ ∪ {±∞}, +, 0)
    %% - Domain: All integers plus infinities
    %% - Operation: sum (addition)
    %% - Identity: 0 (algebraic identity for addition)
    %%
    %% Extension cost = sum of all discarded attack weights
    %% This represents the "total cost" of all discarded attacks.
    %%
    %% OPTIMIZATION NOTES:
    %% ===================
    %% Removed redundant empty-case handling:
    %% - REMOVED: discarded_attack(_,_,_) check in body
    %% - REMOVED: extension_cost(0) :- not discarded_attack(_,_,_).
    %% - Clingo naturally returns #sum{} = 0 for empty sets (algebraic identity)
    %% - Simplified from 2 rules to 1 rule
    %%
    %% Note: With multiple derivations of the same attack via different rules,
    %% each derivation contributes its weight to the sum.
    %% The tuple (W, X, Y) ensures each unique attack instance is counted.
    %%
    %% DEFAULT WEIGHTS: Now defined in semiring files (moved from here)
    %% - Semirings assign defaults using disjunction identity
    %% - All weight assignment is now semiring responsibility
    %% - Monoids only handle cost aggregation

    %% Extension cost is the sum of all discarded attack weights
    %% OPTIMIZED: Rely on natural #sum{} = 0 for empty sets
    extension_cost(C) :- C = #sum{ W, X, Y : discarded_attack(X,Y,W) }.

    %% Budget constraint: Use constraint/ub.lp (Upper Bound regime)
    `,
                min: `
    %% Minimum Cost Monoid for Cost Aggregation - OPTIMIZED
    %% Monoid: (ℤ ∪ {±∞}, min, #sup)
    %% - Domain: All integers plus infinities
    %% - Operation: minimum
    %% - Identity: #sup (algebraic identity for min operation)
    %%
    %% Extension cost = minimum weight among all discarded attacks
    %% This represents the "cheapest" attack that was discarded.
    %% When no attacks are discarded, the cost is #sup (identity for min).
    %%
    %% OPTIMIZATION NOTES:
    %% ===================
    %% Removed redundant empty-case handling:
    %% - REMOVED: discarded_attack(_,_,_) check in body
    %% - REMOVED: extension_cost(#sup) :- not discarded_attack(_,_,_).
    %% - Clingo naturally returns #min{} = #sup for empty sets (algebraic identity)
    %% - Simplified from 2 rules to 1 rule
    %%
    %% DEFAULT WEIGHTS: Now defined in semiring files (moved from here)
    %% - Semirings assign defaults using disjunction identity
    %% - All weight assignment is now semiring responsibility
    %% - Monoids only handle cost aggregation
    %%
    %% Note: MIN monoid uses LOWER BOUND regime (maximize quality threshold)
    %% - LB constraint: :- extension_cost(C), C < B, budget(B).

    %% Extension cost is the minimum discarded attack weight
    %% OPTIMIZED: Rely on natural #min{} = #sup for empty sets
    extension_cost(C) :- C = #min{ W, X, Y : discarded_attack(X,Y,W) }.

    %% Budget constraint: Use constraint/lb.lp (Lower Bound regime)
    %% Default beta=#inf is permissive (allows all extensions)
    %% Override with -c beta=N to set minimum quality threshold
    `,
                count: `
    %% WABA Monoid: Count
    %% Cost aggregation: Counts number of discarded attacks (weight-agnostic)
    %%
    %% Monoid: (ℕ ∪ {∞}, count, 0)
    %% - Domain: Natural numbers plus infinity
    %% - Operation: count (cardinality)
    %% - Identity: 0 (algebraic identity: count of empty set = 0)
    %% - Null value: #sup (when no attacks discarded, for optimization direction)
    %%
    %% Semantics:
    %%   - extension_cost = number of discarded attack pairs
    %%   - Ignores attack weights - only counts discards
    %%   - Budget limits the COUNT of discards, not total weight cost
    %%
    %% Compatible semirings: All (weight-agnostic aggregation)
    %% Budget constraint: C > B (enforce C <= B, standard cost limit)
    %% Optimization: minimize extension_cost (prefer fewer discards)

    %% DEFAULT WEIGHTS: Now defined in semiring files (moved from here)
    %% - Semirings assign defaults using disjunction identity
    %% - All weight assignment is now semiring responsibility
    %% - Monoids only handle cost aggregation
    %% - COUNT is weight-agnostic anyway (only counts, ignores weights)

    %% Count aggregation: number of discarded attacks
    %% #count of empty set = 0 (correct: zero discards has zero cost)
    extension_cost(C) :- C = #count{ X,Y : discarded_attack(X,Y,_) }.

    %% Budget constraint: Use constraint/ub.lp (Upper Bound regime)
    `,
            };
            return modules[monoid] || modules.max;
        }


        getSemanticsModule(semantics) {
            const modules = {
                stable: `
    %% conflict freeness
    :- in(X), defeated(X).

    %% stable
    :- not defeated(X), out(X).
    `,
                cf: `
    %% conflict freeness
    :- in(X), defeated(X).`,
            };
            return modules[semantics] || modules.stable;
        }

        getFilterModule() {
            return `
% Standard Output Filter
#show in/1.
#show out/1.
#show supported/1.
#show supported_with_weight/2.
#show attacks_successfully_with_weight/3.
#show discarded_attack/3.
#show extension_cost/1.
#show assumption/1.
#show contrary/2.
#show head/2.
#show body/2.
`;
        }

        getOptimizeModule(optimize) {
            const modules = {
                none: `
    % No optimization`,
                minimize: `
    #minimize{ X : extension_cost(X) }.
    `,
                maximize: `
    %% WABA Cost Maximization (for MIN+LB monoid)
    %% Maximize extension_cost (prefer higher quality discards)
    %% Use with MIN monoid where budget is a lower bound (quality threshold)

    #maximize{ X : extension_cost(X) }.
    `,
            };
            return modules[optimize] || modules.none;
        }


        getConstraintModule(constraint, budget) {
            const modules = {
                ub: `
    %% WABA Upper Bound (UB) Budget Constraint
    %% =========================================
    %%
    %% Used by: MAX, SUM, COUNT, LEX monoids
    %% Semantics: Accept extension iff extension_cost ≤ β
    %% Constraint: Reject if extension_cost > β
    %%
    %% Default: β = #sup (supremum/+∞)
    %%   - Permissive: All extensions allowed by default
    %%   - Override with -c beta=N to set cost limit
    %%
    %% Examples:
    %%   -c beta=0      # Classical ABA (no discarding allowed)
    %%   -c beta=100    # Allow discarding attacks up to total cost 100
    %%   -c beta=#sup   # Explicit permissive (same as default)
    %%   (no -c beta)   # Uses default #sup (permissive)


    budget(${budget}).

    %% Budget constraint (standard cost limit)
    %% Rejects extensions where cost exceeds budget
    %%
    %% Dual enforcement approach:
    %% 1. Check extension_cost aggregate (for monoids that compute total cost)
    %% 2. Check individual discarded attacks (for detecting #sup weights ignored by #sum)
    %%
    %% Special handling for infinities:
    %%   - #sup: Passes when used as "no discards" marker, fails when discarding #sup-weight attacks
    %%   - #inf: Always fails (invalid cost)

    %% Reject if aggregated extension cost exceeds budget (handles finite costs)
    :- extension_cost(C), C > B, budget(B), C != #sup.

    %% Reject if extension_cost is #inf (invalid)
    :- extension_cost(#inf).

    %% Reject if ANY discarded attack has weight #sup with finite budget
    %% (infinite cost attack is unaffordable unless budget is also #sup)
    %% This catches cases where #sum aggregate ignores #sup values
    :- discarded_attack(_,_,#sup), budget(B), B != #sup.
    `,
                lb: `
    %% WABA Lower Bound (LB) Budget Constraint
    %% =========================================
    %%
    %% Used by: MIN monoid
    %% Semantics: Accept extension iff extension_cost ≥ β (quality threshold)
    %% Constraint: Reject if extension_cost < β
    %%
    %% Default: β = #inf (infimum/-∞)
    %%   - Permissive: All extensions allowed by default
    %%   - Override with -c beta=N to set minimum quality threshold
    %%
    %% Note: Lower values are WORSE quality (cheaper discarded attacks)
    %%       Higher values are BETTER quality (only expensive attacks discarded)
    %%
    %% Examples:
    %%   -c beta=#inf   # Explicit permissive (same as default, -∞)
    %%   -c beta=0      # Reject if any attack with cost < 0 is discarded
    %%   -c beta=10     # Reject if min(discarded attacks) < 10
    %%   (no -c beta)   # Uses default #inf (permissive)


    budget(${budget}).

    %% Budget constraint (quality threshold)
    %% Rejects extensions where quality (min cost) is too low
    %%
    %% Dual enforcement approach (same as UB):
    %% 1. Check extension_cost aggregate (for quality threshold)
    %% 2. Check individual discarded attacks (for detecting #sup weights)
    %%
    %% Special handling for infinities:
    %%   - #sup: Passes when used as "no discards" marker (extension_cost only)
    %%           Fails when discarding #sup-weight attacks
    %%   - #inf: Worst quality, always fails

    %% Standard quality threshold check (handles finite costs)
    :- extension_cost(C), C < B, budget(B).

    %% Reject if ANY discarded attack has weight #sup
    %% For LB (quality threshold), discarding #sup-weight attacks always fails
    %% because it's impossible to distinguish from "no discards" (both give cost #sup)
    %% This prevents extensions with discards from passing as "best quality"
    :- discarded_attack(_,_,#sup).
    `,
                none: `
    % No budget constraint
    `
            };
            return modules[constraint] || modules.ub;
        }


        getFlatModule() {
            return `
    %% Flat-WABA Constraint
    %% =====================
    %%
    %% Enforces the flat-WABA restriction: assumptions can ONLY appear in rule bodies,
    %% never as rule heads. This ensures assumptions are "atomic" - they are not derivable
    %% from other assumptions or rules.
    %%
    %% FLAT-WABA:
    %% - Assumptions are the base level of argumentation
    %% - Only non-assumption atoms can be derived via rules
    %% - Simpler semantics: no circularity, no assumption hierarchies
    %% - Every assumption is either chosen (in) or rejected (out) independently
    %%
    %% NON-FLAT-WABA (without this constraint):
    %% - Assumptions can appear as rule heads
    %% - Assumptions can be derived from other assumptions
    %% - More expressive: allows assumption hierarchies
    %% - More complex semantics: derived assumptions have combined weights
    %%
    %% USAGE:
    %% Load this file to enforce flat-WABA:
    %%   clingo ... constraint/flat.lp ...
    %%
    %% Omit this file to allow non-flat-WABA (default).

    %% CONSTRAINT: Reject if any assumption appears as a rule head
    :- assumption(X), head(_,X).

    %% This ensures that in flat-WABA:
    %% 1. Assumptions are only selected via in/out choice
    %% 2. Assumptions have no derivation path from rules
    %% 3. Weight propagation only flows TO assumptions (via attacks), never FROM them via rules
    %% 4. No circularity: assumption hierarchies are impossible
    `;
        }

    extractCost(predicates) {
        // Extract extension_cost from predicates array
        for (const pred of predicates) {
            const costMatch = pred.match(/^extension_cost\(([^)]+)\)$/);
            if (costMatch && costMatch[1] !== '#inf') {
                const cost = costMatch[1];
                // Handle #sup as infinity for sorting
                if (cost === '#sup') return Infinity;
                // Parse numeric cost
                return parseFloat(cost) || 0;
            }
        }
        // Default to 0 if no cost found
        return 0;
    }

    displayResults(result, elapsed) {
        // Handle clingo-wasm object format
        const witnesses = result.Call?.[0]?.Witnesses || [];
        const isSuccessful = result.Result === 'SATISFIABLE' ||
                            result.Result === 'OPTIMUM FOUND';

        // Debug logging
        console.log('Result:', result.Result);
        console.log('Witnesses count:', witnesses.length);
        console.log('All witnesses:', witnesses);

        this.log(`\n${result.Result}`, 'info');

        if (!isSuccessful || witnesses.length === 0) {
            this.log('⚠️ No extensions found', 'warning');
            this.log('Try adjusting the budget or framework constraints', 'info');
        } else {
            // Sort witnesses by cost (ascending order)
            const sortedWitnesses = witnesses.slice().sort((a, b) => {
                const costA = this.extractCost(a.Value || []);
                const costB = this.extractCost(b.Value || []);
                return costA - costB;
            });

            // Display all witnesses in sorted order
            console.log('Displaying witnesses...');
            sortedWitnesses.forEach((witness, index) => {
                console.log(`Processing witness ${index + 1}:`, witness);
                this.appendAnswerSet(witness, index + 1);
            });

            if (result.Result === 'OPTIMUM FOUND') {
                this.log(`\n✓ Found ${witnesses.length} optimal extension(s)`, 'success');
            }
        }

        // Display statistics
        this.stats.innerHTML = `
            <strong>Execution Stats:</strong>
            ${witnesses.length} extension(s) found |
            Computed in ${elapsed}s |
            Semiring: ${this.semiringSelect.options[this.semiringSelect.selectedIndex].text} |
            Monoid: ${this.monoidSelect.options[this.monoidSelect.selectedIndex].text}
        `;
    }

    findSupportingAssumptions(element, parsed) {
        // If element is an assumption in the extension, return it
        if (parsed.in.includes(element)) {
            return [element];
        }

        // Find the rule that derives this element
        for (const [ruleId, rule] of parsed.rules.entries()) {
            if (rule.head === element) {
                // Found the rule, recursively find assumptions supporting the body
                const assumptions = new Set();
                for (const bodyElement of rule.body) {
                    const supporting = this.findSupportingAssumptions(bodyElement, parsed);
                    supporting.forEach(a => assumptions.add(a));
                }
                return Array.from(assumptions).sort();
            }
        }

        // Not derived from any rule (fact with empty body)
        return [];
    }

    appendAnswerSet(witness, answerNumber) {
        // witness is an object with Time and Value properties
        // Value is an array of predicate strings
        const predicates = witness.Value || [];

        // Parse the predicates
        const parsed = this.parseAnswerSet(predicates);

        const answerDiv = document.createElement('div');
        answerDiv.className = 'answer-set';

        // Build HTML with chips/badges
        let contentHTML = '<div class="answer-content">';

        // Assumptions with chips
        if (parsed.in.length > 0 || parsed.out.length > 0) {
            contentHTML += '<div class="assumption-section">';
            contentHTML += '<span class="section-label">Assumptions:</span>';

            // In assumptions (green chips)
            parsed.in.forEach(a => {
                contentHTML += `<span class="chip in"><span class="chip-icon">✓</span>${a}</span>`;
            });

            // Out assumptions (greyed out chips)
            parsed.out.forEach(a => {
                contentHTML += `<span class="chip out"><span class="chip-icon">✗</span>${a}</span>`;
            });

            contentHTML += '</div>';
        }

        // Successful attacks
        if (parsed.successful.length > 0) {
            contentHTML += '<div class="assumption-section">';
            contentHTML += '<span class="section-label">Active Attacks:</span>';
            contentHTML += '<div class="attacks-list">';
            parsed.successful.forEach(attack => {
                const match = attack.match(/attacks_successfully_with_weight\(([^,]+),\s*([^,]+),\s*([^)]+)\)/);
                if (match) {
                    const [, attackingElement, targetAssumption, weight] = match;

                    // Find assumptions that support the attacking element (contrary)
                    const supportingAssumptions = this.findSupportingAssumptions(attackingElement, parsed);

                    // Format as "a1, a2, ..., an ⊢ c [target]"
                    if (supportingAssumptions.length > 0) {
                        const assumptions = supportingAssumptions.join(', ');
                        contentHTML += `<div class="attack-item">${assumptions} <span class="attack-arrow">⊢</span> ${attackingElement} <span style="color: var(--text-muted); font-size: 0.9em;">[${targetAssumption}]</span></div>`;
                    } else {
                        // Non-derived attack (no supporting assumptions)
                        contentHTML += `<div class="attack-item">⊤ <span class="attack-arrow">⊢</span> ${attackingElement} <span style="color: var(--text-muted); font-size: 0.9em;">[${targetAssumption}]</span></div>`;
                    }
                }
            });
            contentHTML += '</div></div>';
        }

        // Discarded attacks
        if (parsed.discarded.length > 0) {
            contentHTML += '<div class="assumption-section">';
            contentHTML += '<span class="section-label">Discarded Attacks:</span>';
            contentHTML += '<div class="attacks-list">';
            parsed.discarded.forEach(attack => {
                const match = attack.match(/discarded_attack\(([^,]+),\s*([^,]+),\s*([^)]+)\)/);
                if (match) {
                    const [, attackingElement, targetAssumption, weight] = match;

                    // Find assumptions that support the attacking element (contrary)
                    const supportingAssumptions = this.findSupportingAssumptions(attackingElement, parsed);

                    // Format as "a1, a2, ..., an ⊬ c [target] (w: weight)"
                    if (supportingAssumptions.length > 0) {
                        const assumptions = supportingAssumptions.join(', ');
                        contentHTML += `<div class="attack-item discarded">${assumptions} <span class="attack-arrow">⊬</span> ${attackingElement} <span style="color: var(--text-muted); font-size: 0.9em;">[${targetAssumption}]</span> <span style="color: var(--text-muted)">(w: ${weight})</span></div>`;
                    } else {
                        // Non-derived attack (no supporting assumptions)
                        contentHTML += `<div class="attack-item discarded">⊤ <span class="attack-arrow">⊬</span> ${attackingElement} <span style="color: var(--text-muted); font-size: 0.9em;">[${targetAssumption}]</span> <span style="color: var(--text-muted)">(w: ${weight})</span></div>`;
                    }
                }
            });
            contentHTML += '</div></div>';
        }

        // Derived atoms (non-assumption supported atoms)
        if (parsed.derived && parsed.derived.length > 0) {
            contentHTML += '<div class="assumption-section">';
            contentHTML += '<span class="section-label">Derived Atoms:</span>';
            contentHTML += '<div style="display: flex; flex-wrap: wrap; gap: 6px;">';
            parsed.derived.forEach(atom => {
                const weight = parsed.weights.get(atom);
                const weightDisplay = weight !== undefined ? ` <span style="color: var(--warning-color); font-size: 0.85em;">(w: ${weight})</span>` : '';
                const atomId = `derived-${answerNumber}-${atom.replace(/[^a-zA-Z0-9]/g, '_')}`;
                contentHTML += `<span class="chip" style="background: var(--info-color); border-color: var(--info-color); cursor: pointer;" id="${atomId}" data-atom="${atom}" data-extension="${answerNumber}">${atom}${weightDisplay}</span>`;
            });
            contentHTML += '</div></div>';
        }

        // Active contraries (contrary atoms that are supported)
        if (parsed.activeContraries && parsed.activeContraries.length > 0) {
            contentHTML += '<div class="assumption-section">';
            contentHTML += '<span class="section-label">Active Contraries:</span>';
            contentHTML += '<div class="contraries-list" style="display: flex; flex-direction: column; gap: 4px;">';
            parsed.activeContraries.forEach(({ assumption, contrary }) => {
                const isDefeated = !parsed.in.includes(assumption);
                contentHTML += `<div style="font-family: monospace; font-size: 0.9em;">`;
                contentHTML += `<span style="color: var(--warning-color)">${contrary}</span> `;
                contentHTML += `<span style="color: var(--text-muted)">attacks</span> `;
                contentHTML += `<span style="color: ${isDefeated ? 'var(--error-color)' : 'var(--success-color)'}">${assumption}</span>`;
                contentHTML += isDefeated ? ' <span style="color: var(--error-color)">✗</span>' : '';
                contentHTML += `</div>`;
            });
            contentHTML += '</div></div>';
        }

        contentHTML += '</div>';

        answerDiv.innerHTML = `
            <div class="answer-header clickable-extension" data-extension-id="${answerNumber}">
                <span class="answer-number">Extension ${answerNumber}</span>
                ${parsed.cost !== null ? `<span class="extension-cost-badge">💰 Cost: ${parsed.cost}</span>` : ''}
                <span class="click-hint" style="font-size: 0.85em; color: var(--text-muted); margin-left: 10px;">👆 Click to highlight</span>
            </div>
            ${contentHTML}
        `;

        // Store extension data for highlighting
        const extensionData = {
            inAssumptions: parsed.in,
            discardedAttacks: parsed.discarded.map(attack => {
                const match = attack.match(/discarded_attack\(([^,]+),\s*([^,]+),\s*([^)]+)\)/);
                if (match) {
                    const [, from, to, weight] = match;
                    // Map to the format needed for filtering
                    return {
                        source: from,
                        target: to,
                        via: to, // The attacked assumption
                        weight: weight
                    };
                }
                return null;
            }).filter(a => a !== null),
            successfulAttacks: parsed.successful // Add successful attacks for highlighting
        };

        // Add click handler to highlight this extension
        const header = answerDiv.querySelector('.answer-header');
        header.addEventListener('click', () => {
            // Remove previous highlights
            document.querySelectorAll('.answer-header').forEach(h => {
                h.classList.remove('active-extension');
            });

            // Reset previous highlighting first
            this.resetGraphColors();

            // Add highlight to this extension
            header.classList.add('active-extension');

            // Highlight in graph
            this.highlightExtension(extensionData.inAssumptions, extensionData.discardedAttacks, extensionData.successfulAttacks);
        });

        // Add double-click to reset
        header.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.answer-header').forEach(h => {
                h.classList.remove('active-extension');
            });
            this.resetGraphColors();
        });

        // Add click handlers for derived atoms to show derivation chain
        parsed.derived.forEach(atom => {
            const atomId = `derived-${answerNumber}-${atom.replace(/[^a-zA-Z0-9]/g, '_')}`;
            const atomEl = answerDiv.querySelector(`#${atomId}`);
            if (atomEl) {
                atomEl.addEventListener('click', () => {
                    this.showDerivationChain(atom, parsed, atomEl);
                });
            }
        });

        this.output.appendChild(answerDiv);
    }

    parseAnswerSet(predicates) {
        const result = {
            in: [],
            out: [],
            cost: null,
            discarded: [],
            successful: [],
            supported: [],
            assumptions: new Set(),
            contraries: new Map(),  // Map from assumption to contrary
            weights: new Map(),  // Map from atom to weight
            rules: new Map()  // Map from rule ID to {head, body[]}
        };

        // First pass: collect assumptions, contraries, and rules
        predicates.forEach(pred => {
            const assumptionMatch = pred.match(/^assumption\(([^)]+)\)$/);
            if (assumptionMatch) {
                result.assumptions.add(assumptionMatch[1]);
                return;
            }

            const contraryMatch = pred.match(/^contrary\(([^,]+),\s*([^)]+)\)$/);
            if (contraryMatch) {
                result.contraries.set(contraryMatch[1], contraryMatch[2]);
                return;
            }

            const headMatch = pred.match(/^head\(([^,]+),\s*([^)]+)\)$/);
            if (headMatch) {
                const ruleId = headMatch[1];
                const head = headMatch[2];
                if (!result.rules.has(ruleId)) {
                    result.rules.set(ruleId, { head, body: [] });
                } else {
                    result.rules.get(ruleId).head = head;
                }
                return;
            }

            const bodyMatch = pred.match(/^body\(([^,]+),\s*([^)]+)\)$/);
            if (bodyMatch) {
                const ruleId = bodyMatch[1];
                const bodyAtom = bodyMatch[2];
                if (!result.rules.has(ruleId)) {
                    result.rules.set(ruleId, { head: null, body: [bodyAtom] });
                } else {
                    result.rules.get(ruleId).body.push(bodyAtom);
                }
                return;
            }
        });

        // Second pass: collect everything else
        predicates.forEach(pred => {
            // Extract in() predicates
            const inMatch = pred.match(/^in\(([^)]+)\)$/);
            if (inMatch) {
                result.in.push(inMatch[1]);
                return;
            }

            // Extract out() predicates
            const outMatch = pred.match(/^out\(([^)]+)\)$/);
            if (outMatch) {
                result.out.push(outMatch[1]);
                return;
            }

            // Extract supported atoms
            const supportedMatch = pred.match(/^supported\(([^)]+)\)$/);
            if (supportedMatch) {
                result.supported.push(supportedMatch[1]);
                return;
            }

            // Extract supported_with_weight predicates
            const weightMatch = pred.match(/^supported_with_weight\(([^,]+),\s*([^)]+)\)$/);
            if (weightMatch) {
                const atom = weightMatch[1];
                const weight = weightMatch[2];
                result.weights.set(atom, weight);
                return;
            }

            // Extract extension_cost (prefer numeric values, skip #inf)
            const costMatch = pred.match(/^extension_cost\(([^)]+)\)$/);
            if (costMatch && costMatch[1] !== '#inf') {
                result.cost = costMatch[1];
                return;
            }

            // Extract discarded attacks
            if (pred.startsWith('discarded_attack(')) {
                result.discarded.push(pred);
                return;
            }

            // Extract successful attacks
            if (pred.startsWith('attacks_successfully_with_weight(')) {
                result.successful.push(pred);
                return;
            }
        });

        // Compute derived atoms (supported but not assumptions)
        result.derived = result.supported.filter(atom => !result.assumptions.has(atom));

        // Compute active contraries (contrary atoms that are supported)
        result.activeContraries = [];
        result.contraries.forEach((contrary, assumption) => {
            if (result.supported.includes(contrary)) {
                result.activeContraries.push({ assumption, contrary });
            }
        });

        return result;
    }

    log(message, type = 'info') {
        const msgDiv = document.createElement('div');
        msgDiv.className = type === 'error' ? 'error-message' :
                          type === 'warning' ? 'info-message' :
                          type === 'success' ? 'info-message' :
                          'info-message';
        msgDiv.textContent = message;
        this.output.appendChild(msgDiv);
        this.output.scrollTop = this.output.scrollHeight;
    }

    clearOutput() {
        this.output.innerHTML = '';
        this.stats.innerHTML = '';
        // Show output empty state after clearing
        if (window.showOutputEmptyState) {
            window.showOutputEmptyState();
        }
        // Note: Don't clear isolatedNodes here - they're populated by updateGraph()
        // and needed for displayResults()
    }
}

// Initialize the playground when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.playground = new WABAPlayground();

    // ===================================
    // Graph Legend Toggle
    // ===================================
    const legendToggleBtn = document.getElementById('legend-toggle-btn');
    const graphLegend = document.getElementById('graph-legend');

    if (legendToggleBtn && graphLegend) {
        legendToggleBtn.addEventListener('click', () => {
            const isHidden = graphLegend.hasAttribute('hidden');
            if (isHidden) {
                graphLegend.removeAttribute('hidden');
                legendToggleBtn.setAttribute('aria-expanded', 'true');
            } else {
                graphLegend.setAttribute('hidden', '');
                legendToggleBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // ===================================
    // Graph Export (PNG & PDF)
    // ===================================
    const exportPngBtn = document.getElementById('export-png-btn');
    const exportPdfBtn = document.getElementById('export-pdf-btn');

    // Export as high-resolution PNG (300 DPI)
    if (exportPngBtn) {
        exportPngBtn.addEventListener('click', () => {
            if (!window.playground || !window.playground.network) {
                alert('No graph to export. Please run WABA first.');
                return;
            }

            try {
                // Get the canvas from vis.js network
                const canvas = window.playground.network.canvas.frame.canvas;

                // Calculate scale factor for 300 DPI (standard is 96 DPI)
                // 300/96 = 3.125x scale
                const scaleFactor = 3.125;

                // Create high-resolution canvas
                const highResCanvas = document.createElement('canvas');
                const ctx = highResCanvas.getContext('2d');

                highResCanvas.width = canvas.width * scaleFactor;
                highResCanvas.height = canvas.height * scaleFactor;

                // Scale context and draw
                ctx.scale(scaleFactor, scaleFactor);
                ctx.drawImage(canvas, 0, 0);

                // Generate filename with timestamp
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                const filename = `waba-graph-${timestamp}.png`;

                // Convert to blob and download
                highResCanvas.toBlob((blob) => {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = filename;
                    link.click();
                    URL.revokeObjectURL(url);
                }, 'image/png');

                console.log(`Exported graph as PNG (300 DPI): ${filename}`);
            } catch (error) {
                console.error('Error exporting PNG:', error);
                alert('Failed to export PNG. Please try again.');
            }
        });
    }

    // Export as PDF
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', () => {
            if (!window.playground || !window.playground.network) {
                alert('No graph to export. Please run WABA first.');
                return;
            }

            try {
                // Get the canvas from vis.js network
                const canvas = window.playground.network.canvas.frame.canvas;

                // Convert canvas to data URL
                const imgData = canvas.toDataURL('image/png');

                // Calculate PDF dimensions (A4 landscape, preserving aspect ratio)
                const imgWidth = canvas.width;
                const imgHeight = canvas.height;
                const aspectRatio = imgWidth / imgHeight;

                // A4 landscape dimensions in mm
                const pdfWidth = 297;
                const pdfHeight = 210;

                let finalWidth, finalHeight;
                if (aspectRatio > pdfWidth / pdfHeight) {
                    // Image is wider - fit to width
                    finalWidth = pdfWidth - 20; // 10mm margins
                    finalHeight = finalWidth / aspectRatio;
                } else {
                    // Image is taller - fit to height
                    finalHeight = pdfHeight - 20; // 10mm margins
                    finalWidth = finalHeight * aspectRatio;
                }

                // Center the image
                const xOffset = (pdfWidth - finalWidth) / 2;
                const yOffset = (pdfHeight - finalHeight) / 2;

                // Create PDF using jsPDF
                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF({
                    orientation: 'landscape',
                    unit: 'mm',
                    format: 'a4'
                });

                // Add title
                pdf.setFontSize(16);
                pdf.text('WABA Argumentation Graph', pdfWidth / 2, 10, { align: 'center' });

                // Add graph image
                pdf.addImage(imgData, 'PNG', xOffset, yOffset, finalWidth, finalHeight);

                // Add footer with timestamp
                pdf.setFontSize(8);
                const timestamp = new Date().toLocaleString();
                pdf.text(`Generated: ${timestamp}`, 10, pdfHeight - 5);
                pdf.text('WABA Playground', pdfWidth - 10, pdfHeight - 5, { align: 'right' });

                // Generate filename with timestamp
                const filenameTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                const filename = `waba-graph-${filenameTimestamp}.pdf`;

                // Save PDF
                pdf.save(filename);

                console.log(`Exported graph as PDF: ${filename}`);
            } catch (error) {
                console.error('Error exporting PDF:', error);
                alert('Failed to export PDF. Please try again.');
            }
        });
    }

    // ===================================
    // Loading Overlay Management
    // ===================================
    window.showLoadingOverlay = (text = 'Running WABA...', subtext = 'Computing extensions and visualizing results') => {
        const overlay = document.getElementById('loading-overlay');
        const loadingText = document.getElementById('loading-text');
        const loadingSubtext = document.getElementById('loading-subtext');

        if (overlay) {
            if (loadingText) loadingText.textContent = text;
            if (loadingSubtext) loadingSubtext.textContent = subtext;
            overlay.removeAttribute('hidden');
        }
    };

    window.hideLoadingOverlay = () => {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.setAttribute('hidden', '');
        }
    };

    // ===================================
    // Empty State Management
    // ===================================
    window.showGraphEmptyState = () => {
        const emptyState = document.getElementById('graph-empty-state');
        const canvas = document.getElementById('cy');
        if (emptyState) emptyState.removeAttribute('hidden');
        if (canvas) canvas.style.opacity = '0.3';
    };

    window.hideGraphEmptyState = () => {
        const emptyState = document.getElementById('graph-empty-state');
        const canvas = document.getElementById('cy');
        if (emptyState) emptyState.setAttribute('hidden', '');
        if (canvas) canvas.style.opacity = '1';
    };

    window.showOutputEmptyState = () => {
        const emptyState = document.getElementById('output-empty-state');
        if (emptyState) emptyState.removeAttribute('hidden');
    };

    window.hideOutputEmptyState = () => {
        const emptyState = document.getElementById('output-empty-state');
        if (emptyState) emptyState.setAttribute('hidden', '');
    };

    // Show empty states initially
    showGraphEmptyState();
    showOutputEmptyState();
});
