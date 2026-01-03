// WABA Playground - Modular Application (ES6)
// VERSION: 20260103-4 - Update on every deployment (format: YYYYMMDD-N)

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
        this.timeoutInput = document.getElementById('timeout-input');
        this.optimizeSelect = document.getElementById('optimize-select');
        this.optModeSelect = document.getElementById('opt-mode-select');
        this.constraintSelect = document.getElementById('constraint-select');
        this.advancedModeToggle = document.getElementById('advanced-mode-toggle');
        this.polaritySelect = document.getElementById('polarity-select');
        this.comparatorSelect = document.getElementById('comparator-select');
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
                () => this.clearPreviousRun()
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

        // Polarity/Comparator inference event listeners
        this.advancedModeToggle.addEventListener('change', () => this.handleAdvancedModeToggle());
        this.polaritySelect.addEventListener('change', () => this.handlePolarityChange());
        this.comparatorSelect.addEventListener('change', () => {
            if (!this.polaritySelect.disabled) {
                // User manually changed comparator in advanced mode
                this.userOverrodeComparator = true;
            }
        });

        // Handle constraint changes (enable/disable budget input)
        this.constraintSelect.addEventListener('change', () => this.updateBudgetInputState());

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
                    () => this.clearPreviousRun()
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
                this.simpleMode.style.display = 'block';
                this.editor.style.display = 'none';
                this.updateSimpleDescription();
            } else {
                this.simpleMode.style.display = 'none';
                this.editor.style.display = 'block';
            }
        });

        // Update graph and description when simple mode inputs change
        [this.assumptionsInput, this.rulesInput, this.contrariesInput, this.weightsInput].forEach(input => {
            input.addEventListener('input', () => {
                if (this.inputMode.value === 'simple') {
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
        // Helper function to filter comment lines (no description extraction)
        const filterComments = (lines) => {
            const filtered = [];

            for (let line of lines) {
                const trimmed = line.trim();

                // Skip all comment lines (including description lines)
                if (trimmed.startsWith('%')) {
                    continue;
                }

                // Add non-comment, non-empty lines to filtered
                if (trimmed) {
                    filtered.push(trimmed);
                }
            }

            return filtered;
        };

        // Get description directly from description textarea
        const descriptionContent = document.getElementById('simple-description-content');
        const description = descriptionContent && descriptionContent.value
            ? descriptionContent.value.split('\n').filter(line => line.trim())
            : [];

        // Update description box and button visibility
        this.updateSimpleDescription();

        // Now process each input separately, filtering out comments
        const assumptions = filterComments(this.assumptionsInput.value.split('\n'));
        const rulesText = filterComments(this.rulesInput.value.split('\n'));
        const contrariesText = filterComments(this.contrariesInput.value.split('\n'));
        const weightsText = filterComments(this.weightsInput.value.split('\n'));

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
                // Format: (assumption, contrary)
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
        // Parse clingo code and populate simple mode fields (with comments preserved)
        const lines = clingoCode.split('\n').map(l => l.trim());

        // Extract description and section-specific content with comments
        const descriptionLines = [];
        const assumptionLines = [];
        const ruleLines = [];
        const contraryLines = [];
        const weightLines = [];

        let currentSection = null;

        for (const line of lines) {
            // Skip empty lines
            if (!line) continue;

            // Extract description lines (% //)
            if (line.startsWith('% //')) {
                const descLine = line.substring(4).trim();
                descriptionLines.push(descLine);
                continue;
            }

            // Detect section headers
            if (line.match(/%+\s*Assumptions/i)) {
                currentSection = 'assumptions';
                continue;
            } else if (line.match(/%+\s*Rules/i)) {
                currentSection = 'rules';
                continue;
            } else if (line.match(/%+\s*Contraries/i)) {
                currentSection = 'contraries';
                continue;
            } else if (line.match(/%+\s*Weights/i)) {
                currentSection = 'weights';
                continue;
            }

            // Preserve inline comments in appropriate section
            if (line.startsWith('%')) {
                if (currentSection === 'assumptions') assumptionLines.push(line);
                else if (currentSection === 'rules') ruleLines.push(line);
                else if (currentSection === 'contraries') contraryLines.push(line);
                else if (currentSection === 'weights') weightLines.push(line);
                continue;
            }

            // Parse content based on current section
            if (currentSection === 'assumptions') {
                const match = line.match(/^assumption\(([^)]+)\)\.$/);
                if (match) assumptionLines.push(match[1]);
            } else if (currentSection === 'rules') {
                // Check for head(...) declarations
                const headMatch = line.match(/^head\(([^,]+),\s*([^)]+)\)\./);
                if (headMatch) {
                    // Extract rule comment if present
                    const commentMatch = clingoCode.match(new RegExp(`%\\s*${headMatch[1]}:\\s*([^\\n]+)`, 'i'));
                    if (commentMatch) {
                        ruleLines.push(`% ${commentMatch[1]}`);
                    }

                    // Build rule from head/body predicates
                    const ruleId = headMatch[1];
                    const head = headMatch[2];
                    const bodyRegex = new RegExp(`body\\(${ruleId},\\s*([^)]+)\\)`, 'g');
                    const bodyMatches = [...clingoCode.matchAll(bodyRegex)];
                    const bodyAtoms = bodyMatches.map(m => m[1]);

                    const bodyStr = bodyAtoms.length > 0 ? bodyAtoms.join(', ') : '';
                    ruleLines.push(`${head} <- ${bodyStr}`);
                }
            } else if (currentSection === 'contraries') {
                const match = line.match(/^contrary\(([^,]+),\s*([^)]+)\)\.$/);
                if (match) contraryLines.push(`(${match[1]}, ${match[2]})`);
            } else if (currentSection === 'weights') {
                const match = line.match(/^weight\(([^,]+),\s*(\d+)\)\.$/);
                if (match) weightLines.push(`${match[1]}: ${match[2]}`);
            }
        }

        // Populate description textarea
        const descriptionContent = document.getElementById('simple-description-content');
        if (descriptionContent && descriptionLines.length > 0) {
            descriptionContent.value = descriptionLines.join('\n');
        } else if (descriptionContent) {
            descriptionContent.value = '';
        }

        // Populate simple mode fields (with comments)
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
     * Infer comparator from polarity
     * @param {string} polarity - 'strength' or 'cost'
     * @returns {string} '<=' or '>='
     */
    inferComparator(polarity) {
        return polarity === 'strength' ? '<=' : '>=';
    }

    /**
     * Infer optimization direction from polarity
     * @param {string} polarity - 'strength' or 'cost'
     * @returns {string} 'minimize' or 'maximize'
     */
    inferOptDirection(polarity) {
        return polarity === 'strength' ? 'maximize' : 'minimize';
    }

    /**
     * Initialize polarity inference system
     */
    initPolarityInference() {
        // Load saved state from localStorage
        const savedAdvancedMode = localStorage.getItem('waba_advancedMode') === 'true';
        const savedPolarity = localStorage.getItem('waba_polarity');
        const savedComparator = localStorage.getItem('waba_comparator');

        this.advancedModeToggle.checked = savedAdvancedMode;
        this.userOverrodeComparator = false;

        // Set initial values based on current semiring
        this.updatePolarityFromSemiring();

        // If advanced mode was saved, restore custom values
        if (savedAdvancedMode && savedPolarity && savedComparator) {
            this.polaritySelect.value = savedPolarity;
            this.comparatorSelect.value = savedComparator;
            this.polaritySelect.disabled = false;
            this.comparatorSelect.disabled = false;
        }
    }

    /**
     * Update polarity and comparator based on current semiring
     */
    updatePolarityFromSemiring() {
        const isAdvanced = this.advancedModeToggle.checked;

        if (!isAdvanced) {
            // Auto-infer from semiring
            const semiring = this.semiringSelect.value;
            const polarity = this.inferPolarity(semiring);
            const comparator = this.inferComparator(polarity);
            const optDirection = this.inferOptDirection(polarity);

            this.polaritySelect.value = polarity;
            this.comparatorSelect.value = comparator;
            this.optimizeSelect.value = optDirection;

            // Save to localStorage
            localStorage.setItem('waba_polarity', polarity);
            localStorage.setItem('waba_comparator', comparator);

            // Clear any warnings
            this.updateOptDirectionWarning();
        }
    }

    /**
     * Handle advanced mode toggle
     */
    handleAdvancedModeToggle() {
        const isAdvanced = this.advancedModeToggle.checked;

        this.polaritySelect.disabled = !isAdvanced;
        this.comparatorSelect.disabled = !isAdvanced;

        // Update label text
        const polarityLabel = document.querySelector('label[for="polarity-select"]');
        const comparatorLabel = document.querySelector('label[for="comparator-select"]');

        if (polarityLabel) {
            const labelText = polarityLabel.childNodes[0];
            if (labelText && labelText.nodeType === Node.TEXT_NODE) {
                labelText.textContent = isAdvanced ? 'Polarity (Manual)' : 'Polarity (Inferred)';
            }
        }

        if (comparatorLabel) {
            const labelText = comparatorLabel.childNodes[0];
            if (labelText && labelText.nodeType === Node.TEXT_NODE) {
                labelText.textContent = isAdvanced ? 'Comparator (Manual)' : 'Comparator (Inferred)';
            }
        }

        if (!isAdvanced) {
            // Revert to inferred values
            this.userOverrodeComparator = false;
            this.updatePolarityFromSemiring();
        } else {
            // Save current values when entering advanced mode
            localStorage.setItem('waba_polarity', this.polaritySelect.value);
            localStorage.setItem('waba_comparator', this.comparatorSelect.value);
        }

        // Save advanced mode state
        localStorage.setItem('waba_advancedMode', isAdvanced);
    }

    /**
     * Handle polarity change in advanced mode
     */
    handlePolarityChange() {
        const isAdvanced = this.advancedModeToggle.checked;

        if (isAdvanced && !this.userOverrodeComparator) {
            // Auto-update comparator to match polarity (unless user manually changed it)
            const polarity = this.polaritySelect.value;
            const comparator = this.inferComparator(polarity);
            this.comparatorSelect.value = comparator;

            // Save to localStorage
            localStorage.setItem('waba_polarity', polarity);
            localStorage.setItem('waba_comparator', comparator);
        } else if (isAdvanced) {
            // Just save the polarity
            localStorage.setItem('waba_polarity', this.polaritySelect.value);
        }

        if (!isAdvanced) {
            // Also update optimization direction
            const polarity = this.polaritySelect.value;
            const optDirection = this.inferOptDirection(polarity);
            this.optimizeSelect.value = optDirection;
        }

        // Update warning
        this.updateOptDirectionWarning();
    }

    /**
     * Update optimization direction warning if direction contradicts polarity
     */
    updateOptDirectionWarning() {
        const warningDiv = document.getElementById('opt-dir-warning');
        if (!warningDiv) return;

        const isAdvanced = this.advancedModeToggle.checked;
        const polarity = this.polaritySelect.value;
        const direction = this.optimizeSelect.value;
        const expectedDirection = this.inferOptDirection(polarity);

        if (isAdvanced && direction !== expectedDirection) {
            const polarityLabel = polarity === 'strength' ? 'Strength/Reward' : 'Cost/Weakness';
            const directionLabel = direction === 'minimize' ? 'Minimize' : 'Maximize';
            warningDiv.textContent = `⚠️ Warning: ${polarityLabel} polarity typically uses ${expectedDirection === 'minimize' ? 'Minimize' : 'Maximize'}, not ${directionLabel}`;
            warningDiv.style.display = 'block';
        } else {
            warningDiv.style.display = 'none';
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
