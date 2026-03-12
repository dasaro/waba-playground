/**
 * Emscripten Module configuration.
 *
 * Asset URLs are resolved relative to the current page so the playground works
 * from any GitHub Pages project path or from localhost without backend logic.
 */

window.Module = {
    locateFile(path) {
        if (!path.endsWith('.wasm') && !path.endsWith('.worker.js')) {
            return path;
        }

        return new URL(`dist/${path}`, window.location.href).toString();
    }
};
