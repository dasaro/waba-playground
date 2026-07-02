/**
 * UIManager - Handles UI interactions (modals, overlays, fullscreen, empty states)
 */
export class UIManager {
    constructor(syntaxGuideBtn, syntaxGuideModal, syntaxGuideClose, fullscreenBtn, graphContainer) {
        this.syntaxGuideBtn = syntaxGuideBtn;
        this.syntaxGuideModal = syntaxGuideModal;
        this.syntaxGuideClose = syntaxGuideClose;
        this.fullscreenBtn = fullscreenBtn;
        this.graphContainer = graphContainer;
        this.onFullscreenChange = null;  // Callback for fullscreen changes
    }

    setFullscreenChangeCallback(callback) {
        this.onFullscreenChange = callback;
    }

    // ===================================
    // Syntax Guide Modal
    // ===================================
    openSyntaxGuide() {
        this.syntaxGuideModal.hidden = false;
        this.syntaxGuideModal.setAttribute('aria-hidden', 'false');
        // Trap focus in modal
        this.syntaxGuideModal.querySelector('button').focus();
    }

    closeSyntaxGuide() {
        this.syntaxGuideModal.hidden = true;
        this.syntaxGuideModal.setAttribute('aria-hidden', 'true');
        // Return focus to syntax guide button
        this.syntaxGuideBtn.focus();
    }

    // ===================================
    // Fullscreen
    // ===================================
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

        // Trigger callback to resize graph using requestAnimationFrame
        // This ensures the DOM has updated after fullscreen transition
        if (this.onFullscreenChange) {
            // Use requestAnimationFrame to let browser complete fullscreen layout
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    this.onFullscreenChange();
                });
            });
        }
    }

    // ===================================
    // Loading Overlay
    // ===================================
    static showLoadingOverlay(text = 'Running WABA...', subtext = 'Computing extensions and visualizing results') {
        const overlay = document.getElementById('loading-overlay');
        const loadingText = document.getElementById('loading-text');
        const loadingSubtext = document.getElementById('loading-subtext');
        const loadingElapsed = document.getElementById('loading-elapsed');

        if (overlay) {
            if (loadingText) loadingText.textContent = text;
            if (loadingSubtext) loadingSubtext.textContent = subtext;
            overlay.removeAttribute('hidden');
        }

        // Drive the elapsed counter (it was static "Elapsed: 0.0s" before).
        if (loadingElapsed) {
            const start = Date.now();
            loadingElapsed.textContent = 'Elapsed: 0.0s';
            clearInterval(UIManager._elapsedTimer);
            UIManager._elapsedTimer = setInterval(() => {
                loadingElapsed.textContent = `Elapsed: ${((Date.now() - start) / 1000).toFixed(1)}s`;
            }, 100);
        }
    }

    static hideLoadingOverlay() {
        const overlay = document.getElementById('loading-overlay');
        clearInterval(UIManager._elapsedTimer);
        UIManager._elapsedTimer = null;
        if (overlay) {
            overlay.setAttribute('hidden', '');
        }
    }

    // ===================================
    // Empty State Management
    // ===================================
    static showGraphEmptyState(message) {
        const canvas = document.getElementById('cy');
        let emptyState = document.getElementById('graph-empty-state');
        // vis.Network replaces #cy's children when it renders, which wipes the static
        // empty-state element; re-create it as an overlay so the message can still show.
        if (!emptyState && canvas) {
            emptyState = document.createElement('div');
            emptyState.id = 'graph-empty-state';
            emptyState.className = 'graph-empty-state';
            emptyState.setAttribute('role', 'status');
            emptyState.innerHTML = '<div class="empty-state-icon" aria-hidden="true">📊</div>'
                + '<h3>No Graph to Display</h3>'
                + '<p id="graph-empty-message"></p>'
                + '<p class="empty-state-hint">Pick a curated example or write a framework, then Run.</p>';
            canvas.appendChild(emptyState);
        }
        const msg = document.getElementById('graph-empty-message');
        if (msg) {
            msg.textContent = message || 'Run a WABA framework to visualize the argumentation graph.';
        }
        if (emptyState) emptyState.removeAttribute('hidden');
        if (canvas) canvas.style.opacity = '0.3';
    }

    static hideGraphEmptyState() {
        const emptyState = document.getElementById('graph-empty-state');
        const canvas = document.getElementById('cy');
        if (emptyState) emptyState.setAttribute('hidden', '');
        if (canvas) canvas.style.opacity = '1';
    }

    static showOutputEmptyState() {
        const emptyState = document.getElementById('output-empty-state');
        if (emptyState) emptyState.removeAttribute('hidden');
    }

    static hideOutputEmptyState() {
        const emptyState = document.getElementById('output-empty-state');
        if (emptyState) emptyState.setAttribute('hidden', '');
    }

    // ===================================
    // Initialize Empty States
    // ===================================
    static initializeEmptyStates() {
        UIManager.showGraphEmptyState();
        UIManager.showOutputEmptyState();
    }
}
