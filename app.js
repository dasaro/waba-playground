// WABA Playground - Modular Application (ES6)
// VERSION: 20260104-10 - Update on every deployment (format: YYYYMMDD-N)

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
import { MetricsManager } from './modules/metrics-manager.js?v=20260102-1';
import { PrismEditor } from './modules/prism-editor.js?v=20260104-1';
import { examples } from './examples.js?v=20260105-1';

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
        this.timeoutInput = document.getElementById('timeout-input');
        this.optimizeSelect = document.getElementById('optimize-select');
        this.optModeSelect = document.getElementById('opt-mode-select');
        this.constraintSelect = document.getElementById('constraint-select');
        this.polaritySelect = document.getElementById('polarity-select');
        this.polarityDisplay = document.getElementById('polarity-display');
        this.comparatorSelect = document.getElementById('comparator-select');
        this.comparatorDisplay = document.getElementById('comparator-display');
        this.graphModeRadios = document.querySelectorAll('input[name="graph-mode"]');

        // Simple ABA mode elements
        this.inputMode = document.getElementById('input-mode');
        this.simpleMode = document.getElementById('simple-mode');
        this.rulesInput = document.getElementById('rules-input');
        this.assumptionsInput = document.getElementById('assumptions-input');
        this.contrariesInput = document.getElementById('contraries-input');
        this.weightsInput = document.getElementById('weights-input');

        // Store original .waba file content (with all comments)
        this.originalWabaContent = null;

        // File upload elements
        this.fileUploadBtn = document.getElementById('file-upload-btn');
        this.fileUploadInput = document.getElementById('file-upload-input');

        // Graph visualization elements
        this.graphCanvas = document.getElementById('cy');
        this.resetLayoutBtn = document.getElementById('reset-layout-btn');
        this.fullscreenBtn = document.getElementById('fullscreen-btn');
        this.graphPanel = document.querySelector('.graph-panel');

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
        this.graphManager = new GraphManager(this.graphCanvas, this.resetLayoutBtn, this.fullscreenBtn);
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
        this.panelManager.registerPanel('analysis', true);

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
            this.optimizeSelect,
            this.polaritySelect
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

        // Initialize Prism editors for Simple Mode (syntax highlighting)
        this.initPrismEditors();

        // Run metrics unit tests (silent in production)
        MetricsManager.runUnitTest();

        // Initialize Clingo
        await this.clingoManager.initClingo();

        // Initialize graph
        this.graphManager.initGraph();
        // Share network references
        this.network = this.graphManager.network;
        this.networkData = this.graphManager.networkData;

        // Initialize fullscreen functionality
        this.graphManager.initFullscreen(this.graphPanel);

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

        // Initialize polarity/comparator inference
        this.initPolarityInference();

        // Initialize budget and num models UI states
        this.updateBudgetInputState();
        this.updateNumModelsVisibility();

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
                (msg, type) => this.outputManager.log(msg, type),
                () => this.clearPreviousRun(),
                (content) => this.originalWabaContent = content,
                (filename) => this.updateExampleSelectWithFilename(filename)
            );
        });

        // Drag and drop file upload
        this.initDragAndDrop();

        // Graph mode changes
        this.semiringSelect.addEventListener('change', () => {
            this.updatePolarityFromSemiring();
            this.regenerateGraph();
        });
        this.semanticsSelect.addEventListener('change', () => this.regenerateGraph());
        this.graphModeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                // Clear active extension when switching graph modes (different structures)
                this.outputManager.clearActiveExtension();
                this.graphManager.resetGraphColors();
                this.regenerateGraph();
            });
        });

        // Polarity/Comparator are always auto-inferred (no advanced mode)

        // Handle constraint changes (enable/disable budget input + update comparator display)
        this.constraintSelect.addEventListener('change', () => {
            this.updateBudgetInputState();
            this.updatePolarityFromSemiring(); // Update comparator display
        });

        // Handle opt mode changes (show/hide num models input)
        this.optModeSelect.addEventListener('change', () => this.updateNumModelsVisibility());

        // Handle optimization direction changes (show warning if contradicts polarity)
        this.optimizeSelect.addEventListener('change', () => this.updateOptDirectionWarning());

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

    initDragAndDrop() {
        let dragCounter = 0; // Track enter/leave events

        // Prevent default drag behaviors on the whole document
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        // Add visual feedback when dragging over
        document.addEventListener('dragenter', (e) => {
            dragCounter++;
            if (dragCounter === 1) {
                document.body.classList.add('drag-over');
            }
        });

        document.addEventListener('dragleave', (e) => {
            dragCounter--;
            if (dragCounter === 0) {
                document.body.classList.remove('drag-over');
            }
        });

        // Handle dropped files
        document.addEventListener('drop', (e) => {
            dragCounter = 0;
            document.body.classList.remove('drag-over');

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];

                // Create a synthetic event for the file manager
                const syntheticEvent = {
                    target: {
                        files: [file]
                    }
                };

                // Use existing file upload handler
                this.fileManager.handleFileUpload(
                    syntheticEvent,
                    (code) => this.updateGraph(code),
                    () => this.parseSimpleABA(),
                    (msg, type) => this.outputManager.log(msg, type),
                    () => this.clearPreviousRun(),
                    (content) => this.originalWabaContent = content,
                    (filename) => this.updateExampleSelectWithFilename(filename)
                );
            }
        });
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
            const optDirection = this.optimizeSelect.value; // 'minimize' or 'maximize'
            const config = {
                semiring: this.semiringSelect.value,
                monoid: this.monoidSelect.value,
                direction: optDirection === 'maximize' ? 'maximization' : 'minimization',
                semantics: this.semanticsSelect.value,
                constraint: this.constraintSelect.value,
                budget: parseInt(this.budgetInput.value) || 0,
                numModels: parseInt(this.numModelsInput.value) || 0,
                timeout: (parseInt(this.timeoutInput.value) || 60) * 1000, // Convert seconds to milliseconds
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

    clearPreviousRun() {
        // Clear all information from previous WABA run when loading new file
        this.outputManager.clearPreviousRun(() => {
            this.graphManager.resetGraphColors();
        });
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
                // Switching to Simple mode
                this.simpleMode.style.display = 'block';
                this.editor.style.display = 'none';

                // Parse Advanced editor content and populate Simple mode fields
                const advancedCode = this.editor.value.trim();
                if (advancedCode) {
                    // Convert .lp format to .waba and populate Simple mode
                    const wabaContent = this.fileManager.convertLpToWaba(advancedCode);
                    const parsed = this.fileManager.parseWabaFile(wabaContent);

                    // Populate Simple mode fields
                    this.assumptionsInput.value = parsed.assumptions.join('\n');
                    this.rulesInput.value = parsed.rules.join('\n');
                    this.contrariesInput.value = parsed.contraries.join('\n');
                    this.weightsInput.value = parsed.weights.join('\n');

                    // Update description if present
                    const descriptionContent = document.getElementById('simple-description-content');
                    if (descriptionContent && parsed.description && parsed.description.length > 0) {
                        descriptionContent.value = parsed.description.join('\n');
                    }
                }

                this.updateSimpleDescription();
            } else {
                // Switching to Advanced mode
                this.simpleMode.style.display = 'none';
                this.editor.style.display = 'block';

                // Populate editor with original .waba content (if available) or generate from Simple Mode
                if (this.originalWabaContent) {
                    // Use original .waba content with all comments preserved
                    this.editor.value = this.originalWabaContent;
                } else {
                    // Generate ASP code from Simple Mode fields
                    const aspCode = this.parseSimpleABA();
                    this.editor.value = aspCode;
                }
            }
        });

        // Update graph and description when simple mode inputs change
        [this.assumptionsInput, this.rulesInput, this.contrariesInput, this.weightsInput].forEach(input => {
            input.addEventListener('input', () => {
                if (this.inputMode.value === 'simple') {
                    // Clear original .waba content when user edits Simple Mode fields
                    // (their edits should be used when switching to Advanced mode)
                    this.originalWabaContent = null;
                    this.updateSimpleDescription();
                    this.regenerateGraph();
                }
            });
        });

        // Add Description button
        const addCommentBtn = document.getElementById('simple-add-comment-btn');
        if (addCommentBtn) {
            addCommentBtn.addEventListener('click', () => this.addDescriptionTemplate());
        }

        // Remove Description button
        const removeDescriptionBtn = document.getElementById('simple-remove-description-btn');
        if (removeDescriptionBtn) {
            removeDescriptionBtn.addEventListener('click', () => this.removeDescription());
        }

        // Regenerate graph when description changes
        const descriptionContent = document.getElementById('simple-description-content');
        if (descriptionContent) {
            descriptionContent.addEventListener('input', () => {
                if (this.inputMode.value === 'simple') {
                    this.regenerateGraph();
                }
            });
        }

        // Initial state
        if (this.inputMode.value === 'simple') {
            this.simpleMode.style.display = 'block';
            this.editor.style.display = 'none';
            this.updateSimpleDescription();
        } else {
            this.simpleMode.style.display = 'none';
            this.editor.style.display = 'block';
        }
    }

    initPrismEditors() {
        // Initialize Prism syntax highlighting for Simple Mode textareas
        // Replace textareas with contenteditable elements that support syntax highlighting

        // Store original textarea references
        const originalAssumptions = this.assumptionsInput;
        const originalRules = this.rulesInput;
        const originalContraries = this.contrariesInput;
        const originalWeights = this.weightsInput;

        // Create PrismEditor instances
        this.assumptionsEditor = new PrismEditor(originalAssumptions, 'waba');
        this.rulesEditor = new PrismEditor(originalRules, 'waba');
        this.contrariesEditor = new PrismEditor(originalContraries, 'waba');
        this.weightsEditor = new PrismEditor(originalWeights, 'waba');

        // Update references to use editor API (transparent textarea-like interface)
        // The original textareas are still accessible but hidden
        this.assumptionsInput = this.assumptionsEditor;
        this.rulesInput = this.rulesEditor;
        this.contrariesInput = this.contrariesEditor;
        this.weightsInput = this.weightsEditor;

        // Update FileManager references to use PrismEditor instances
        this.fileManager.assumptionsInput = this.assumptionsEditor;
        this.fileManager.rulesInput = this.rulesEditor;
        this.fileManager.contrariesInput = this.contrariesEditor;
        this.fileManager.weightsInput = this.weightsEditor;
    }

    updateSimpleDescription() {
        // Check if description textarea has content
        const descriptionBox = document.getElementById('simple-description-box');
        const descriptionContent = document.getElementById('simple-description-content');
        const addCommentContainer = document.getElementById('simple-add-comment-container');

        const hasDescription = descriptionContent && descriptionContent.value.trim().length > 0;

        if (hasDescription) {
            descriptionBox.removeAttribute('hidden');
            addCommentContainer.setAttribute('hidden', '');
        } else {
            descriptionBox.setAttribute('hidden', '');
            addCommentContainer.removeAttribute('hidden');
        }
    }

    addDescriptionTemplate() {
        // Add description template directly to description textarea
        const descriptionContent = document.getElementById('simple-description-content');
        if (descriptionContent) {
            descriptionContent.value = 'Enter your description here';

            // Focus the description textarea and select the placeholder text
            descriptionContent.focus();
            descriptionContent.select();
        }

        // Update the description box visibility
        this.updateSimpleDescription();
    }

    removeDescription() {
        // Clear the description textarea
        const descriptionContent = document.getElementById('simple-description-content');
        if (descriptionContent) {
            descriptionContent.value = '';
        }

        // Update the description box visibility
        this.updateSimpleDescription();

        // Regenerate graph
        this.regenerateGraph();
    }

    syncDescriptionToComment() {
        // Sync description textarea content back to // description lines in assumptions input
        const descriptionContent = document.getElementById('simple-description-content');
        if (!descriptionContent) return;

        const newDescription = descriptionContent.value;
        const lines = this.assumptionsInput.value.split('\n');

        // Find and remove all existing % // description lines
        const nonDescriptionLines = lines.filter(line => !line.trim().startsWith('% //'));

        // Build new description lines
        const newDescriptionLines = newDescription.split('\n').map(line => '% // ' + line);

        // Prepend new description lines to the content
        if (newDescriptionLines.length > 0) {
            newDescriptionLines.push(''); // Add blank line after description
        }

        // Update the assumptions input
        this.assumptionsInput.value = [...newDescriptionLines, ...nonDescriptionLines].join('\n');
    }

    parseSimpleABA() {
        // Helper function to process lines, preserving comments (except % // description)
        const processLines = (lines) => {
            const result = [];

            for (let line of lines) {
                const trimmed = line.trim();

                // Skip empty lines
                if (!trimmed) continue;

                // Skip description lines (% //) - those go in description box
                if (trimmed.startsWith('% //')) {
                    continue;
                }

                // Preserve all other lines (including % comments)
                result.push(trimmed);
            }

            return result;
        };

        // Get description directly from description textarea
        const descriptionContent = document.getElementById('simple-description-content');
        const description = descriptionContent && descriptionContent.value
            ? descriptionContent.value.split('\n').filter(line => line.trim())
            : [];

        // Update description box and button visibility
        this.updateSimpleDescription();

        // Process each input, preserving comments
        const assumptionsLines = processLines(this.assumptionsInput.value.split('\n'));
        const rulesLines = processLines(this.rulesInput.value.split('\n'));
        const contrariesLines = processLines(this.contrariesInput.value.split('\n'));
        const weightsLines = processLines(this.weightsInput.value.split('\n'));

        let clingoCode = '%% Auto-generated from Simple Editor\n';

        // Add description as special comments (% //) if it exists
        if (description.length > 0) {
            description.forEach(line => {
                clingoCode += `% // ${line}\n`;
            });
            clingoCode += '\n';
        }

        clingoCode += '\n';

        // Parse assumptions
        if (assumptionsLines.length > 0) {
            clingoCode += '%% Assumptions\n';
            assumptionsLines.forEach(line => {
                // If it's a comment, preserve it
                if (line.startsWith('%')) {
                    clingoCode += `${line}\n`;
                } else {
                    // Otherwise treat as assumption
                    clingoCode += `assumption(${line}).\n`;
                }
            });
            clingoCode += '\n';
        }

        // Parse weights
        if (weightsLines.length > 0) {
            clingoCode += '%% Weights\n';
            weightsLines.forEach(line => {
                // If it's a comment, preserve it
                if (line.startsWith('%')) {
                    clingoCode += `${line}\n`;
                } else {
                    // Otherwise parse as weight
                    const match = line.match(/^([a-z_][a-z0-9_]*)\s*:\s*(\d+)$/i);
                    if (match) {
                        const [, atom, weight] = match;
                        clingoCode += `weight(${atom}, ${weight}).\n`;
                    }
                }
            });
            clingoCode += '\n';
        }

        // Parse rules
        if (rulesLines.length > 0) {
            clingoCode += '%% Rules\n';
            let ruleCounter = 1;
            rulesLines.forEach((line) => {
                // If it's a comment, preserve it
                if (line.startsWith('%')) {
                    clingoCode += `${line}\n`;
                } else {
                    // Otherwise parse as rule
                    const match = line.match(/^([a-z_][a-z0-9_]*)\s*<-\s*(.*)$/i);
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
                }
            });
            clingoCode += '\n';
        }

        // Parse contraries
        if (contrariesLines.length > 0) {
            clingoCode += '%% Contraries\n';
            contrariesLines.forEach(line => {
                // If it's a comment, preserve it
                if (line.startsWith('%')) {
                    clingoCode += `${line}\n`;
                } else {
                    // Otherwise parse as contrary
                    // Format: (assumption, contrary)
                    const match = line.match(/^\(\s*([a-z_][a-z0-9_]*)\s*,\s*([a-z_][a-z0-9_]*)\s*\)$/i);
                    if (match) {
                        const [, assumption, contrary] = match;
                        clingoCode += `contrary(${assumption}, ${contrary}).\n`;
                    }
                }
            });
        }

        return clingoCode;
    }

    populateSimpleModeFromClingo(clingoCode) {
        // Parse clingo code and populate simple mode fields (with comments preserved)
        const lines = clingoCode.split('\n').map(l => l.trim());

        // Extract description and section-specific content with comments
        const descriptionLines = [];
        const assumptionLines = [];
        const ruleLines = [];
        const contraryLines = [];
        const weightLines = [];

        // Track processed rule IDs to avoid duplicates
        const processedRules = new Set();

        for (const line of lines) {
            // Skip empty lines
            if (!line) continue;

            // Extract description lines (% //)
            if (line.startsWith('% //')) {
                const descLine = line.substring(4).trim();
                descriptionLines.push(descLine);
                continue;
            }

            // Skip section header comments
            if (line.match(/%+\s*(Assumptions|Rules|Contraries|Weights)/i)) {
                continue;
            }

            // Strip inline comments (everything after % on the same line)
            // but only if the line doesn't START with %
            let cleanLine = line;
            if (!line.startsWith('%')) {
                const commentIndex = line.indexOf('%');
                if (commentIndex !== -1) {
                    cleanLine = line.substring(0, commentIndex).trim();
                }
            }

            // Try to match specific patterns (order matters!)
            // Use cleanLine (with inline comments stripped) for all pattern matching

            // 1. Check for assumption
            let match = cleanLine.match(/^assumption\(([^)]+)\)\.$/);
            if (match) {
                assumptionLines.push(match[1].trim());
                continue;
            }

            // 2. Check for weight
            match = cleanLine.match(/^weight\(([^,]+),\s*(\d+)\)\.$/);
            if (match) {
                weightLines.push(`${match[1].trim()}: ${match[2]}`);
                continue;
            }

            // 3. Check for contrary
            match = cleanLine.match(/^contrary\(([^,]+),\s*([^)]+)\)\.$/);
            if (match) {
                const arg1 = match[1].trim();
                const arg2 = match[2].trim();
                contraryLines.push(`(${arg1}, ${arg2})`);
                continue;
            }

            // 4. Check for head (rule)
            match = cleanLine.match(/^head\(([^,]+),\s*([^)]+)\)\./);
            if (match) {
                const ruleId = match[1];
                const head = match[2];

                // Skip if already processed (avoid duplicates from multiple head() calls)
                if (processedRules.has(ruleId)) continue;
                processedRules.add(ruleId);

                // Extract rule comment if present
                const commentMatch = clingoCode.match(new RegExp(`%\\s*${ruleId}:\\s*([^\\n]+)`, 'i'));
                if (commentMatch) {
                    ruleLines.push(`% ${commentMatch[1]}`);
                }

                // Build rule from head/body predicates
                const bodyRegex = new RegExp(`body\\(${ruleId},\\s*([^)]+)\\)`, 'g');
                const bodyMatches = [...clingoCode.matchAll(bodyRegex)];
                const bodyAtoms = bodyMatches.map(m => m[1]);

                const bodyStr = bodyAtoms.length > 0 ? bodyAtoms.join(', ') : '';
                ruleLines.push(`${head} <- ${bodyStr}`);
                continue;
            }

            // 5. Preserve other comments (not description, not section headers)
            if (line.startsWith('%')) {
                // Try to guess which section this comment belongs to based on context
                // For now, just skip standalone comments that don't belong to a specific section
                // (Could be improved by tracking last parsed item type)
                continue;
            }
        }

        // Populate description textarea
        const descriptionContent = document.getElementById('simple-description-content');
        if (descriptionContent && descriptionLines.length > 0) {
            descriptionContent.value = descriptionLines.join('\n');
        } else if (descriptionContent) {
            descriptionContent.value = '';
        }

        // Populate simple mode fields
        this.assumptionsInput.value = assumptionLines.join('\n');
        this.rulesInput.value = ruleLines.join('\n');
        this.contrariesInput.value = contraryLines.join('\n');
        this.weightsInput.value = weightLines.join('\n');

        // Update description box visibility
        this.updateSimpleDescription();
    }

    // ===================================
    // Example Loading
    // ===================================
    async loadExample(exampleName) {
        if (exampleName && examples && examples[exampleName]) {
            try {
                const clingoCode = examples[exampleName];
                this.editor.value = clingoCode;

                // Clear original .waba content (this is an example, not a user file)
                this.originalWabaContent = null;

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

    updateExampleSelectWithFilename(filename) {
        // Remove existing "Uploaded File" option if present
        const existingOption = this.exampleSelect.querySelector('option[value="__uploaded__"]');
        if (existingOption) {
            existingOption.remove();
        }

        // Add new option with uploaded filename (without extension)
        const filenameWithoutExt = filename.replace(/\.(lp|waba)$/i, '');
        const option = document.createElement('option');
        option.value = '__uploaded__';
        option.textContent = `📁 ${filenameWithoutExt}`;
        option.selected = true;

        // Insert at the top (after "-- Select Example --")
        if (this.exampleSelect.options.length > 0) {
            this.exampleSelect.insertBefore(option, this.exampleSelect.options[1]);
        } else {
            this.exampleSelect.appendChild(option);
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

    // ===================================
    // Polarity/Comparator Inference
    // ===================================

    /**
     * Infer polarity from semiring selection
     * @param {string} semiring - Semiring name
     * @returns {string} 'strength' or 'cost'
     */
    inferPolarity(semiring) {
        const polarityMap = {
            'godel': 'strength',
            'lukasiewicz': 'strength',
            'arctic': 'strength',
            'tropical': 'cost',
            'bottleneck_cost': 'cost'
        };
        return polarityMap[semiring] || 'strength';
    }

    /**
     * Get budget constraint type (UB or LB)
     * NOTE: Comparator now applies to beta_cost (repair cost), not attack scores.
     * Beta_cost is ALWAYS a cost (regardless of semiring polarity).
     * - Upper Bound (UB): allow discards only if beta_cost ≤ β
     * - Lower Bound (LB): force discards so beta_cost ≥ β
     * @returns {string} 'ub' or 'lb'
     */
    getBudgetConstraintType() {
        const constraint = this.constraintSelect.value;
        return constraint === 'lb' ? 'lb' : 'ub'; // Default to UB
    }

    /**
     * Infer optimization direction (ALWAYS minimize beta_cost by default)
     * NOTE: beta_cost is the repair cost (always a COST to minimize)
     * @returns {string} 'minimize' (default) or 'maximize' (explicit user choice)
     */
    inferOptDirection() {
        // Always default to minimize (beta_cost is a COST)
        // User can explicitly override to maximize reward (separate objective)
        return 'minimize';
    }

    /**
     * Initialize polarity inference system (always auto-inferred)
     */
    initPolarityInference() {
        // Set initial values based on current semiring (always auto-inferred)
        this.updatePolarityFromSemiring();
    }

    /**
     * Update polarity and comparator based on current semiring (always auto-inferred)
     */
    updatePolarityFromSemiring() {
        // Auto-infer from semiring
        const semiring = this.semiringSelect.value;
        const polarity = this.inferPolarity(semiring);
        const constraintType = this.getBudgetConstraintType();
        const optDirection = this.inferOptDirection();

        // Update hidden selects for programmatic access
        this.polaritySelect.value = polarity;
        this.comparatorSelect.value = constraintType;
        this.optimizeSelect.value = optDirection;

        // Update display elements
        const polarityText = polarity === 'strength'
            ? 'Strength/Reward (↑ stronger → costlier to discard)'
            : 'Cost/Weakness (↑ weaker → costlier to discard)';
        const comparatorText = constraintType === 'ub'
            ? 'Upper Bound (beta_cost ≤ β)'
            : 'Lower Bound (beta_cost ≥ β)';

        this.polarityDisplay.textContent = polarityText;
        this.comparatorDisplay.textContent = comparatorText;

        // Update warnings based on user's optimization choice
        this.updateOptDirectionWarning();
    }

    /**
     * Update optimization direction warning
     * Show warning when user selects maximize (separate objective from beta_cost)
     */
    updateOptDirectionWarning() {
        const warningDiv = document.getElementById('opt-dir-warning');
        if (warningDiv) {
            const optDir = this.optimizeSelect.value;
            if (optDir === 'maximize') {
                warningDiv.style.display = 'block';
            } else {
                warningDiv.style.display = 'none';
            }
        }
    }

    /**
     * Update budget input state based on constraint selection
     */
    updateBudgetInputState() {
        const constraint = this.constraintSelect.value;
        const budgetInput = this.budgetInput;
        const budgetLabel = document.getElementById('budget-input-label');

        if (constraint === 'none') {
            budgetInput.disabled = true;
            budgetInput.style.opacity = '0.5';
            if (budgetLabel) {
                budgetLabel.textContent = 'Budget (β - inactive)';
                budgetLabel.style.opacity = '0.5';
            }
        } else {
            budgetInput.disabled = false;
            budgetInput.style.opacity = '1';
            if (budgetLabel) {
                budgetLabel.textContent = 'Budget (β)';
                budgetLabel.style.opacity = '1';
            }
        }
    }

    /**
     * Update num models input visibility based on optimization mode
     */
    updateNumModelsVisibility() {
        const optMode = this.optModeSelect.value;
        const numModelsContainer = document.getElementById('num-models-container');

        if (numModelsContainer) {
            if (optMode === 'ignore') {
                numModelsContainer.style.display = 'block';
            } else {
                numModelsContainer.style.display = 'none';
            }
        }
    }
}

// Initialize the playground when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.playground = new WABAPlayground();

    // Expose examples globally for backwards compatibility
    window.WABAExamples = examples;
});
