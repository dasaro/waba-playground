/**
 * PanelManager - Centralized panel state management
 * Handles collapse/expand, state persistence, and responsive behavior
 */
export class PanelManager {
    constructor() {
        this.panels = new Map(); // Panel ID -> {element, expanded}
        this.storageKey = 'waba-panel-states';
        this.loadStates();
    }

    /**
     * Register a panel for management
     * @param {string} panelId - The data-panel attribute value
     * @param {boolean} defaultExpanded - Default expanded state
     */
    registerPanel(panelId, defaultExpanded = true) {
        const element = document.querySelector(`[data-panel="${panelId}"]`);
        if (!element) {
            console.warn(`Panel not found: ${panelId}`);
            return;
        }

        // Get saved state or use default
        const savedStates = this.getSavedStates();
        const expanded = savedStates.hasOwnProperty(panelId)
            ? savedStates[panelId]
            : defaultExpanded;

        // Store panel info
        this.panels.set(panelId, {
            element,
            expanded
        });

        // Apply initial state
        this.applyPanelState(panelId, expanded);

        console.log(`✅ Panel registered: ${panelId} (${expanded ? 'expanded' : 'collapsed'})`);
    }

    /**
     * Toggle panel expanded/collapsed state
     * @param {string} panelId - Panel to toggle
     */
    togglePanel(panelId) {
        const panel = this.panels.get(panelId);
        if (!panel) {
            console.warn(`Panel not registered: ${panelId}`);
            return;
        }

        const newState = !panel.expanded;
        panel.expanded = newState;
        this.applyPanelState(panelId, newState);
        this.saveStates();

        console.log(`🔄 Panel toggled: ${panelId} → ${newState ? 'expanded' : 'collapsed'}`);
    }

    /**
     * Collapse a panel
     * @param {string} panelId - Panel to collapse
     */
    collapsePanel(panelId) {
        const panel = this.panels.get(panelId);
        if (!panel || !panel.expanded) return;

        panel.expanded = false;
        this.applyPanelState(panelId, false);
        this.saveStates();
    }

    /**
     * Expand a panel
     * @param {string} panelId - Panel to expand
     */
    expandPanel(panelId) {
        const panel = this.panels.get(panelId);
        if (!panel || panel.expanded) return;

        panel.expanded = true;
        this.applyPanelState(panelId, true);
        this.saveStates();
    }

    /**
     * Apply visual state to panel element
     * @param {string} panelId - Panel to update
     * @param {boolean} expanded - Expanded state
     */
    applyPanelState(panelId, expanded) {
        const panel = this.panels.get(panelId);
        if (!panel) return;

        const { element } = panel;

        // Set data attribute for CSS
        element.setAttribute('data-collapsed', expanded ? 'false' : 'true');

        // Update ARIA for toggle button
        const toggleBtn = element.querySelector('.panel-toggle');
        if (toggleBtn) {
            toggleBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        }

        // Update icon visibility
        const collapseIcon = element.querySelector('.icon-collapse');
        const expandIcon = element.querySelector('.icon-expand');

        if (collapseIcon && expandIcon) {
            if (expanded) {
                collapseIcon.removeAttribute('hidden');
                expandIcon.setAttribute('hidden', '');
            } else {
                collapseIcon.setAttribute('hidden', '');
                expandIcon.removeAttribute('hidden');
            }
        }
    }

    /**
     * Load panel states from localStorage
     */
    loadStates() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            console.warn('Failed to load panel states:', e);
            return {};
        }
    }

    /**
     * Get saved states object
     */
    getSavedStates() {
        return this.loadStates();
    }

    /**
     * Save current panel states to localStorage
     */
    saveStates() {
        try {
            const states = {};
            this.panels.forEach((panel, id) => {
                states[id] = panel.expanded;
            });
            localStorage.setItem(this.storageKey, JSON.stringify(states));
            console.log('💾 Panel states saved:', states);
        } catch (e) {
            console.warn('Failed to save panel states:', e);
        }
    }

    /**
     * Get panel expanded state
     * @param {string} panelId - Panel to check
     * @returns {boolean} - True if expanded
     */
    isExpanded(panelId) {
        const panel = this.panels.get(panelId);
        return panel ? panel.expanded : false;
    }

    /**
     * Collapse all panels
     */
    collapseAll() {
        this.panels.forEach((_, panelId) => {
            this.collapsePanel(panelId);
        });
    }

    /**
     * Expand all panels
     */
    expandAll() {
        this.panels.forEach((_, panelId) => {
            this.expandPanel(panelId);
        });
    }
}
