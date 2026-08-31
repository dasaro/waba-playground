import { ThemeManager } from '../modules/theme-manager.js?v=20260831-1';
import { FontManager } from '../modules/font-manager.js?v=20260831-1';
import { UIManager } from '../modules/ui-manager.js?v=20260831-1';
import { PanelManager } from '../modules/panel-manager.js?v=20260831-1';
import { FileManager } from '../modules/file-manager.js?v=20260831-1';
import { GraphManager } from '../modules/graph-manager.js?v=20260831-1';
import { PopupManager } from '../modules/popup-manager.js?v=20260831-1';
import { ClingoManager } from '../modules/clingo-manager.js?v=20260831-1';
import { OutputManager } from '../modules/output-manager.js?v=20260831-1';
import { CredibilityManager } from '../modules/credibility-manager.js?v=20260831-1';
import { ExportManager } from '../modules/export-manager.js?v=20260831-1';
import { ConfigController } from './config-controller.js?v=20260831-1';
import { DocsController } from './docs-controller.js?v=20260831-1';
import { EditorController } from './editor-controller.js?v=20260831-1';
import { ExamplesController } from './examples-controller.js?v=20260831-1';

export class PlaygroundController {
    constructor(dom, store) {
        this.dom = dom;
        this.store = store;
        this.pendingExampleLoad = Promise.resolve();
        this.isRunning = false;
        // Bumped whenever the pending run is superseded, so a slow solve cannot paint its
        // results over a framework the user has since switched away from.
        this._runGeneration = 0;
        this.pendingGraphUpdate = Promise.resolve();
        // Count of in-flight example loads and graph rebuilds, mirrored onto
        // body[data-waba-pending] so a test can wait on the app settling instead of guessing
        // a sleep long enough. See track().
        this._pending = 0;
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
            () => this.networkData,
            () => this.outputManager?.restoreActiveExtension?.()
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
            this.dom.weightsInput,
            this.dom.simpleDescriptionContent
        );
        this.clingoManager = new ClingoManager(this.dom.runBtn, this.dom.introStatus);
        this.outputManager = new OutputManager(this.dom, () => this.configController.getCurrentConfig());
        this.credibilityManager = new CredibilityManager(this.dom.output);
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
            this.pendingGraphUpdate = this.track(this.regenerateGraph());
        });

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
        const initialGraphMode = this.dom.graphModeRadios.find((radio) => radio.checked)?.value || 'standard';
        this.docsController.setLegendMode(initialGraphMode);
        this.attachEventListeners();

        UIManager.initializeEmptyStates();
        this.examplesController.populate();
        this.configController.syncUi();

        const selectedExample = this.dom.exampleSelect.value;
        if (selectedExample) {
            this.pendingExampleLoad = this.track(this.examplesController.loadExample(selectedExample, (frameworkCode) => {
                this.pendingGraphUpdate = this.track(this.updateGraph(frameworkCode));
                return this.pendingGraphUpdate;
            }));
            await this.pendingExampleLoad;

            // Solve once on load so the page opens on a worked example rather than an empty
            // results pane. Deliberately not awaited: app.js continues bootstrapping while
            // this runs. `?autorun=0` opts out, which the browser specs use when they need to
            // exercise the click path itself.
            const autorun = new URLSearchParams(window.location.search).get('autorun') !== '0';
            if (autorun && this.clingoManager.clingoReady) {
                this.initialRun = this.runWABA({ initial: true });
            } else {
                this.markReady();
            }
        } else {
            this.markReady();
        }
    }

    /**
     * Publishes an observable "the page has finished its first run" signal. Without it a test
     * can only wait on #intro-status, which flips before init has finished, so it resumes into
     * a half-initialised page.
     */
    markReady() {
        if (this.dom.document?.body) {
            this.dom.document.body.dataset.wabaReady = '1';
        }
    }

    /**
     * Wraps an async UI transition so the page publishes whether it is still settling.
     * The browser suite used to bridge these with `waitForTimeout(1200)` and friends -- 18 of
     * them -- which is both slow and a coin flip on a loaded machine: a graph rebuild that
     * takes 1300ms silently tested the PREVIOUS framework.
     */
    track(promise) {
        this._pending += 1;
        const body = this.dom.document?.body;
        if (body) body.dataset.wabaPending = String(this._pending);
        const settle = () => {
            this._pending -= 1;
            if (body) body.dataset.wabaPending = String(this._pending);
        };
        return Promise.resolve(promise).then(
            (value) => { settle(); return value; },
            (error) => { settle(); throw error; }
        );
    }

    attachEventListeners() {
        this.dom.runBtn.addEventListener('click', () => this.runWABA());
        this.dom.clearBtn.addEventListener('click', () => this.clearOutput());
        this.dom.credibilityBtn.addEventListener('click', () => this.track(this.computeCredibility()));
        this.dom.exampleSelect.addEventListener('change', (event) => {
            // Loading a different framework invalidates the displayed extensions, exactly as
            // in the upload path; without this the previous run's answer sets stay on screen
            // and read as though they belonged to the newly selected example.
            this.clearPreviousRun();
            this.pendingExampleLoad = this.track(
                this.examplesController.loadExample(event.target.value, (frameworkCode) => {
                    this.pendingGraphUpdate = this.track(this.updateGraph(frameworkCode));
                    return this.pendingGraphUpdate;
                })
            );
        });

        this.dom.fileUploadBtn.addEventListener('click', () => this.dom.fileUploadInput.click());
        this.dom.fileUploadInput.addEventListener('change', (event) => this.track(this.handleFileUploadEvent(event)));

        this.initDragAndDrop();

        // Controls that change the propagated WEIGHTS, so the graph must be rebuilt.
        // filter(Boolean) so one absent control degrades that listener instead of
        // aborting the whole wire-up with a TypeError.
        [
            this.dom.semiringSelect,
            this.dom.defaultPolicySelect,
            this.dom.abaRecoveryToggle,
            this.dom.lukKInput
        ].filter(Boolean).forEach((element) => {
            element.addEventListener('change', () => {
                this.configController.syncUi();
                this.pendingGraphUpdate = this.track(this.regenerateGraph());
            });
        });

        // Controls that only change which extensions are reported.
        [
            this.dom.semanticsSelect,
            this.dom.budgetSelect,
            this.dom.resultsSelect
        ].filter(Boolean).forEach((element) => {
            element.addEventListener('change', () => this.configController.syncUi());
        });

        this.dom.graphModeRadios.forEach((radio) => {
            radio.addEventListener('change', () => {
                this.docsController.setLegendMode(radio.value);
                this.outputManager.clearActiveExtension();
                this.graphManager.resetGraphColors();
                this.pendingGraphUpdate = this.track(this.regenerateGraph());
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

            if (extension === 'lp') {
                this.clearPreviousRun();
                // Assigning .value does not fire `change`, so the mode handler never runs and
                // the Simple panel would stay visible over the freshly loaded ASP; apply the
                // visibility switch explicitly.
                this.dom.inputMode.value = 'advanced';
                this.editorController.applyModeVisibility('advanced');
                this.editorController.loadClingoCode(content, null);
                this.pendingGraphUpdate = this.track(this.updateGraph(content));
                await this.pendingGraphUpdate;
                this.outputManager.log(`📁 Loaded .lp file: ${fileName}`, 'info');
            } else if (extension === 'waba') {
                this.clearPreviousRun();
                const parsed = this.fileManager.parseWabaFile(content);
                this.editorController.loadParsedWaba(parsed);
                this.pendingGraphUpdate = this.track(this.updateGraph(this.editorController.getFrameworkCode()));
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

    async computeCredibility() {
        const framework = this.editorController.getFrameworkCode();
        if (!framework.trim()) {
            this.outputManager.log('⚠️ No framework code to grade', 'warning');
            return;
        }
        // empty input = auto: kappa is chosen from the framework's own standpoint costs.
        // A fixed default silently flattens cred on any framework whose costs are far from
        // it, which is a semantic change disguised as a UI default.
        const raw = this.dom.credibilityKappa.value.trim();
        const kappa = raw === '' ? null : Math.max(1, parseInt(raw, 10) || 1);
        const config = this.configController.getCurrentConfig();
        this.dom.credibilityBtn.disabled = true;
        document.body.dataset.wabaCredibility = '0';
        try {
            this.outputManager.log(
                `⚖️ Computing credibility (\u03ba = ${kappa === null ? 'auto' : kappa})…`, 'info');
            const data = await this.clingoManager.computeCredibility(
                framework, config, kappa,
                (message, type) => this.outputManager.log(message, type),
                this.dom.credibilityDiscount.value
            );
            if (data) {
                this.credibilityManager.render(data);
                this.outputManager.log(`Credibility over ${data.standpoints.length} standpoints rendered.`, 'success');
            }
        } catch (error) {
            this.outputManager.log(`❌ Credibility failed: ${error.message}`, 'error');
        } finally {
            this.dom.credibilityBtn.disabled = false;
            document.body.dataset.wabaCredibility = '1';
        }
    }

    async runWABA({ initial = false } = {}) {
        if (this.isRunning) {
            return;
        }
        this.isRunning = true;
        this.setRunningFlag(true);
        const generation = (this._runGeneration = this._runGeneration + 1);
        // The initial run is unprompted, so covering the whole UI with a modal overlay for it
        // would be startling; the user did not ask for it and cannot tell what is happening.
        if (!initial) {
            UIManager.showLoadingOverlay('Running WABA...', 'Computing extensions and visualizing results');
        }

        try {
            await Promise.all([this.pendingExampleLoad, this.pendingGraphUpdate]);
            const framework = this.editorController.getFrameworkCode();
            if (!framework) {
                // Clear FIRST: the early return used to leave the previous run's extensions,
                // stats and graph highlight asserting a framework no longer in the editor, with
                // the contradicting warning scrolled off-screen.
                this.clearOutput();
                this.outputManager.clearActiveExtension();
                this.graphManager.resetGraphColors();
                this.outputManager.log('⚠️ No framework code to run', 'warning');
                return;
            }

            const config = this.configController.getCurrentConfig();
            // Clear the previous run's results + graph highlight BEFORE solving, so a
            // failed / timed-out / empty run does not leave stale extensions and a
            // stale highlight on screen.
            this.clearOutput();
            this.outputManager.clearActiveExtension();
            this.graphManager.resetGraphColors();
            const result = await this.clingoManager.runWABA(
                framework,
                config,
                (message, type) => this.outputManager.log(message, type)
            );

            if (!result) {
                return;
            }

            // A run that has been superseded (the user switched example or re-ran) must not
            // paint. Without this a slow solve reported its predecessor's extensions against
            // the newly loaded framework -- reproducibly, and routinely once a run fires on
            // load. GraphManager already guards its own updates this way.
            if (generation !== this._runGeneration) {
                return;
            }

            await this.updateGraph(framework);
            if (generation !== this._runGeneration) {
                return;
            }
            this.outputManager.displayResults(
                result.result,
                result.elapsed,
                (inAssumptions, discarded, successful) => this.graphManager.highlightExtension(inAssumptions, discarded, successful),
                () => this.graphManager.resetGraphColors(),
                result.effectiveConfig,
                framework
            );
            UIManager.hideOutputEmptyState();
        } catch (error) {
            console.error('Error in runWABA:', error);
            this.outputManager.log(`❌ Error: ${error.message}`, 'error');
        } finally {
            this.isRunning = false;
            this.setRunningFlag(false);
            // EVERY exit path lands here, so this is the only place that can guarantee the
            // Results panel is open. Putting it on the success path meant the four paths that
            // write a FAILURE into #output -- empty editor, solver not ready, a rejected
            // config, a solver error -- still wrote it into a display:none panel. A failure
            // the user cannot see is worse than a result they cannot see.
            this.panelManager.expandPanel('output');
            if (!initial) {
                UIManager.hideLoadingOverlay();
            } else {
                this.markReady();
            }
        }
    }

    /**
     * Publishes whether a solve is in flight, on body[data-waba-running].
     *
     * There is no other observable: #run-btn.disabled is written exactly once in the whole
     * app (clingo-manager's give-up branch) and never cleared, so a test waiting on
     * `!runBtn.disabled` returns on its first poll and asserts against the pre-run DOM.
     */
    setRunningFlag(running) {
        const body = this.dom.document?.body;
        if (body) body.dataset.wabaRunning = running ? '1' : '0';
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
        // Keep the legend in sync with the mode actually used (which an example
        // preset may have set programmatically, without firing a radio 'change').
        this.docsController.setLegendMode(mode);
        this.store.setState({
            currentFrameworkCode: frameworkCode,
            currentGraphMode: mode
        });

        await this.graphManager.updateGraph(frameworkCode, mode, this.clingoManager, this.configController.getCurrentConfig());
        // Register the camera settle in the pending counter WITHOUT awaiting it. The counter
        // therefore covers the deferred fit (so a test that reads a screen position waits for
        // it), while the run path -- which awaits pendingGraphUpdate -- is not delayed by the
        // ~1.1 s animation. Tracked here, before this promise resolves, so the counter never
        // dips to 0 in between.
        if (this.graphManager.cameraSettled) {
            this.track(this.graphManager.cameraSettled);
        }
    }

    clearPreviousRun() {
        // Anything in flight is now stale.
        this._runGeneration += 1;
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
