/**
 * PanelManager - Centralized panel state management.
 */
export class PanelManager {
    constructor() {
        this.panels = new Map();
        this.storageKey = 'waba-panel-states';
    }

    registerPanel(panelId, defaultExpanded = true) {
        const element = document.querySelector(`[data-panel="${panelId}"]`);
        if (!element) {
            console.warn(`Panel not found: ${panelId}`);
            return;
        }

        const savedStates = this.getSavedStates();
        const expanded = Object.prototype.hasOwnProperty.call(savedStates, panelId)
            ? savedStates[panelId]
            : defaultExpanded;

        this.panels.set(panelId, { element, expanded });
        this.applyPanelState(panelId, expanded);
    }

    togglePanel(panelId) {
        const panel = this.panels.get(panelId);
        if (!panel) {
            return;
        }

        panel.expanded = !panel.expanded;
        this.applyPanelState(panelId, panel.expanded);
        this.saveStates();
    }

    collapsePanel(panelId) {
        const panel = this.panels.get(panelId);
        if (!panel || !panel.expanded) {
            return;
        }

        panel.expanded = false;
        this.applyPanelState(panelId, false);
        this.saveStates();
    }

    expandPanel(panelId) {
        const panel = this.panels.get(panelId);
        if (!panel || panel.expanded) {
            return;
        }

        panel.expanded = true;
        this.applyPanelState(panelId, true);
        this.saveStates();
    }

    applyPanelState(panelId, expanded) {
        const panel = this.panels.get(panelId);
        if (!panel) {
            return;
        }

        const { element } = panel;
        element.setAttribute('data-collapsed', expanded ? 'false' : 'true');

        const toggleBtn = element.querySelector('.panel-toggle');
        if (toggleBtn) {
            toggleBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        }

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

    loadStates() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            return saved ? JSON.parse(saved) : {};
        } catch (error) {
            console.warn('Failed to load panel states:', error);
            return {};
        }
    }

    getSavedStates() {
        return this.loadStates();
    }

    saveStates() {
        try {
            const states = {};
            this.panels.forEach((panel, id) => {
                states[id] = panel.expanded;
            });
            localStorage.setItem(this.storageKey, JSON.stringify(states));
        } catch (error) {
            console.warn('Failed to save panel states:', error);
        }
    }

    isExpanded(panelId) {
        const panel = this.panels.get(panelId);
        return panel ? panel.expanded : false;
    }
}
