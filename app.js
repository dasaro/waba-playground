// WABA Playground - Modular Application (ES6)
// VERSION: 20260101-11 - Update on every deployment (format: YYYYMMDD-N)

import { ThemeManager } from './modules/theme-manager.js?v=20260101-1';
import { FontManager } from './modules/font-manager.js?v=20260101-1';
import { UIManager } from './modules/ui-manager.js?v=20260101-8';
import { PanelManager } from './modules/panel-manager.js?v=20260101-8';
import { FileManager } from './modules/file-manager.js?v=20260101-1';
import { ParserUtils } from './modules/parser-utils.js?v=20260101-1';
import { GraphUtils} from './modules/graph-utils.js?v=20260101-1';
import { GraphManager } from './modules/graph-manager.js?v=20260101-1';
import { PopupManager } from './modules/popup-manager.js?v=20260101-1';
import { ClingoManager } from './modules/clingo-manager.js?v=20260101-1';
import { OutputManager } from './modules/output-manager.js?v=20260101-1';
import { ExportManager } from './modules/export-manager.js?v=20260101-1';
import { examples } from './examples.js?v=20260101-1';

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
        this.resetLayoutBtn = document.getElementById('reset-layout-btn');

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
            this.syntaxGuideClose
        );

        // Initialize Panel Manager
        this.panelManager = new PanelManager();
        this.panelManager.registerPanel('config', true);
        this.panelManager.registerPanel('editor', true);
        this.panelManager.registerPanel('graph', true);
        this.panelManager.registerPanel('output', true);

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

        // Initialize Export Manager
        this.exportManager = new ExportManager(
            this.graphManager,
            this.exportPngBtn,
            this.exportPdfBtn,
            this  // Pass app instance for exportGraphInLightMode
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
            radio.addEventListener('change', () => {
                // Clear active extension when switching graph modes (different structures)
                this.outputManager.clearActiveExtension();
                this.graphManager.resetGraphColors();
                this.regenerateGraph();
            });
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

        // Documentation tabs
        document.querySelectorAll('.doc-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const targetTab = e.target.dataset.tab;
                this.switchDocTab(targetTab);
            });
        });

        // Download buttons
        this.downloadLpBtn.addEventListener('click', () => this.downloadAsLp());
        this.downloadWabaBtn.addEventListener('click', () => this.downloadAsWaba());

        // Legend toggle button
        this.legendToggleBtn.addEventListener('click', () => this.toggleLegend());

        // Panel toggle buttons
        document.querySelectorAll('.panel-toggle').forEach(button => {
            button.addEventListener('click', (e) => {
                const panel = e.target.closest('.panel');
                const panelId = panel.dataset.panel;
                this.panelManager.togglePanel(panelId);
            });
        });

        // Export buttons (handled by ExportManager)
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

    switchDocTab(targetTab) {
        // Remove active class from all tabs and content
        document.querySelectorAll('.doc-tab').forEach(tab => {
            tab.classList.remove('active');
            tab.setAttribute('aria-selected', 'false');
        });
        document.querySelectorAll('.doc-tab-content').forEach(content => {
            content.classList.remove('active');
            content.setAttribute('hidden', '');
        });

        // Add active class to target tab and content
        const targetTabBtn = document.querySelector(`[data-tab="${targetTab}"]`);
        const targetContent = document.getElementById(`tab-${targetTab}`);

        if (targetTabBtn && targetContent) {
            targetTabBtn.classList.add('active');
            targetTabBtn.setAttribute('aria-selected', 'true');
            targetContent.classList.add('active');
            targetContent.removeAttribute('hidden');
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
                try {
                    callback();
                } catch (error) {
                    console.error('Export failed:', error);
                    alert('Export failed. Please try again.');
                } finally {
                    // Restore original theme even if export failed
                    setTimeout(() => {
                        document.documentElement.setAttribute('data-theme', currentTheme || 'dark');
                        this.themeManager.updateGraphTheme();
                    }, 100);
                }
            }, 200);
        } else {
            // Already in light mode
            try {
                callback();
            } catch (error) {
                console.error('Export failed:', error);
                alert('Export failed. Please try again.');
            }
        }
    }

    // ===================================
    // Export Methods (Moved to ExportManager)
    // ===================================
    // addWatermark(), exportGraphAsPng(), exportGraphAsPdf() now in modules/export-manager.js

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
        // Store currently highlighted extension (if any)
        const activeExtension = this.outputManager.getActiveExtensionData();

        let framework;
        if (this.inputMode.value === 'simple') {
            framework = this.parseSimpleABA();
        } else {
            framework = this.editor.value.trim();
        }

        if (framework) {
            await this.updateGraph(framework);

            // Restore highlighted extension after graph update
            if (activeExtension) {
                setTimeout(() => {
                    // Verify header element exists before restoring
                    const header = this.output.querySelector(`.answer-header[data-extension-id="${activeExtension}"]`);
                    if (header) {
                        this.outputManager.restoreActiveExtension();
                    } else {
                        console.error('Could not restore extension - header not found:', activeExtension);
                    }
                }, 500);  // Increased delay to allow graph to fully render
            }
        }
    }

    async updateGraph(frameworkCode) {
        // Get selected graph mode
        const selectedMode = Array.from(this.graphModeRadios).find(r => r.checked);
        const mode = selectedMode ? selectedMode.value : 'standard';

        // Store current framework and mode for popups
        this.currentFrameworkCode = frameworkCode;
        this.currentGraphMode = mode;

        // Delegate to GraphManager
        await this.graphManager.updateGraph(frameworkCode, mode, this.clingoManager);
    }

    // Note: Graph update methods have been moved to GraphManager class in modules/graph-manager.js
    // Methods: updateGraph, updateGraphStandard, updateGraphAssumptionLevelDirect, updateGraphAssumptionLevelBranching


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
