import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';
import pkg from './package.json';

function getGitCommitHash(): string {
  if (process.env.COMMIT_HASH) return process.env.COMMIT_HASH;
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return '0545f41';
  }
}

const commitHash = getGitCommitHash();
const appVersion = `v${pkg.version || '1.0.0'}`;
const buildTime = new Date().toISOString();

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __COMMIT_HASH__: JSON.stringify(commitHash),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  build: {
    outDir: '../NijiPanel.Backend/wwwroot',
    emptyOutDir: true,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-icons': ['lucide-react'],
          'vendor-monaco': ['@monaco-editor/react'],
          'vendor-terminal': ['@xterm/xterm', '@xterm/addon-fit'],
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:5000',
        ws: true,
      },
    },
  },
});
