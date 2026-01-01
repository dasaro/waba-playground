/**
 * UIManager - Handles UI interactions (modals, overlays, empty states)
 */
export class UIManager {
    constructor(syntaxGuideBtn, syntaxGuideModal, syntaxGuideClose) {
        this.syntaxGuideBtn = syntaxGuideBtn;
        this.syntaxGuideModal = syntaxGuideModal;
        this.syntaxGuideClose = syntaxGuideClose;
    }

    // ===================================
    // Syntax Guide Modal
    // ===================================
    openSyntaxGuide() {
        this.syntaxGuideModal.hidden = false;
        this.syntaxGuideModal.setAttribute('aria-hidden', 'false');

        // Focus the first tab button (or close button as fallback)
        const firstTab = this.syntaxGuideModal.querySelector('.doc-tab');
        if (firstTab) {
            firstTab.focus();
        } else {
            const closeBtn = this.syntaxGuideModal.querySelector('button');
            if (closeBtn) closeBtn.focus();
        }

        // Set up focus trap
        this._setupFocusTrap();
    }

    closeSyntaxGuide() {
        this.syntaxGuideModal.hidden = true;
        this.syntaxGuideModal.setAttribute('aria-hidden', 'true');

        // Return focus to syntax guide button
        if (this.syntaxGuideBtn) {
            this.syntaxGuideBtn.focus();
        }

        // Remove focus trap
        this._removeFocusTrap();
    }

    _setupFocusTrap() {
        // Get all focusable elements in the modal
        const focusableElements = this.syntaxGuideModal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        // Handle Tab key to trap focus
        this._trapFocusHandler = (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    // Shift + Tab
                    if (document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    // Tab
                    if (document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
            }

            // Close modal on Escape
            if (e.key === 'Escape') {
                this.closeSyntaxGuide();
            }
        };

        this.syntaxGuideModal.addEventListener('keydown', this._trapFocusHandler);
    }

    _removeFocusTrap() {
        if (this._trapFocusHandler) {
            this.syntaxGuideModal.removeEventListener('keydown', this._trapFocusHandler);
            this._trapFocusHandler = null;
        }
    }

    // ===================================
    // Loading Overlay
    // ===================================
    static showLoadingOverlay(text = 'Running WABA...', subtext = 'Computing extensions and visualizing results') {
        const overlay = document.getElementById('loading-overlay');
        const loadingText = document.getElementById('loading-text');
        const loadingSubtext = document.getElementById('loading-subtext');

        if (overlay) {
            if (loadingText) loadingText.textContent = text;
            if (loadingSubtext) loadingSubtext.textContent = subtext;
            overlay.removeAttribute('hidden');
        }
    }

    static hideLoadingOverlay() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.setAttribute('hidden', '');
        }
    }

    // ===================================
    // Empty State Management
    // ===================================
    static showGraphEmptyState() {
        const emptyState = document.getElementById('graph-empty-state');
        const canvas = document.getElementById('cy');
        if (emptyState) {
            emptyState.removeAttribute('hidden');
        }
        if (canvas && canvas.style) {
            canvas.style.opacity = '0.3';
        }
    }

    static hideGraphEmptyState() {
        const emptyState = document.getElementById('graph-empty-state');
        const canvas = document.getElementById('cy');
        if (emptyState) {
            emptyState.setAttribute('hidden', '');
        }
        if (canvas && canvas.style) {
            canvas.style.opacity = '1';
        }
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
