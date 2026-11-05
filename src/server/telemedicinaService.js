import puppeteer from 'puppeteer-core';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Polyfills para ambientes Windows/Electron sem @napi-rs/canvas nativo
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor(init) {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
      if (Array.isArray(init) && init.length >= 6) {
        [this.a, this.b, this.c, this.d, this.e, this.f] = init;
      }
    }
    translate() { return this; }
    scale() { return this; }
    multiply() { return this; }
    multiplySelf() { return this; }
    preMultiplySelf() { return this; }
    invertSelf() { return this; }
  };
}
if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = class ImageData {
    constructor(w, h) {
      this.width = w;
      this.height = h;
      this.data = new Uint8ClampedArray((w || 1) * (h || 1) * 4);
    }
  };
}
if (typeof globalThis.Path2D === 'undefined') {
  globalThis.Path2D = class Path2D {
    addPath() {}
    rect() {}
  };
}

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

function findBrowserExecutable() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const candidates = process.platform === 'win32'
    ? [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Microsoft\\Edge\\Application\\msedge.exe'),
      ]
    : process.platform === 'darwin'
    ? [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
      ]
    : [
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
      ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error('Navegador Chromium/Chrome não encontrado no servidor para buscar laudos.');
}

export function removeAccents(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function formatToDDMMAA(dateStr) {
  if (!dateStr) return '';
  const m = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const day = m[1].padStart(2, '0');
    const month = m[2].padStart(2, '0');
    const year = m[3].slice(-2);
    return `${day}/${month}/${year}`;
  }
  return dateStr;
}

export function cleanLaudoText(rawText) {
  if (!rawText) return '';
  let text = rawText.trim();

  // 1. Remove paginação, rodapés e metadados comuns do Portal Telemedicina
  text = text.replace(/página\s+\d+\s+de\s*\d+[\s\S]*$/i, '');
  text = text.replace(/--\s*\d+\s*of\s*\d+\s*--[\s\S]*$/i, '');
  text = text.replace(/Paciente\s+[^\n]+Atendimento\s+\d+[\s\S]*$/i, '');
  text = text.replace(/Data\s+de\s+Nascimento\s+[^\n]+Data\s+Laudo[\s\S]*$/i, '');
  text = text.replace(/Assinado\s+digitalmente\s+por[\s\S]*$/i, '');

  // 2. Extrai Título (tipo do exame) e Resultado, removendo o bloco de TÉCNICA
  // Identifica TÉCNICA, TECNICA, METODOLOGIA, MÉTODO, PROTOCOLO
  // Seguido pelo marcador de resultado: ANÁLISE, RESULTADO(S), RELATÓRIO, LAUDO, ACHADOS, DESCRIÇÃO
  const patternComMarcador = /^([\s\S]*?)(?:\r?\n|\s)+(?:T[EÉ]CNICA(?:\s+DO\s+EXAME)?|M[EÉ]TODO(?:LOGIA)?|PROTOCOLO)\s*:?[\s\S]*?(?:(?:\r?\n|\s)+(?:AN[AÁ]LISE|RESULTADOS?|RELAT[OÓ]RIO|LAUDO|ACHADOS|DESCRI[CÇ][AÃ]O)\s*:?\s*)([\s\S]*)$/i;

  const match = text.match(patternComMarcador);
  if (match) {
    const titleLines = match[1]
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);
    const title = titleLines.join(' ').replace(/\s+/g, ' ').trim();
    let result = match[2].trim().replace(/^[:\s]+/, '');
    if (result.startsWith('-') && !result.startsWith('- ')) {
      result = '- ' + result.substring(1).trim();
    }
    return `${title}\n\n${result}`;
  }

  // Fallback: se houver TÉCNICA:... sem o marcador comum após, remove o bloco de técnica até duas quebras de linha
  const fallbackMatch = text.match(/^([\s\S]*?)(?:\r?\n|\s)+(?:T[EÉ]CNICA(?:\s+DO\s+EXAME)?|M[EÉ]TODO(?:LOGIA)?|PROTOCOLO)\s*:?[\s\S]*?(?:\r?\n\r?\n)([\s\S]*)$/i);
  if (fallbackMatch) {
    const title = fallbackMatch[1].split(/\r?\n/).map(l => l.trim()).filter(Boolean).join(' ').trim();
    return `${title}\n\n${fallbackMatch[2].trim()}`;
  }

  return text.trim();
}

export async function searchAndFetchReports(targetPatientName, credentials = {}) {
  const username = credentials.username || process.env.TELEMEDICINA_USERNAME;
  const password = credentials.password || process.env.TELEMEDICINA_PASSWORD;

  if (!username || !password) {
    throw new Error('Credenciais do Portal Telemedicina não encontradas no arquivo .env nem fornecidas.');
  }

  const normalizedTarget = removeAccents(targetPatientName);
  if (!normalizedTarget) {
    throw new Error('Nome do paciente não informado.');
  }

  console.log(`[Telemedicina] Iniciando busca para: "${normalizedTarget}"`);

  const executablePath = findBrowserExecutable();
  const userDataDir = path.join(os.tmpdir(), 'chrome-telemedicina-profile');

  const browser = await puppeteer.launch({
    executablePath,
    headless: "new",
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-crash-reporter',
      '--disable-breakpad',
      '--disable-dev-shm-usage',
      `--user-data-dir=${userDataDir}`,
      '--no-zygote'
    ]
  });

  const foundExams = [];

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    // 1. Acesso e Login (se necessário)
    await page.goto('https://app.portaltelemedicina.com.br/exames', { waitUntil: 'domcontentloaded', timeout: 30000 });

    let needsLogin = false;
    try {
      await Promise.race([
        page.waitForSelector('#username', { timeout: 8000 }).then(() => { needsLogin = true; }),
        page.waitForSelector('#search', { timeout: 8000 })
      ]);
    } catch (e) {
      const userEl = await page.$('#username');
      if (userEl) needsLogin = true;
    }

    if (needsLogin) {
      console.log('[Telemedicina] Formulário de login detectado. Efetuando autenticação...');
      await page.type('#username', username, { delay: 15 });
      await page.type('#password', password, { delay: 15 });
      await page.keyboard.press('Enter');
      await page.waitForSelector('#search', { timeout: 25000 });
    } else {
      console.log('[Telemedicina] Sessão já autenticada.');
    }

    // 2. Aguarda campo de busca pronto
    await page.waitForSelector('#search', { timeout: 20000 });
    await new Promise(r => setTimeout(r, 1500));

    // 3. Digita nome no campo de busca
    const searchInput = await page.$('#search');
    await searchInput.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    await searchInput.type(normalizedTarget, { delay: 15 });
    await page.keyboard.press('Enter');

    await new Promise(r => setTimeout(r, 4000));

    // 4. Analisa linhas da tabela
    const rowItems = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr, .md-table-row, [role="row"]'));
      return rows.map(r => ({
        fullText: r.innerText.replace(/\s+/g, ' ').trim(),
        hasReportBtn: !!r.querySelector('button.button-report, button:has(.fa-file), button:has(.md-icon)')
      }));
    });

    const matchingRows = [];
    for (const item of rowItems) {
      const normRow = removeAccents(item.fullText);
      // Filtra exatamente pelo nome completo do paciente
      if (normRow.includes(normalizedTarget)) {
        const examIdMatch = item.fullText.match(/\b(\d{7,10})\b/);
        const dateMatch = item.fullText.match(/(\d{2}\/\d{2}\/\d{4})/);
        const tcMatch = item.fullText.match(/(TC-[^\s]+|ANGIO[^\s]+|TOMOGRAFIA[^\d\n]+)/i);

        if (examIdMatch && (item.fullText.includes('Ver laudo') || item.hasReportBtn)) {
          matchingRows.push({
            examId: examIdMatch[1],
            dateRaw: dateMatch ? dateMatch[1] : '',
            type: tcMatch ? tcMatch[1].trim() : 'TC-CRÂNIO',
            fullText: item.fullText
          });
        }
      }
    }

    console.log(`[Telemedicina] ${matchingRows.length} exames com laudo encontrados.`);

    // 5. Baixar e processar o PDF de cada exame
    for (const exam of matchingRows) {
      let pdfBuffer = null;

      const responseHandler = async (res) => {
        if (res.url().includes(`/Exams/${exam.examId}/Report`) && res.status() === 200) {
          try {
            pdfBuffer = await res.buffer();
          } catch (e) {}
        }
      };

      page.on('response', responseHandler);

      await page.goto(`https://app.portaltelemedicina.com.br/exames/pdf?id=${exam.examId}`, {
        waitUntil: 'domcontentloaded',
        timeout: 20000
      });
      await new Promise(r => setTimeout(r, 3000));

      page.off('response', responseHandler);

      if (pdfBuffer) {
        const parser = new PDFParse({ data: pdfBuffer });
        await parser.load();
        const rawPdfText = await parser.getText();
        const text = rawPdfText.text || rawPdfText;

        const pdfDateMatch = text.match(/Data\/Hora\s+Exame\s+(\d{2}\/\d{2}\/\d{4})/i) || text.match(/Data\s+do\s+Exame\s*[:]?\s*(\d{2}\/\d{2}\/\d{4})/i);
        const finalDate = pdfDateMatch ? formatToDDMMAA(pdfDateMatch[1]) : formatToDDMMAA(exam.dateRaw);

        const isAngio = /(?:angio-?tc|angiotomografia|angio arterial|angio venosa)/i.test(exam.type) || /(?:angio-?tc|angiotomografia|angio arterial)/i.test(text);

        foundExams.push({
          examId: exam.examId,
          type: exam.type,
          isAngio,
          date: finalDate,
          laudo: cleanLaudoText(text)
        });
      }
    }

  } catch (err) {
    console.error('[Telemedicina] Erro durante o processo:', err);
    throw err;
  } finally {
    await browser.close();
  }

  // Ordena cronologicamente (mais antigo primeiro)
  foundExams.sort((a, b) => {
    const parseD = (d) => {
      const parts = d.split('/');
      if (parts.length === 3) {
        return new Date(2000 + parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
      }
      return 0;
    };
    return parseD(a.date) - parseD(b.date);
  });

  return foundExams;
}
