import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.js';

export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/test/**',
        'src/types/**',
        'src/main.tsx',
        'src/components/ui/**',
        'src/components/Hero.tsx',
        'src/components/HowItWorks.tsx',
        'src/components/Newsletter.tsx',
        'src/components/Footer.tsx',
        'src/pages/HomePage.tsx',
        'src/pages/DashboardPage.tsx',
        'src/pages/UserDashboardPage.tsx',
      ],
    },
  },
}));
