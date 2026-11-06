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
      throw new Error('Chave da API do Google Gemini (GEMINI_API_KEY) não configurada. Configure-a na janela do leitor no computador.');
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

    const prompt = `Você é um médico intensivista especialista em leitura de exames laboratoriais impressos em folha A4 no Brasil.
Analise a(s) foto(s) da(s) folha(s) de exames laboratoriais anexada(s) e extraia APENAS os resultados atuais do paciente.

REGRAS CRÍTICAS:
1. NUNCA extraia os "Valores de Referência" / "Referência". Extraia SOMENTE o resultado obtido do paciente.
2. Se houver colunas de "Resultados Anteriores", extraia apenas o resultado mais recente da folha.
3. Se um exame NÃO estiver presente na foto, retorne string vazia "" para aquele campo.
4. Para "checklistPao2Paco2", se houver PaO2 (ou pO2) e PaCO2 (ou pCO2), formate como "PaO2 / PaCO2" (ex: "89 / 38").
5. Para "checklistHco3Sao2", se houver HCO3 (ou Bic) e SaO2 (ou SatO2 / sO2), formate como "HCO3 / SaO2" (ex: "24 / 97%").
6. Para "checklistPlaquetas", mantenha o valor claro (ex: "215.000" ou "215 mil").
7. Para "checklistLeucograma", coloque o valor total de Leucócitos / Global de Leucócitos (ex: "8.400" ou "8400").
8. Para "checklistBastoes", coloque a porcentagem ou valor de Bastões / Bastonetes (ex: "2%").
9. Para "checklistBioquimicaOutros", agrupe quaisquer outros exames laboratoriais importantes presentes na folha que não têm campo próprio (como PCR, Proteína C Reativa, TTPA/KPTT, Cálcio/Ca, TGO/AST, TGP/ALT, Glicose, Lactato, CPK, Bilirrubinas, VHS, etc.) separados por " | " (ex: "PCR: 14 | TTPA: 31s | Ca: 8.9 | TGO: 22 | TGP: 18").
10. Se houver data de coleta/liberação do exame na folha, formate "examDate" como "DD/MM/AA" (ex: "05/11/26").

Retorne EXCLUSIVAMENTE um objeto JSON válido (sem blocos markdown) seguindo exatamente esta estrutura:
{
  "patientNameOnSheet": "",
  "examDate": "",
  "checklistPh": "",
  "checklistPao2Paco2": "",
  "checklistHco3Sao2": "",
  "checklistHb": "",
  "checklistHt": "",
  "checklistPlaquetas": "",
  "checklistLeucograma": "",
  "checklistBastoes": "",
  "checklistInr": "",
  "checklistSodio": "",
  "checklistPotassio": "",
  "checklistMagnesio": "",
  "checklistFosforo": "",
  "checklistTroponina": "",
  "checklistUreia": "",
  "checklistCreatinina": "",
  "checklistBioquimicaOutros": ""
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [...imageParts, { text: prompt }],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    const rawText = (response.text || '').trim();
    const cleanedJson = rawText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    const extracted = JSON.parse(cleanedJson);

    // Atualiza também diretamente o backup mais recente no servidor caso tenhamos bedId
    const targetBedId = session ? session.bedId : Number(bedId);
    const targetDayIndex = session ? session.dayIndex : Number(dayIndex || 0);

    if (targetBedId) {
      try {
        const latestBackup = loadBackupFile();
        if (latestBackup?.success && Array.isArray(latestBackup?.data?.patients)) {
          const patients = latestBackup.data.patients;
          const pIdx = patients.findIndex((p) => Number(p.id) === Number(targetBedId));
          if (pIdx !== -1) {
            const patient = patients[pIdx];
            const lists = Array.isArray(patient.dailyChecklists) ? [...patient.dailyChecklists] : [];
            if (lists[targetDayIndex]) {
              const currentDay = { ...lists[targetDayIndex] };
              const fieldsToMerge = [
                'checklistPh',
                'checklistPao2Paco2',
                'checklistHco3Sao2',
                'checklistHb',
                'checklistHt',
                'checklistPlaquetas',
                'checklistLeucograma',
                'checklistBastoes',
                'checklistInr',
                'checklistSodio',
                'checklistPotassio',
                'checklistMagnesio',
                'checklistFosforo',
                'checklistTroponina',
                'checklistUreia',
                'checklistCreatinina',
              ];

              for (const field of fieldsToMerge) {
                if (extracted[field] && String(extracted[field]).trim() !== '') {
                  currentDay[field] = String(extracted[field]).trim();
                }
              }

              if (extracted.checklistBioquimicaOutros && String(extracted.checklistBioquimicaOutros).trim() !== '') {
                const newOutros = String(extracted.checklistBioquimicaOutros).trim();
                if (currentDay.checklistBioquimicaOutros && !currentDay.checklistBioquimicaOutros.includes(newOutros)) {
                  currentDay.checklistBioquimicaOutros = `${currentDay.checklistBioquimicaOutros} | ${newOutros}`;
                } else {
                  currentDay.checklistBioquimicaOutros = newOutros;
                }
              }

              if (!currentDay.checklistData && extracted.examDate) {
                currentDay.checklistData = String(extracted.examDate).trim();
              }

              lists[targetDayIndex] = currentDay;
              patients[pIdx] = {
                ...patient,
                dailyChecklists: lists,
                ...(targetDayIndex === 0 ? currentDay : {}),
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
    <span class="badge">Leito ${session.bedId} • Checklist Dia ${session.dayIndex + 1}</span>
    <h1>${session.patientName}</h1>
    <div class="sub">Fotografe a(s) folha(s) A4 de exames laboratoriais para preencher automaticamente o computador.</div>

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
            const maxDim = 1600;
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
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
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
      statusBox.innerText = '⏳ Analisando folha(s) de exame com Inteligência Artificial... Aguarde cerca de 5 segundos...';
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
        statusBox.innerText = '✅ Sucesso! Os exames já foram enviados e preenchidos automaticamente na tela do seu computador!';

        const ext = data.extractedData || {};
        const labels = [
          ['Data Exame', ext.examDate],
          ['Hb', ext.checklistHb],
          ['Ht', ext.checklistHt],
          ['Plaquetas', ext.checklistPlaquetas],
          ['Leucócitos', ext.checklistLeucograma],
          ['Bastões', ext.checklistBastoes],
          ['INR', ext.checklistInr],
          ['Sódio (Na)', ext.checklistSodio],
          ['Potássio (K)', ext.checklistPotassio],
          ['Magnésio (Mg)', ext.checklistMagnesio],
          ['Fósforo (P)', ext.checklistFosforo],
          ['Troponina', ext.checklistTroponina],
          ['Ureia', ext.checklistUreia],
          ['Creatinina', ext.checklistCreatinina],
          ['pH', ext.checklistPh],
          ['PaO2/PaCO2', ext.checklistPao2Paco2],
          ['HCO3/SaO2', ext.checklistHco3Sao2],
          ['Outros', ext.checklistBioquimicaOutros],
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
