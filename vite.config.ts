import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { processHallTicketExtraction } from './api/extract-hallticket.ts';
import { processAiCourseMatch } from './api/ai-match-course.ts';

// Dev middleware plugin to serve serverless endpoints during local development
function serverlessDevPlugin(): Plugin {
  return {
    name: 'serverless-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/extract-hallticket' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk;
          });
          req.on('end', async () => {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            try {
              const { imageBase64, mimeType } = JSON.parse(body);
              body = ''; // In-memory dereferencing
              if (!imageBase64 || !mimeType) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: 'Missing imageBase64 or mimeType' }));
                return;
              }
              const data = await processHallTicketExtraction(imageBase64, mimeType);
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, data }));
            } catch (err: any) {
              body = '';
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message || 'Extraction failed' }));
            }
          });
          return;
        }

        if (req.url === '/api/ai-match-course' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk;
          });
          req.on('end', async () => {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
            try {
              const { query, candidates } = JSON.parse(body);
              body = '';
              const data = await processAiCourseMatch(query, candidates);
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, data }));
            } catch (err: any) {
              body = '';
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message || 'Course match failed' }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
  }
  if (env.GEMINI_MODEL) {
    process.env.GEMINI_MODEL = env.GEMINI_MODEL;
  }

  return {
    plugins: [react(), serverlessDevPlugin()],
    server: {
      port: 5173,
      host: true,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom')) {
                return 'vendor';
              }
              if (id.includes('@supabase')) {
                return 'supabase';
              }
              if (id.includes('lucide-react')) {
                return 'icons';
              }
            }
          },
        },
      },
      chunkSizeWarningLimit: 600,
    },
  };
});
