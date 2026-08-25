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
    /* 60 s, contre 30 auparavant. Le test le plus long en tourne environ 16 ;
       les 30 s laissaient donc peu d'air quand l'application démarrait
       lentement, et un test pouvait expirer alors qu'il aurait abouti.
       Allonger ce budget ne masque rien : un test réellement bloqué échoue
       toujours, simplement trente secondes plus tard. */
    timeout: 60_000,

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
            /* Le setup fait bien plus qu'un test : connexion, attente de
               l'init, vérification du projet seed, écriture du storageState —
               et désormais jusqu'à trois tentatives de connexion espacées.
               Le budget commun ne pouvait pas les contenir. */
            timeout: 180_000,
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
