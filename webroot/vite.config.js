import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => {
  const isDev = command !== 'build';
  return {
    plugins: [vue()],
    base: './',
    resolve: {
      alias: isDev ? { kernelsu: '/src/mocks/kernelsu.js' } : {},
    },
    build: {
      outDir: '../dist/webroot',
      emptyOutDir: true,
      minify: 'rolldown',
      rollupOptions: {
        output: {
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name].[ext]',
        },
      },
    },
  };
});
