/**
 * ThemeManager - Handles dark/light theme switching
 */
import { GraphUtils } from './graph-utils.js?v=20260630-4';

export class ThemeManager {
    constructor(themeToggleBtn, themeIcon, network, networkData) {
        this.themeToggleBtn = themeToggleBtn;
        this.themeIcon = themeIcon;
        this.network = network; // vis.js network instance
        this.networkData = networkData; // vis.js DataSets
    }

    initTheme() {
        const savedTheme = localStorage.getItem('waba-theme');
        const initialTheme = savedTheme || this.getTimeBasedTheme();
        this.setTheme(initialTheme, Boolean(savedTheme));

        // Add theme toggle listener
        this.themeToggleBtn.addEventListener('click', () => {
            this.toggleTheme();
        });
    }

    getTimeBasedTheme() {
        const hour = new Date().getHours();
        return hour >= 7 && hour < 18 ? 'light' : 'dark';
    }

    setTheme(theme, persist = true) {
        document.documentElement.setAttribute('data-theme', theme);
        if (persist) {
            localStorage.setItem('waba-theme', theme);
        } else {
            localStorage.removeItem('waba-theme');
        }

        // Update icon
        if (theme === 'light') {
            this.themeIcon.textContent = '☀️';
            this.themeToggleBtn.setAttribute('title', 'Switch to dark theme');
        } else {
            this.themeIcon.textContent = '🌙';
            this.themeToggleBtn.setAttribute('title', 'Switch to light theme');
        }
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme, true);

        // Update graph colors for new theme
        this.updateGraphTheme();
    }

    updateGraphTheme() {
        // network/networkData may be live getter functions (before the graph is
        // initialized) or the resolved vis.js objects (after init). Resolve either
        // form and bail if the graph isn't ready yet — e.g. a theme toggle while
        // Clingo-WASM is still loading.
        const network = typeof this.network === 'function' ? this.network() : this.network;
        const networkData = typeof this.networkData === 'function' ? this.networkData() : this.networkData;
        if (!network || !networkData || !networkData.edges || !networkData.nodes) return;

        // Get current theme-appropriate font settings from GraphUtils
        const edgeFontSettings = GraphUtils.getEdgeFontColor();
        const nodeFontColor = GraphUtils.getFontColor();

        // Update edge font colors (for weight labels)
        const edges = networkData.edges.get();
        const edgeUpdates = edges.map(edge => ({
            id: edge.id,
            font: {
                ...edge.font,
                ...edgeFontSettings  // Use GraphUtils settings with strokeWidth and strokeColor
            }
        }));

        networkData.edges.update(edgeUpdates);

        // Update node font colors
        const nodes = networkData.nodes.get();
        const nodeUpdates = nodes.map(node => ({
            id: node.id,
            font: {
                ...node.font,
                color: nodeFontColor  // Use GraphUtils font color
            }
        }));

        networkData.nodes.update(nodeUpdates);

        // Redraw without physics
        network.setOptions({ physics: { enabled: false } });
        network.redraw();
    }
}
