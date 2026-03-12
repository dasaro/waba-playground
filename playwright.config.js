import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/browser',
    timeout: 120000,
    use: {
        baseURL: 'http://127.0.0.1:4173',
        headless: true
    },
    webServer: {
        command: 'npx http-server -p 4173 -c-1',
        port: 4173,
        reuseExistingServer: true,
        timeout: 120000
    }
});
