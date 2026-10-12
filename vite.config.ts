import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { processHallTicketExtraction } from './api/extract-hallticket';

// Dev middleware plugin to serve /api/extract-hallticket during local development
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
            try {
              const { imageBase64, mimeType } = JSON.parse(body);
              if (!imageBase64 || !mimeType) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: 'Missing imageBase64 or mimeType' }));
                return;
              }
              const data = await processHallTicketExtraction(imageBase64, mimeType);
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, data }));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message || 'Extraction failed' }));
            }
          });
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), serverlessDevPlugin()],
  server: {
    port: 5173,
    host: true,
  },
});
