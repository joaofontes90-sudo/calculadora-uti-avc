import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { GoogleGenAI } from '@google/genai';
import { getBackupDirectory, loadBackupFile, saveBackupData } from './backupService.js';

const labSessions = new Map();

function getGeminiConfigPath() {
  return path.join(getBackupDirectory(), 'gemini_config.json');
}

export function getGeminiApiKey() {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '') {
    return process.env.GEMINI_API_KEY.trim();
  }
  try {
    const cfgPath = getGeminiConfigPath();
    if (fs.existsSync(cfgPath)) {
      const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      if (parsed?.apiKey && String(parsed.apiKey).trim() !== '') {
        return String(parsed.apiKey).trim();
      }
    }
  } catch (e) {}
  return '';
}

export function saveGeminiApiKey(apiKey) {
  const cleanKey = String(apiKey || '').trim();
  const cfgPath = getGeminiConfigPath();
  fs.writeFileSync(cfgPath, JSON.stringify({ apiKey: cleanKey, updatedAt: new Date().toISOString() }, null, 2), 'utf-8');
  process.env.GEMINI_API_KEY = cleanKey;
  return { success: true, hasKey: Boolean(cleanKey) };
}

export function normalizeDateToDDMMAA(rawDate) {
  if (!rawDate) return '';
  const str = String(rawDate).trim();
  const match = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (!match) return '';
  const dd = match[1].padStart(2, '0');
  const mm = match[2].padStart(2, '0');
  const yy = match[3].length === 4 ? match[3].slice(-2) : match[3].padStart(2, '0');
  return `${dd}/${mm}/${yy}`;
}

export async function createLabSession({ origin, bedId, patientName, dayIndex, checklistDate }) {
  const sessionId = 'lab_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  const mobileUrl = `${origin}/mobile-lab?session=${encodeURIComponent(sessionId)}`;
  const qrDataUrl = await QRCode.toDataURL(mobileUrl, {
    width: 300,
    margin: 1,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });

  const sessionObj = {
    sessionId,
    bedId: Number(bedId),
    patientName: patientName || `Leito ${bedId}`,
    dayIndex: Number(dayIndex || 0),
    checklistDate: checklistDate || '',
    mobileUrl,
    qrDataUrl,
    status: 'waiting', // 'waiting' | 'processing' | 'done' | 'error'
    extractedData: null,
    error: null,
    createdAt: Date.now(),
  };

  labSessions.set(sessionId, sessionObj);

  // Limpa sessões antigas (> 2 horas)
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  for (const [k, v] of labSessions.entries()) {
    if (v.createdAt < twoHoursAgo) {
      labSessions.delete(k);
    }
  }

  return {
    success: true,
    sessionId,
    mobileUrl,
    qrDataUrl,
    hasApiKey: Boolean(getGeminiApiKey()),
  };
}

export function getLabSession(sessionId) {
  return labSessions.get(sessionId) || null;
}

export async function processLabImagesWithAI({ sessionId, images, bedId, dayIndex }) {
  const session = sessionId ? labSessions.get(sessionId) : null;
  if (session) {
    session.status = 'processing';
    session.error = null;
  }

  try {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      throw new Error('Chave da API do Google Gemini não configurada. Clique no ícone de chave no topo para salvar.');
    }

    if (!Array.isArray(images) || images.length === 0) {
      throw new Error('Nenhuma foto de exame foi enviada.');
    }

    const ai = new GoogleGenAI({ apiKey });

    const imageParts = images.map((img) => {
      let base64 = String(img.base64Data || img.data || '');
      let mimeType = img.mimeType || 'image/jpeg';
      if (base64.includes('base64,')) {
        const [header, b64] = base64.split('base64,');
        base64 = b64;
        const mimeMatch = header.match(/data:([^;]+);/);
        if (mimeMatch) mimeType = mimeMatch[1];
      }
      return {
        inlineData: {
          mimeType,
          data: base64.trim(),
        },
      };
    });

    const prompt = `Extraia da(s) foto(s) de exame laboratorial APENAS os 9 exames abaixo e a data do exame.
REGRAS:
1. Ignore os "Valores de Referência". Extraia SOMENTE o resultado do paciente.
2. Se um exame não constar na foto, retorne "".
3. Formate "examDate" como "DD/MM/AA" (ex: "05/11/26").
4. Extraia APENAS:
   - examDate (Data da coleta/exame em DD/MM/AA)
   - checklistHb (Hemoglobina / Hb)
   - checklistHt (Hematócrito / Ht)
   - checklistPlaquetas (Plaquetas)
   - checklistLeucograma (Leucócitos totais / Leucograma)
   - checklistBastoes (Bastões / Bastonetes)
   - checklistSodio (Sódio / Na)
   - checklistPotassio (Potássio / K)
   - checklistUreia (Ureia)
   - checklistCreatinina (Creatinina)

Retorne SOMENTE este JSON válido:
{
  "examDate": "",
  "checklistHb": "",
  "checklistHt": "",
  "checklistPlaquetas": "",
  "checklistLeucograma": "",
  "checklistBastoes": "",
  "checklistSodio": "",
  "checklistPotassio": "",
  "checklistUreia": "",
  "checklistCreatinina": ""
}`;

    const callGeminiModel = async (modelId) => {
      const cleanModel = modelId.replace(/^models\//, '');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const body = {
        contents: [
          {
            role: 'user',
            parts: [...imageParts, { text: prompt }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        const errMsg = data?.error?.message || JSON.stringify(data);
        const err = new Error(`[${cleanModel}] ${errMsg}`);
        err.status = res.status;
        throw err;
      }

      const textOut = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
      if (!textOut) {
        throw new Error(`Resposta vazia do modelo ${cleanModel}.`);
      }
      return textOut;
    };

    // Descobre automaticamente os modelos Flash disponíveis na conta caso necessário
    let candidateModels = ['gemini-3.8-flash', 'gemini-3.0-flash', 'gemini-3-flash-preview', 'gemini-2.0-flash'];
    try {
      const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
      if (listRes.ok) {
        const listData = await listRes.json();
        const availableFlashModels = (listData.models || [])
          .filter(
            (m) =>
              Array.isArray(m.supportedGenerationMethods) &&
              m.supportedGenerationMethods.includes('generateContent') &&
              m.name &&
              m.name.includes('gemini') &&
              m.name.includes('flash') &&
              !m.name.includes('2.5') &&
              !m.name.includes('1.5') &&
              !m.name.includes('tts') &&
              !m.name.includes('image') &&
              !m.name.includes('audio')
          )
          .map((m) => m.name.replace(/^models\//, ''))
          .reverse();

        if (availableFlashModels.length > 0) {
          candidateModels = [...new Set(['gemini-3.8-flash', ...availableFlashModels])];
        }
      }
    } catch (e) {}

    let rawText = '';
    let errorsLog = [];

    for (const modelName of candidateModels) {
      try {
        rawText = await callGeminiModel(modelName);
        if (rawText) break;
      } catch (err) {
        errorsLog.push(err.message);
      }
    }

    if (!rawText) {
      throw new Error(errorsLog[0] || 'Não foi possível obter resposta da API do Gemini.');
    }
    const cleanedJson = rawText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    const extracted = JSON.parse(cleanedJson);
    extracted.examDate = normalizeDateToDDMMAA(extracted.examDate);

    // Atualiza também diretamente o backup no servidor na coluna da data correspondente (ou primeira coluna vazia)
    const targetBedId = session ? session.bedId : Number(bedId);
    const fallbackDayIndex = session ? session.dayIndex : Number(dayIndex || 0);

    let resolvedColumnIndex = fallbackDayIndex;

    if (targetBedId) {
      try {
        const latestBackup = loadBackupFile();
        if (latestBackup?.success && Array.isArray(latestBackup?.data?.patients)) {
          const patients = latestBackup.data.patients;
          const pIdx = patients.findIndex((p) => Number(p.id) === Number(targetBedId));
          if (pIdx !== -1) {
            const patient = patients[pIdx];
            const lists = Array.isArray(patient.dailyChecklists) ? [...patient.dailyChecklists] : [];

            if (extracted.examDate) {
              const existingIdx = lists.findIndex(
                (col) => col && normalizeDateToDDMMAA(col.checklistData) === extracted.examDate
              );
              if (existingIdx !== -1) {
                resolvedColumnIndex = existingIdx;
              } else {
                const firstEmptyIdx = lists.findIndex((col) => !col || !col.checklistData || col.checklistData.trim() === '');
                if (firstEmptyIdx !== -1) {
                  resolvedColumnIndex = firstEmptyIdx;
                }
              }
            }

            if (lists[resolvedColumnIndex]) {
              const currentDay = { ...lists[resolvedColumnIndex] };
              const fieldsToMerge = [
                'checklistHb',
                'checklistHt',
                'checklistPlaquetas',
                'checklistLeucograma',
                'checklistBastoes',
                'checklistSodio',
                'checklistPotassio',
                'checklistUreia',
                'checklistCreatinina',
              ];

              for (const field of fieldsToMerge) {
                if (extracted[field] && String(extracted[field]).trim() !== '') {
                  currentDay[field] = String(extracted[field]).trim();
                }
              }

              if (extracted.examDate) {
                currentDay.checklistData = extracted.examDate;
              }

              lists[resolvedColumnIndex] = currentDay;
              patients[pIdx] = {
                ...patient,
                dailyChecklists: lists,
                ...(resolvedColumnIndex === 0 ? currentDay : {}),
              };

              saveBackupData({
                patients,
                archivedPatients: latestBackup.data.archivedPatients || [],
              });
            }
          }
        }
      } catch (e) {
        console.warn('[LabScanner] Aviso ao mesclar no backup do servidor:', e.message);
      }
    }

    extracted.resolvedColumnIndex = resolvedColumnIndex;

    if (session) {
      session.status = 'done';
      session.extractedData = extracted;
    }

    return {
      success: true,
      extractedData: extracted,
    };
  } catch (err) {
    if (session) {
      session.status = 'error';
      session.error = err?.message || 'Erro ao analisar foto do exame.';
    }
    throw err;
  }
}

export function renderMobileLabPage(sessionId) {
  const session = labSessions.get(sessionId);
  if (!session) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sessão Expirada - UAVC</title>
</head>
<body style="font-family: sans-serif; background:#0f172a; color:#fff; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; padding:20px; text-align:center;">
  <div style="background:#1e293b; padding:28px; border-radius:18px; max-width:380px;">
    <h2 style="margin-top:0; color:#f87171;">QR Code Expirado</h2>
    <p style="font-size:14px; color:#cbd5e1; line-height:1.5;">Gere um novo QR Code na tela do computador e escaneie novamente.</p>
  </div>
</body>
</html>`;
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Leitor de Exames IA — Leito ${session.bedId}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      margin: 0;
      padding: 16px;
      min-height: 100vh;
    }
    .card {
      max-width: 480px;
      margin: 0 auto;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 20px;
      padding: 20px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.4);
    }
    .badge {
      display: inline-block;
      background: #2563eb;
      color: #fff;
      font-weight: 900;
      font-size: 11px;
      padding: 4px 10px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    h1 {
      font-size: 18px;
      font-weight: 900;
      margin: 10px 0 4px;
      text-transform: uppercase;
    }
    .sub {
      font-size: 13px;
      color: #94a3b8;
      margin-bottom: 18px;
      font-weight: 600;
    }
    .btn-camera {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      padding: 16px;
      background: #2563eb;
      color: #fff;
      border: none;
      border-radius: 14px;
      font-size: 15px;
      font-weight: 900;
      text-transform: uppercase;
      cursor: pointer;
      margin-bottom: 10px;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
    }
    .btn-gallery {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 13px;
      background: #334155;
      color: #e2e8f0;
      border: 1px solid #475569;
      border-radius: 14px;
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      cursor: pointer;
      margin-bottom: 16px;
    }
    .photos-list {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 16px;
    }
    .photo-item {
      position: relative;
      border-radius: 10px;
      overflow: hidden;
      border: 2px solid #475569;
      aspect-ratio: 3/4;
      background: #0f172a;
    }
    .photo-item img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .photo-remove {
      position: absolute;
      top: 4px;
      right: 4px;
      background: rgba(220, 38, 38, 0.9);
      color: #fff;
      border: none;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      font-weight: 900;
      font-size: 14px;
      cursor: pointer;
    }
    .btn-send {
      width: 100%;
      padding: 16px;
      background: #10b981;
      color: #fff;
      border: none;
      border-radius: 14px;
      font-size: 15px;
      font-weight: 900;
      text-transform: uppercase;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);
    }
    .btn-send:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .status-box {
      margin-top: 16px;
      padding: 14px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 700;
      line-height: 1.4;
      display: none;
    }
    .results-grid {
      margin-top: 12px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      text-align: left;
    }
    .res-item {
      background: #0f172a;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid #334155;
      font-size: 12px;
    }
    .res-label {
      color: #94a3b8;
      font-size: 10px;
      text-transform: uppercase;
      display: block;
    }
    .res-val {
      color: #34d399;
      font-weight: 900;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Leito ${session.bedId}</span>
    <h1>${session.patientName}</h1>
    <div class="sub">Fotografe a folha A4 para extrair Hemograma (Hb, Ht, Plaq, Leuco, Bastões) e Na, K, Ureia, Creatinina + Data do Exame.</div>

    <input type="file" id="cameraInput" accept="image/*" capture="environment" style="display:none" />
    <input type="file" id="galleryInput" accept="image/*" multiple style="display:none" />

    <button type="button" class="btn-camera" onclick="document.getElementById('cameraInput').click()">
      📸 Tirar Foto da Folha A4
    </button>
    <button type="button" class="btn-gallery" onclick="document.getElementById('galleryInput').click()">
      🖼️ Escolher da Galeria (Várias Fotos)
    </button>

    <div id="photosContainer" class="photos-list"></div>

    <button type="button" id="sendBtn" class="btn-send" style="display:none" onclick="sendPhotos()">
      ✨ Ler Exames com IA e Preencher Leito
    </button>

    <div id="statusBox" class="status-box"></div>
    <div id="resultsContainer" class="results-grid"></div>
  </div>

  <script>
    const sessionId = ${JSON.stringify(session.sessionId)};
    let photos = [];

    function compressImage(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const maxDim = 1200;
            let w = img.width;
            let h = img.height;
            if (w > maxDim || h > maxDim) {
              if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
              } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.80);
            resolve({ mimeType: 'image/jpeg', base64Data: dataUrl });
          };
          img.onerror = reject;
          img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    async function handleFiles(fileList) {
      for (const file of Array.from(fileList)) {
        try {
          const compressed = await compressImage(file);
          photos.push(compressed);
        } catch (err) {
          alert('Erro ao carregar foto.');
        }
      }
      renderPhotos();
    }

    document.getElementById('cameraInput').addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
        e.target.value = '';
      }
    });

    document.getElementById('galleryInput').addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
        e.target.value = '';
      }
    });

    function removePhoto(idx) {
      photos.splice(idx, 1);
      renderPhotos();
    }

    function renderPhotos() {
      const container = document.getElementById('photosContainer');
      const sendBtn = document.getElementById('sendBtn');
      container.innerHTML = photos.map((p, idx) => \`
        <div class="photo-item">
          <img src="\${p.base64Data}" />
          <button type="button" class="photo-remove" onclick="removePhoto(\${idx})">×</button>
        </div>
      \`).join('');
      sendBtn.style.display = photos.length > 0 ? 'block' : 'none';
      sendBtn.innerText = \`✨ Enviar \${photos.length} Foto(s) e Preencher Leito\`;
    }

    async function sendPhotos() {
      const sendBtn = document.getElementById('sendBtn');
      const statusBox = document.getElementById('statusBox');
      const resultsContainer = document.getElementById('resultsContainer');

      sendBtn.disabled = true;
      statusBox.style.display = 'block';
      statusBox.style.background = '#1e3a8a';
      statusBox.style.color = '#dbeafe';
      statusBox.innerText = '⏳ Extraindo Hemograma, Na, K, Ureia e Creatinina com IA...';
      resultsContainer.innerHTML = '';

      try {
        const res = await fetch('/api/lab-scanner/processar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            images: photos
          })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Falha ao processar exames.');
        }

        statusBox.style.background = '#065f46';
        statusBox.style.color = '#d1fae5';
        statusBox.innerText = '✅ Sucesso! Exames preenchidos na coluna da data correspondente no seu computador!';

        const ext = data.extractedData || {};
        const labels = [
          ['Data do Exame', ext.examDate],
          ['Hb', ext.checklistHb],
          ['Ht', ext.checklistHt],
          ['Plaquetas', ext.checklistPlaquetas],
          ['Leucograma', ext.checklistLeucograma],
          ['Bastões', ext.checklistBastoes],
          ['Sódio (Na)', ext.checklistSodio],
          ['Potássio (K)', ext.checklistPotassio],
          ['Ureia', ext.checklistUreia],
          ['Creatinina', ext.checklistCreatinina],
        ].filter(x => x[1] && String(x[1]).trim() !== '');

        resultsContainer.innerHTML = labels.map(([k, v]) => \`
          <div class="res-item">
            <span class="res-label">\${k}</span>
            <span class="res-val">\${v}</span>
          </div>
        \`).join('');
      } catch (err) {
        statusBox.style.background = '#7f1d1d';
        statusBox.style.color = '#fecaca';
        statusBox.innerText = '❌ Erro: ' + (err.message || 'Falha ao processar foto.');
        sendBtn.disabled = false;
      }
    }
  </script>
</body>
</html>`;
}
