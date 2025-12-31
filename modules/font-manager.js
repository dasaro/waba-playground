/**
 * FontManager - Handles font size controls
 */
export class FontManager {
    constructor(fontIncreaseBtn, fontDecreaseBtn) {
        this.fontIncreaseBtn = fontIncreaseBtn;
        this.fontDecreaseBtn = fontDecreaseBtn;
        this.currentFontSize = 100; // Base font size percentage
    }

    initFontSize() {
        // Load saved font size or default to 100%
        const savedFontSize = localStorage.getItem('waba-font-size') || '100';
        this.currentFontSize = parseInt(savedFontSize);
        this.setFontSize(this.currentFontSize);

        // Add font size control listeners
        this.fontIncreaseBtn.addEventListener('click', () => {
            this.increaseFontSize();
        });

        this.fontDecreaseBtn.addEventListener('click', () => {
            this.decreaseFontSize();
        });
    }

    setFontSize(percentage) {
        // Clamp between 60% and 200%
        percentage = Math.max(60, Math.min(200, percentage));
        this.currentFontSize = percentage;

        // Apply to document root
        document.documentElement.style.fontSize = `${percentage}%`;
        localStorage.setItem('waba-font-size', percentage.toString());
    }

    increaseFontSize() {
        this.setFontSize(this.currentFontSize + 10);
    }

    decreaseFontSize() {
        this.setFontSize(this.currentFontSize - 10);
    }
}
