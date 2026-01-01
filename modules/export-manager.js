/**
 * ExportManager - PNG/PDF export with watermarks
 */
export class ExportManager {
    constructor(graphManager, exportPngBtn, exportPdfBtn, app) {
        this.graphManager = graphManager;
        this.exportPngBtn = exportPngBtn;
        this.exportPdfBtn = exportPdfBtn;
        this.app = app;  // App instance for exportGraphInLightMode

        this.attachEventListeners();
    }

    attachEventListeners() {
        this.exportPngBtn.addEventListener('click', () => this.exportGraphAsPng());
        this.exportPdfBtn.addEventListener('click', () => this.exportGraphAsPdf());
    }

    addWatermark(sourceCanvas) {
        // Create a new canvas with watermark
        const watermarkedCanvas = document.createElement('canvas');
        watermarkedCanvas.width = sourceCanvas.width;
        watermarkedCanvas.height = sourceCanvas.height;
        const ctx = watermarkedCanvas.getContext('2d');

        // Draw original canvas
        ctx.drawImage(sourceCanvas, 0, 0);

        // Add watermark in bottom-right corner
        ctx.save();

        // Generate timestamp
        const now = new Date();
        const dateTime = now.toISOString().slice(0, 19).replace('T', ' ');

        // Watermark text
        const line1 = `Generated with WABA Playground by Fabio Aurelio d'Asaro (${dateTime})`;
        const line2 = 'https://github.com/dasaro/waba-playground';

        // Small font
        const fontSize = 11;
        ctx.font = `${fontSize}px Arial`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';

        const padding = 8;
        const lineHeight = fontSize + 3;
        const x = watermarkedCanvas.width - padding;
        const y2 = watermarkedCanvas.height - padding;
        const y1 = y2 - lineHeight;

        // Measure text to create background rectangle
        const text1Width = ctx.measureText(line1).width;
        const text2Width = ctx.measureText(line2).width;
        const maxWidth = Math.max(text1Width, text2Width);

        const bgPadding = 4;
        const bgX = x - maxWidth - bgPadding;
        const bgY = y1 - fontSize - bgPadding;
        const bgWidth = maxWidth + bgPadding * 2;
        const bgHeight = lineHeight * 2 + bgPadding * 2;

        // Draw white background rectangle
        ctx.fillStyle = 'white';
        ctx.fillRect(bgX, bgY, bgWidth, bgHeight);

        // Draw black text
        ctx.fillStyle = 'black';
        ctx.fillText(line1, x, y1);
        ctx.fillText(line2, x, y2);

        ctx.restore();
        return watermarkedCanvas;
    }

    exportGraphAsPng() {
        if (!this.graphManager.network) {
            alert('No graph to export. Please run WABA first.');
            return;
        }

        // Export in light mode
        this.app.exportGraphInLightMode(() => {
            const sourceCanvas = this.graphManager.network.canvas.frame.canvas;
            const watermarkedCanvas = this.addWatermark(sourceCanvas);

            watermarkedCanvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'waba-graph.png';
                link.click();
                URL.revokeObjectURL(url);
            });
        });
    }

    exportGraphAsPdf() {
        if (!this.graphManager.network) {
            alert('No graph to export. Please run WABA first.');
            return;
        }

        // Export in light mode
        this.app.exportGraphInLightMode(() => {
            const sourceCanvas = this.graphManager.network.canvas.frame.canvas;
            const watermarkedCanvas = this.addWatermark(sourceCanvas);

            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            watermarkedCanvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `waba-graph-${timestamp}.png`;
                link.click();
                URL.revokeObjectURL(url);
            }, 'image/png', 1.0);  // Quality 1.0 for high-resolution export
        });
    }
}
