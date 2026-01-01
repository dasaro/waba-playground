/**
 * Emscripten Module Configuration
 * CRITICAL: Must load BEFORE clingo.web.js
 *
 * Configures where Emscripten should locate WASM files for both
 * GitHub Pages deployment and local development.
 */

var Module = {
    locateFile: function(path) {
        // Only handle WASM and worker files
        if (!path.endsWith('.wasm') && !path.endsWith('.worker.js')) {
            return path;
        }

        const isGitHubPages = window.location.hostname === 'dasaro.github.io';

        if (isGitHubPages) {
            // GitHub Pages: Use absolute URL to dist/ directory
            return 'https://dasaro.github.io/waba-playground/dist/' + path;
        } else {
            // Local development: Use relative path to dist/ directory
            const currentUrl = window.location.href;
            const baseUrl = currentUrl.substring(0, currentUrl.lastIndexOf('/') + 1);
            return baseUrl + 'dist/' + path;
        }
    }
};
