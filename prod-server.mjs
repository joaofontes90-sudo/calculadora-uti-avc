import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { searchAndFetchReports } from './src/server/telemedicinaService.js';
import { saveBackupData, listBackups, getBackupDirectory, loadBackupFile } from './src/server/backupService.js';

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
