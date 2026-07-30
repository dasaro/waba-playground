/**
 * ThemeManager - Handles dark/light theme switching
 */
import { GraphUtils } from './graph-utils.js?v=20260730-36';

export class ThemeManager {
    constructor(themeToggleBtn, themeIcon, network, networkData, onGraphRestyled = null) {
        this.themeToggleBtn = themeToggleBtn;
        this.themeIcon = themeIcon;
        this.network = network; // vis.js network instance
        this.networkData = networkData; // vis.js DataSets
        // Called after the base restyle so a live extension highlight can be re-derived from
        // the new palette. Without it, highlighted elements keep the OUTGOING theme's colours:
        // in light theme the selected extension's own nodes stayed near-black.
        this.onGraphRestyled = onGraphRestyled;
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
        // The palette is cached per theme, so drop it before anything reads a colour --
        // otherwise the whole graph restyles itself with the OUTGOING theme's values.
        GraphUtils.invalidatePalette();
        if (!network || !networkData || !networkData.edges || !networkData.nodes) return;

        const p = GraphUtils.palette();

        // Restyle the whole graph, not just the fonts. This used to update font colours only,
        // so flipping to the light theme left every line, border and fill at its dark-tuned
        // value -- it did not restyle the graph, it just removed the contrast that had been
        // making it readable. Now that every colour comes from a token, re-reading the palette
        // is the entire fix.
        network.setOptions({
            nodes: { font: { color: p.ink } },
            edges: { font: { color: p.line, background: p.canvas } }
        });

        const edges = networkData.edges.get();
        networkData.edges.update(edges.map((edge) => ({
            id: edge.id,
            font: { ...edge.font, color: p.line, background: p.canvas, strokeWidth: 0 },
            // Reset to base unconditionally; the highlight is re-applied below, against the
            // NEW palette. Skipping highlighted elements froze them at the old theme's values.
            color: { color: p.line, highlight: p.lineStrong, hover: p.lineStrong },
            width: edge.baseWidth || edge.originalWidth || 2,
            dashes: false
        })));

        const nodes = networkData.nodes.get();
        networkData.nodes.update(nodes.map((node) => ({
            id: node.id,
            font: { ...node.font, color: p.ink },
            color: {
                background: node.shape === 'diamond' ? p.canvas : p.surface,
                border: p.line,
                highlight: { background: node.shape === 'diamond' ? p.canvas : p.surface, border: p.lineStrong }
            },
            borderWidth: 2
        })));

        network.setOptions({ physics: { enabled: false } });
        network.redraw();

        // Re-derive any live highlight against the palette that is now current.
        if (typeof this.onGraphRestyled === 'function') {
            this.onGraphRestyled();
        }
    }
}
