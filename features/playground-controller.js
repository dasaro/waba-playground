import { ThemeManager } from '../modules/theme-manager.js?v=20260312-10';
import { FontManager } from '../modules/font-manager.js?v=20260312-10';
import { UIManager } from '../modules/ui-manager.js?v=20260312-10';
import { PanelManager } from '../modules/panel-manager.js?v=20260312-10';
import { FileManager } from '../modules/file-manager.js?v=20260312-10';
import { GraphManager } from '../modules/graph-manager.js?v=20260312-10';
import { PopupManager } from '../modules/popup-manager.js?v=20260312-10';
import { ClingoManager } from '../modules/clingo-manager.js?v=20260312-10';
import { OutputManager } from '../modules/output-manager.js?v=20260312-10';
import { ExportManager } from '../modules/export-manager.js?v=20260312-10';
import { MetricsManager } from '../modules/metrics-manager.js?v=20260312-10';
import { ConfigController } from './config-controller.js?v=20260312-10';
import { DocsController } from './docs-controller.js?v=20260312-10';
import { EditorController } from './editor-controller.js?v=20260312-10';
import { ExamplesController } from './examples-controller.js?v=20260312-10';

export class PlaygroundController {
    constructor(dom, store) {
        this.dom = dom;
        this.store = store;
        this.pendingExampleLoad = Promise.resolve();
        this.pendingGraphUpdate = Promise.resolve();
        this.initializeManagers();
        this.initializeControllers();
    }

    initializeManagers() {
        this.graphManager = new GraphManager(this.dom.graphCanvas, this.dom.resetLayoutBtn, this.dom.fullscreenBtn, {
            isolatedBanner: this.dom.isolatedAssumptionsBanner,
            isolatedList: this.dom.isolatedAssumptionsList
        });
        this.network = null;
        this.networkData = { nodes: null, edges: null };

        this.themeManager = new ThemeManager(
            this.dom.themeToggleBtn,
            this.dom.themeIcon,
            () => this.network,
            () => this.networkData
        );

        this.fontManager = new FontManager(this.dom.fontIncreaseBtn, this.dom.fontDecreaseBtn);
        this.uiManager = new UIManager(
            this.dom.syntaxGuideBtn,
            this.dom.syntaxGuideModal,
            this.dom.syntaxGuideClose
        );
        this.panelManager = new PanelManager();
        this.fileManager = new FileManager(
            this.dom.fileUploadBtn,
            this.dom.fileUploadInput,
            this.dom.inputMode,
            this.dom.simpleMode,
            this.dom.editor,
            this.dom.assumptionsInput,
            this.dom.rulesInput,
            this.dom.contrariesInput,
            this.dom.weightsInput
        );
        this.clingoManager = new ClingoManager(this.dom.runBtn, this.dom.introStatus);
        this.outputManager = new OutputManager(this.dom, () => this.configController.getCurrentConfig());
        this.exportManager = new ExportManager(this.graphManager, this.dom.exportPngBtn, this.dom.exportPdfBtn, this);
    }

    initializeControllers() {
        this.configController = new ConfigController(this.dom);
        this.editorController = new EditorController(this.dom, this.store, this.fileManager);
        this.examplesController = new ExamplesController(this.dom, this.configController, this.editorController, this.outputManager);
        this.docsController = new DocsController(this.dom, this.uiManager, this.panelManager);
    }

    async init() {
        this.themeManager.initTheme();
        this.fontManager.initFontSize();
        this.editorController.init(() => {
            this.pendingGraphUpdate = this.regenerateGraph();
        });
        MetricsManager.runUnitTest();

        await this.clingoManager.initClingo();

        this.graphManager.initGraph();
        this.network = this.graphManager.network;
        this.networkData = this.graphManager.networkData;
        this.graphManager.initFullscreen(this.dom.graphPanel);

        this.themeManager.network = this.network;
        this.themeManager.networkData = this.networkData;

        this.graphManager.setupEventListeners(
            (node, x, y) => this.handleNodeClick(node, x, y),
            (edge, x, y) => this.handleEdgeClick(edge, x, y)
        );

        this.docsController.init();
        this.attachEventListeners();

        UIManager.initializeEmptyStates();
        this.examplesController.populate();
        this.configController.syncUi();

        const selectedExample = this.dom.exampleSelect.value;
        if (selectedExample) {
            this.pendingExampleLoad = this.examplesController.loadExample(selectedExample, (frameworkCode) => {
                this.pendingGraphUpdate = this.updateGraph(frameworkCode);
                return this.pendingGraphUpdate;
            });
            await this.pendingExampleLoad;
        }
    }

    attachEventListeners() {
        this.dom.runBtn.addEventListener('click', () => this.runWABA());
        this.dom.clearBtn.addEventListener('click', () => this.clearOutput());
        this.dom.exampleSelect.addEventListener('change', (event) => {
            this.pendingExampleLoad = this.examplesController.loadExample(event.target.value, (frameworkCode) => {
                this.pendingGraphUpdate = this.updateGraph(frameworkCode);
                return this.pendingGraphUpdate;
            });
        });

        this.dom.fileUploadBtn.addEventListener('click', () => this.dom.fileUploadInput.click());
        this.dom.fileUploadInput.addEventListener('change', (event) => this.handleFileUploadEvent(event));

        this.initDragAndDrop();

        [this.dom.semiringSelect, this.dom.polaritySelect, this.dom.defaultPolicySelect].forEach((element) => {
            element.addEventListener('change', () => {
                this.configController.syncUi();
                this.pendingGraphUpdate = this.regenerateGraph();
            });
        });

        [
            this.dom.monoidSelect,
            this.dom.optimizeSelect,
            this.dom.constraintSelect,
            this.dom.budgetIntentSelect,
            this.dom.semanticsSelect,
            this.dom.optModeSelect
        ].forEach((element) => {
            element.addEventListener('change', () => this.configController.syncUi());
        });

        if (this.dom.budgetActiveToggle) {
            this.dom.budgetActiveToggle.addEventListener('change', () => {
                if (this.dom.budgetActiveToggle.checked) {
                    this.configController.activateBudgetBeta();
                } else {
                    this.configController.deactivateBudgetBeta();
                }
                this.configController.syncUi();
            });
        }

        this.dom.graphModeRadios.forEach((radio) => {
            radio.addEventListener('change', () => {
                this.outputManager.clearActiveExtension();
                this.graphManager.resetGraphColors();
                this.pendingGraphUpdate = this.regenerateGraph();
            });
        });

        this.dom.document.addEventListener('keydown', (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault();
                this.runWABA();
            }
        });

        this.dom.downloadLpBtn.addEventListener('click', () => this.downloadAsLp());
        this.dom.downloadWabaBtn.addEventListener('click', () => this.downloadAsWaba());
    }

    initDragAndDrop() {
        let dragCounter = 0;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
            this.dom.document.addEventListener(eventName, (event) => {
                event.preventDefault();
                event.stopPropagation();
            }, false);
        });

        this.dom.document.addEventListener('dragenter', () => {
            dragCounter += 1;
            if (dragCounter === 1) {
                this.dom.body.classList.add('drag-over');
            }
        });

        this.dom.document.addEventListener('dragleave', () => {
            dragCounter -= 1;
            if (dragCounter === 0) {
                this.dom.body.classList.remove('drag-over');
            }
        });

        this.dom.document.addEventListener('drop', (event) => {
            dragCounter = 0;
            this.dom.body.classList.remove('drag-over');

            const file = event.dataTransfer?.files?.[0];
            if (file) {
                this.handleUploadedFile(file);
            }
        });
    }

    async handleFileUploadEvent(event) {
        const file = event.target.files?.[0];
        if (file) {
            await this.handleUploadedFile(file);
        }
        this.dom.fileUploadInput.value = '';
    }

    async handleUploadedFile(file) {
        const fileName = file.name;
        const extension = fileName.split('.').pop()?.toLowerCase();

        try {
            const content = await file.text();
            this.clearPreviousRun();

            if (extension === 'lp') {
                this.dom.inputMode.value = 'advanced';
                this.editorController.loadClingoCode(content, null);
                this.pendingGraphUpdate = this.updateGraph(content);
                await this.pendingGraphUpdate;
                this.outputManager.log(`📁 Loaded .lp file: ${fileName}`, 'info');
            } else if (extension === 'waba') {
                const parsed = this.fileManager.parseWabaFile(content);
                this.editorController.loadParsedWaba(parsed, content);
                this.pendingGraphUpdate = this.updateGraph(this.editorController.getFrameworkCode());
                await this.pendingGraphUpdate;
                this.outputManager.log(`📁 Loaded .waba file: ${fileName}`, 'info');
            } else {
                this.outputManager.log(`❌ Unsupported file type: ${extension}. Please use .lp or .waba files.`, 'error');
                return;
            }

            this.examplesController.updateExampleSelectWithFilename(fileName);
        } catch (error) {
            console.error('File upload error:', error);
            this.outputManager.log(`❌ Error loading file: ${error.message}`, 'error');
        }
    }

    async runWABA() {
        UIManager.showLoadingOverlay('Running WABA...', 'Computing extensions and visualizing results');

        try {
            await Promise.all([this.pendingExampleLoad, this.pendingGraphUpdate]);
            const framework = this.editorController.getFrameworkCode();
            if (!framework) {
                this.outputManager.log('⚠️ No framework code to run', 'warning');
                return;
            }

            const config = this.configController.getCurrentConfig();
            const result = await this.clingoManager.runWABA(
                framework,
                config,
                (message, type) => this.outputManager.log(message, type)
            );

            if (!result) {
                return;
            }

            this.clearOutput();
            await this.updateGraph(framework);
            this.outputManager.displayResults(
                result.result,
                result.elapsed,
                (inAssumptions, discarded, successful) => this.graphManager.highlightExtension(inAssumptions, discarded, successful),
                () => this.graphManager.resetGraphColors(),
                result.effectiveConfig
            );
            UIManager.hideOutputEmptyState();
        } catch (error) {
            console.error('Error in runWABA:', error);
            this.outputManager.log(`❌ Error: ${error.message}`, 'error');
        } finally {
            UIManager.hideLoadingOverlay();
        }
    }

    async regenerateGraph() {
        const activeExtension = this.outputManager.getActiveExtensionData();
        const framework = this.editorController.getFrameworkCode();

        if (!framework) {
            return;
        }

        await this.updateGraph(framework);

        if (activeExtension) {
            setTimeout(() => {
                const header = this.dom.output.querySelector(`.answer-header[data-extension-id="${activeExtension}"]`);
                if (header) {
                    this.outputManager.restoreActiveExtension();
                }
            }, 500);
        }
    }

    async updateGraph(frameworkCode) {
        const selectedMode = this.dom.graphModeRadios.find((radio) => radio.checked);
        const mode = selectedMode ? selectedMode.value : 'standard';
        this.store.setState({
            currentFrameworkCode: frameworkCode,
            currentGraphMode: mode
        });

        await this.graphManager.updateGraph(frameworkCode, mode, this.clingoManager, this.configController.getCurrentConfig());
    }

    clearPreviousRun() {
        this.outputManager.clearPreviousRun(() => this.graphManager.resetGraphColors());
    }

    downloadAsLp() {
        const frameworkCode = this.editorController.getFrameworkCode();
        this.fileManager.downloadAsLp(frameworkCode, (message, type) => this.outputManager.log(message, type));
    }

    downloadAsWaba() {
        const wabaContent = this.dom.inputMode.value === 'simple'
            ? this.fileManager.generateWabaFormat()
            : this.fileManager.convertLpToWaba(this.editorController.getFrameworkCode());

        this.fileManager.downloadAsWaba(wabaContent, (message, type) => this.outputManager.log(message, type));
    }

    clearOutput() {
        this.outputManager.clearOutput();
    }

    handleNodeClick(node, x, y) {
        const state = this.store.getState();
        PopupManager.showNodePopup(node, x, y, {
            frameworkCode: state.currentFrameworkCode,
            graphMode: state.currentGraphMode
        });
    }

    handleEdgeClick(edge, x, y) {
        PopupManager.showEdgePopup(edge, x, y);
    }

    exportGraphInLightMode(callback) {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const wasLight = currentTheme === 'light';

        if (!wasLight) {
            document.documentElement.setAttribute('data-theme', 'light');
            this.themeManager.updateGraphTheme();

            setTimeout(() => {
                try {
                    callback();
                } catch (error) {
                    console.error('Export failed:', error);
                    alert('Export failed. Please try again.');
                } finally {
                    setTimeout(() => {
                        document.documentElement.setAttribute('data-theme', currentTheme || 'dark');
                        this.themeManager.updateGraphTheme();
                    }, 100);
                }
            }, 200);
        } else {
            try {
                callback();
            } catch (error) {
                console.error('Export failed:', error);
                alert('Export failed. Please try again.');
            }
        }
    }
}
