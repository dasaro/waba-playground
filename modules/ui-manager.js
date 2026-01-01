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
