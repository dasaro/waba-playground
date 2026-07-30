export class DocsController {
    constructor(dom, uiManager, panelManager) {
        this.dom = dom;
        this.uiManager = uiManager;
        this.panelManager = panelManager;
    }

    init() {
        ['config', 'editor', 'graph', 'output'].forEach((panelId) => {
            this.panelManager.registerPanel(panelId, true);
        });

        this.dom.syntaxGuideBtn.addEventListener('click', () => this.uiManager.openSyntaxGuide());
        this.dom.syntaxGuideClose.addEventListener('click', () => this.uiManager.closeSyntaxGuide());
        this.dom.syntaxGuideModal.addEventListener('click', (event) => {
            if (event.target === this.dom.syntaxGuideModal) {
                this.uiManager.closeSyntaxGuide();
            }
        });

        this.dom.docTabs.forEach((tab) => {
            tab.addEventListener('click', () => this.switchDocTab(tab.dataset.tab));
        });

        this.dom.panelToggles.forEach((button) => {
            button.addEventListener('click', (event) => {
                const panel = event.target.closest('.panel');
                if (!panel) {
                    return;
                }
                this.panelManager.togglePanel(panel.dataset.panel);
            });
        });

        this.dom.legendToggleBtn.addEventListener('click', () => this.toggleLegend());
    }

    setLegendMode(graphMode) {
        // Standard mode draws a set-level graph; the Assumption-* modes draw the
        // assumption-level graph. Show only the matching legend variant.
        const variant = graphMode === 'standard' ? 'standard' : 'assumption';
        this.dom.graphLegend.querySelectorAll('.legend-variant').forEach((element) => {
            if (element.dataset.legendMode === variant) {
                element.removeAttribute('hidden');
            } else {
                element.setAttribute('hidden', '');
            }
        });
    }

    toggleLegend() {
        const isHidden = this.dom.graphLegend.hasAttribute('hidden');
        if (isHidden) {
            this.dom.graphLegend.removeAttribute('hidden');
            this.dom.legendToggleBtn.setAttribute('aria-expanded', 'true');
        } else {
            this.dom.graphLegend.setAttribute('hidden', '');
            this.dom.legendToggleBtn.setAttribute('aria-expanded', 'false');
        }
    }

    switchDocTab(targetTab) {
        this.dom.docTabs.forEach((tab) => {
            const isActive = tab.dataset.tab === targetTab;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        this.dom.docTabContents.forEach((content) => {
            const isActive = content.id === `tab-${targetTab}`;
            content.classList.toggle('active', isActive);
            if (isActive) {
                content.removeAttribute('hidden');
            } else {
                content.setAttribute('hidden', '');
            }
        });
    }
}
