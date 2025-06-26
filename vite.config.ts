import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.REPLICATE_API_TOKEN': JSON.stringify(env.REPLICATE_API_TOKEN)
      },
      server: {
        proxy: {
          '/api/replicate': {
            target: 'https://api.replicate.com/v1',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/replicate/, ''),
            headers: {
              'Authorization': `Token ${env.REPLICATE_API_TOKEN}`,
            }
          }
        }
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
