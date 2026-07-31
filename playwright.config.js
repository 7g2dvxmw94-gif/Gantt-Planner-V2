import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE_PATH = '/Gantt-Planner-V2/';
const baseURL = `http://localhost:${PORT}${BASE_PATH}`;

export default defineConfig({
    testDir: './e2e/tests',
    fullyParallel: false,
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    timeout: 30_000,

    use: {
        ...devices['Desktop Chrome'],
        baseURL,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        actionTimeout: 10_000,
        ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
            ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
            : {}),
        // Certains postes de dev passent par un proxy HTTPS local
        // (variable HTTPS_PROXY) pour toute sortie réseau — la CDN Supabase
        // (import ES module) en a besoin pour se charger.
        ...(!process.env.CI && process.env.HTTPS_PROXY
            ? { proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } }
            : {}),
    },

    webServer: {
        command: `node e2e/server/static-server.js`,
        url: baseURL + 'index.html',
        reuseExistingServer: !process.env.CI,
        env: { E2E_PORT: String(PORT), E2E_BASE_PATH: BASE_PATH },
        stdout: 'pipe',
    },

    projects: [
        {
            name: 'setup',
            testDir: './',
            testMatch: '**/auth.setup.js',
        },
        {
            name: 'chromium',
            use: {
                storageState: 'e2e/.auth/user.json',
            },
            dependencies: ['setup'],
        },
    ],
});
