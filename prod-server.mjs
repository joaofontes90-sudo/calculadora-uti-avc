import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { searchAndFetchReports } from './src/server/telemedicinaService.js';
import { saveBackupData, listBackups, getBackupDirectory, loadBackupFile } from './src/server/backupService.js';
import { generateChecklistPdfOnServer, getPdfsDirectory } from './src/server/pdfService.js';
import {
  createLabSession,
  getLabSession,
  processLabImagesWithAI,
  renderMobileLabPage,
  saveGeminiApiKey,
  getGeminiApiKey,
} from './src/server/labScannerService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '20mb' }));
app.use(express.text({ type: 'text/plain', limit: '20mb' }));

// Endpoint: Buscar Laudos no Portal Telemedicina
app.post('/api/telemedicina/buscar-laudos', async (req, res) => {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { patientName, username, password } = body;

    if (!patientName) {
      return res.status(400).json({ success: false, error: 'Nome do paciente é obrigatório.' });
    }

    const finalUsername = username || process.env.TELEMEDICINA_USERNAME;
    const finalPassword = password || process.env.TELEMEDICINA_PASSWORD;

    const exams = await searchAndFetchReports(patientName, {
      username: finalUsername,
      password: finalPassword,
    });

    return res.status(200).json({ success: true, exams });
  } catch (err) {
    console.error('[API Telemedicina Error]', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Erro ao buscar laudos no portal.',
    });
  }
});

// Endpoints: Backup e Sincronização de Dados no Servidor
app.post('/api/backup/salvar', (req, res) => {
  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const result = saveBackupData(payload);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[Backup API Error]', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Erro ao salvar backup.',
    });
  }
});

app.get('/api/backup/listar', (req, res) => {
  try {
    const list = listBackups();
    const backupDir = getBackupDirectory();
    return res.status(200).json({ success: true, backupDir, backups: list });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

app.get('/api/backup/carregar', (req, res) => {
  try {
    const file = req.query.file ? String(req.query.file) : undefined;
    const result = loadBackupFile(file);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(200).json({ success: false, error: err?.message });
  }
});

// Endpoint: Gerar PDF dos Checklists no Servidor e retornar link público
app.post('/api/pdf/gerar-checklist', async (req, res) => {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { htmlContent, fileNamePrefix } = body;
    const result = await generateChecklistPdfOnServer(htmlContent, fileNamePrefix);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[PDF API Error]', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Erro ao gerar PDF no servidor.',
    });
  }
});

// Servir os PDFs gerados publicamente em /pdfs/:fileName
app.get('/pdfs/:fileName', (req, res) => {
  try {
    const safeName = path.basename(String(req.params.fileName || ''));
    const filePath = path.join(getPdfsDirectory(), safeName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Arquivo PDF não encontrado.');
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    return res.sendFile(filePath);
  } catch (err) {
    return res.status(500).send('Erro ao abrir PDF.');
  }
});

// Endpoints: Leitor de Exames Laboratoriais via QR Code + Celular + IA
app.post('/api/lab-scanner/criar-sessao', async (req, res) => {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const origin = body.origin || `${req.protocol}://${req.get('host')}`;
    const result = await createLabSession({
      origin,
      bedId: body.bedId,
      patientName: body.patientName,
      dayIndex: body.dayIndex,
      checklistDate: body.checklistDate,
    });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

app.get('/api/lab-scanner/status', (req, res) => {
  const sessionId = String(req.query.session || '');
  const session = getLabSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, error: 'Sessão não encontrada.' });
  }
  return res.status(200).json({
    success: true,
    status: session.status,
    extractedData: session.extractedData,
    error: session.error,
    hasApiKey: Boolean(getGeminiApiKey()),
  });
});

app.post('/api/lab-scanner/salvar-api-key', (req, res) => {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const result = saveGeminiApiKey(body.apiKey);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

app.post('/api/lab-scanner/processar', async (req, res) => {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const result = await processLabImagesWithAI({
      sessionId: body.sessionId,
      images: body.images,
      bedId: body.bedId,
      dayIndex: body.dayIndex,
    });
    return res.status(200).json(result);
  } catch (err) {
    console.error('[LabScanner Error]', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Erro ao analisar foto do exame.',
    });
  }
});

app.get('/mobile-lab', (req, res) => {
  const sessionId = String(req.query.session || '');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(renderMobileLabPage(sessionId));
});

// Servir arquivos estáticos compilados pelo Vite (pasta dist)
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Fallback SPA (React)
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Calculadora UTI-AVC] Servidor de produção rodando em http://0.0.0.0:${PORT}`);
});
