/**
 * ThemeManager - Handles dark/light theme switching
 */
import { GraphUtils } from './graph-utils.js?v=20260315-1';

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
        if (!this.network) return;

        // Get current theme-appropriate font settings from GraphUtils
        const edgeFontSettings = GraphUtils.getEdgeFontColor();
        const nodeFontColor = GraphUtils.getFontColor();

        // Update edge font colors (for weight labels)
        const edges = this.networkData.edges.get();
        const edgeUpdates = edges.map(edge => ({
            id: edge.id,
            font: {
                ...edge.font,
                ...edgeFontSettings  // Use GraphUtils settings with strokeWidth and strokeColor
            }
        }));

        this.networkData.edges.update(edgeUpdates);

        // Update node font colors
        const nodes = this.networkData.nodes.get();
        const nodeUpdates = nodes.map(node => ({
            id: node.id,
            font: {
                ...node.font,
                color: nodeFontColor  // Use GraphUtils font color
            }
        }));

        this.networkData.nodes.update(nodeUpdates);

        // Redraw without physics
        this.network.setOptions({ physics: { enabled: false } });
        this.network.redraw();
    }
}
