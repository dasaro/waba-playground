// WABA Playground bootstrap
// VERSION: 20260706-5 - managed via core/app-version.js and release scripts

import { createDomRegistry } from './core/dom-registry.js?v=20260706-5';
import { createStore } from './core/store.js?v=20260706-5';
import { PlaygroundController } from './features/playground-controller.js?v=20260706-5';
import { examples } from './examples.js?v=20260706-5';
import { APP_VERSION } from './core/app-version.js?v=20260706-5';

document.addEventListener('DOMContentLoaded', async () => {
    const dom = createDomRegistry(document);
    const store = createStore({
        originalWabaContent: null,
        currentFrameworkCode: '',
        currentGraphMode: 'standard'
    });

    const playground = new PlaygroundController(dom, store);
    await playground.init();

    window.playground = playground;
    window.WABAExamples = examples;
    window.WABA_APP_VERSION = APP_VERSION;
});
