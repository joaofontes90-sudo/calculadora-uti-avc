import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, loadEnv} from 'vite';

function telemedicinaVitePlugin(env: Record<string, string> = {}) {
  return {
    name: 'telemedicina-api-plugin',
    configureServer(server: any) {
      server.middlewares.use('/api/telemedicina/buscar-laudos', async (req: any, res: any, next: any) => {
        if (req.method !== 'POST') {
          return next();
        }

        let body = '';
        req.on('data', (chunk: any) => {
          body += chunk;
        });

        req.on('end', async () => {
          try {
            const { patientName, username, password } = JSON.parse(body || '{}');
            if (!patientName) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: 'Nome do paciente é obrigatório.' }));
              return;
            }

            const finalUsername = username || env.TELEMEDICINA_USERNAME || process.env.TELEMEDICINA_USERNAME;
            const finalPassword = password || env.TELEMEDICINA_PASSWORD || process.env.TELEMEDICINA_PASSWORD;

            const { searchAndFetchReports } = await import('./src/server/telemedicinaService.js');
            const exams = await searchAndFetchReports(patientName, { username: finalUsername, password: finalPassword });

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, exams }));
          } catch (err: any) {
            console.error('[API Telemedicina Error]', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err?.message || 'Erro ao buscar laudos no portal.' }));
          }
        });
      });
    }
  };
}

function backupVitePlugin() {
  return {
    name: 'backup-api-plugin',
    configureServer(server: any) {
      server.middlewares.use('/api/backup/salvar', async (req: any, res: any, next: any) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', (chunk: any) => { body += chunk; });
        req.on('end', async () => {
          try {
            const payload = JSON.parse(body || '{}');
            const { saveBackupData } = await import('./src/server/backupService.js');
            const result = saveBackupData(payload);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));
          } catch (err: any) {
            console.error('[Backup API Error]', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err?.message || 'Erro ao salvar backup.' }));
          }
        });
      });

      server.middlewares.use('/api/backup/listar', async (req: any, res: any, next: any) => {
        if (req.method !== 'GET') return next();
        try {
          const { listBackups, getBackupDirectory } = await import('./src/server/backupService.js');
          const list = listBackups();
          const backupDir = getBackupDirectory();
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, backupDir, backups: list }));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: err?.message }));
        }
      });

      server.middlewares.use('/api/backup/carregar', async (req: any, res: any, next: any) => {
        if (req.method !== 'GET') return next();
        try {
          const url = new URL(req.url, 'http://localhost');
          const file = url.searchParams.get('file');
          const { loadBackupFile } = await import('./src/server/backupService.js');
          const result = loadBackupFile(file || undefined);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: err?.message }));
        }
      });

      server.middlewares.use('/api/pdf/gerar-checklist', async (req: any, res: any, next: any) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', (chunk: any) => { body += chunk; });
        req.on('end', async () => {
          try {
            const { htmlContent, fileNamePrefix } = JSON.parse(body || '{}');
            const { generateChecklistPdfOnServer } = await import('./src/server/pdfService.js');
            const result = await generateChecklistPdfOnServer(htmlContent, fileNamePrefix);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err?.message || 'Erro ao gerar PDF.' }));
          }
        });
      });

      server.middlewares.use('/pdfs/', async (req: any, res: any, next: any) => {
        if (req.method !== 'GET') return next();
        try {
          const { getPdfsDirectory } = await import('./src/server/pdfService.js');
          const rawName = decodeURIComponent((req.url || '').split('?')[0].replace(/^\/+/, ''));
          const safeName = path.basename(rawName);
          const filePath = path.join(getPdfsDirectory(), safeName);
          if (!fs.existsSync(filePath)) {
            res.statusCode = 404;
            res.end('Arquivo PDF não encontrado.');
            return;
          }
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
          fs.createReadStream(filePath).pipe(res);
        } catch (err: any) {
          res.statusCode = 500;
          res.end('Erro ao abrir PDF.');
        }
      });

      server.middlewares.use('/api/lab-scanner/criar-sessao', async (req: any, res: any, next: any) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', (chunk: any) => { body += chunk; });
        req.on('end', async () => {
          try {
            const parsed = JSON.parse(body || '{}');
            const { createLabSession } = await import('./src/server/labScannerService.js');
            const result = await createLabSession({
              origin: parsed.origin || 'http://localhost:3000',
              bedId: parsed.bedId,
              patientName: parsed.patientName,
              dayIndex: parsed.dayIndex,
              checklistDate: parsed.checklistDate,
            });
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err?.message }));
          }
        });
      });

      server.middlewares.use('/api/lab-scanner/status', async (req: any, res: any, next: any) => {
        if (req.method !== 'GET') return next();
        try {
          const url = new URL(req.url, 'http://localhost');
          const sessionId = url.searchParams.get('session') || '';
          const { getLabSession, getGeminiApiKey } = await import('./src/server/labScannerService.js');
          const session = getLabSession(sessionId);
          if (!session) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Sessão não encontrada.' }));
            return;
          }
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: true,
            status: session.status,
            extractedData: session.extractedData,
            error: session.error,
            hasApiKey: Boolean(getGeminiApiKey()),
          }));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: err?.message }));
        }
      });

      server.middlewares.use('/api/lab-scanner/salvar-api-key', async (req: any, res: any, next: any) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', (chunk: any) => { body += chunk; });
        req.on('end', async () => {
          try {
            const parsed = JSON.parse(body || '{}');
            const { saveGeminiApiKey } = await import('./src/server/labScannerService.js');
            const result = saveGeminiApiKey(parsed.apiKey);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err?.message }));
          }
        });
      });

      server.middlewares.use('/api/lab-scanner/processar', async (req: any, res: any, next: any) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', (chunk: any) => { body += chunk; });
        req.on('end', async () => {
          try {
            const parsed = JSON.parse(body || '{}');
            const { processLabImagesWithAI } = await import('./src/server/labScannerService.js');
            const result = await processLabImagesWithAI({
              sessionId: parsed.sessionId,
              images: parsed.images,
              bedId: parsed.bedId,
              dayIndex: parsed.dayIndex,
            });
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err?.message || 'Erro ao analisar foto do exame.' }));
          }
        });
      });

      server.middlewares.use('/mobile-lab', async (req: any, res: any, next: any) => {
        if (req.method !== 'GET') return next();
        try {
          const url = new URL(req.url, 'http://localhost');
          const sessionId = url.searchParams.get('session') || '';
          const { renderMobileLabPage } = await import('./src/server/labScannerService.js');
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(renderMobileLabPage(sessionId));
        } catch (err: any) {
          res.statusCode = 500;
          res.end('Erro ao carregar página mobile.');
        }
      });
    }
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), telemedicinaVitePlugin(env), backupVitePlugin()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
