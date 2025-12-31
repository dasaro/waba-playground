/**
 * ThemeManager - Handles dark/light theme switching
 */
export class ThemeManager {
    constructor(themeToggleBtn, themeIcon, network, networkData) {
        this.themeToggleBtn = themeToggleBtn;
        this.themeIcon = themeIcon;
        this.network = network; // vis.js network instance
        this.networkData = networkData; // vis.js DataSets
    }

    initTheme() {
        // Load saved theme or default to dark
        const savedTheme = localStorage.getItem('waba-theme') || 'dark';
        this.setTheme(savedTheme);

        // Add theme toggle listener
        this.themeToggleBtn.addEventListener('click', () => {
            this.toggleTheme();
        });
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('waba-theme', theme);

        // Update icon
        if (theme === 'light') {
            this.themeIcon.textContent = '☀️';
        } else {
            this.themeIcon.textContent = '🌙';
        }
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);

        // Update graph colors for new theme
        this.updateGraphTheme();
    }

    updateGraphTheme() {
        if (!this.network) return;

        const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

        // Update edge font colors (for weight labels)
        const edges = this.networkData.edges.get();
        const edgeUpdates = edges.map(edge => ({
            id: edge.id,
            font: {
                ...edge.font,
                color: isDark ? '#cbd5e1' : '#64748b',
                background: isDark ? '#1e293b' : '#ffffff'
            }
        }));

        this.networkData.edges.update(edgeUpdates);

        // Update node font colors
        const nodes = this.networkData.nodes.get();
        const nodeUpdates = nodes.map(node => ({
            id: node.id,
            font: {
                ...node.font,
                color: isDark ? '#f1f5f9' : '#1e293b'
            }
        }));

        this.networkData.nodes.update(nodeUpdates);

        // Redraw without physics
        this.network.setOptions({ physics: { enabled: false } });
        this.network.redraw();
    }
}
