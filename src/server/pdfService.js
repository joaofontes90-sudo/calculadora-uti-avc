import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { getBackupDirectory } from './backupService.js';

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
  throw new Error('Navegador Chromium/Chrome não encontrado no servidor para gerar o PDF.');
}

export function getPdfsDirectory() {
  const baseDir = getBackupDirectory();
  const pdfsDir = path.join(baseDir, 'pdfs');
  if (!fs.existsSync(pdfsDir)) {
    fs.mkdirSync(pdfsDir, { recursive: true });
  }
  return pdfsDir;
}

export async function generateChecklistPdfOnServer(htmlContent, fileNamePrefix = 'Checklists_UTI_AVC') {
  if (!htmlContent || typeof htmlContent !== 'string') {
    throw new Error('Conteúdo HTML do checklist vazio ou inválido.');
  }

  const pdfsDir = getPdfsDirectory();
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const day = pad(now.getDate());
  const month = pad(now.getMonth() + 1);
  const year = now.getFullYear();
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());

  const safePrefix = String(fileNamePrefix || 'Checklists_UTI_AVC').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${safePrefix}_${day}-${month}-${year}_${hours}-${minutes}-${seconds}.pdf`;
  const filePath = path.join(pdfsDir, fileName);

  const executablePath = findBrowserExecutable();
  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });
    await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.emulateMediaType('print');

    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: false,
      printBackground: true,
      preferCSSPageSize: true,
    });

    fs.writeFileSync(filePath, pdfBuffer);

    // Mantém os 50 PDFs mais recentes para não ocupar espaço excessivo no servidor
    try {
      const allPdfs = fs.readdirSync(pdfsDir)
        .filter((f) => f.endsWith('.pdf'))
        .map((f) => ({
          name: f,
          time: fs.statSync(path.join(pdfsDir, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.time - a.time);

      if (allPdfs.length > 50) {
        allPdfs.slice(50).forEach((oldPdf) => {
          try {
            fs.unlinkSync(path.join(pdfsDir, oldPdf.name));
          } catch (e) {}
        });
      }
    } catch (e) {}

    return {
      success: true,
      fileName,
      filePath,
      relativeUrl: `/pdfs/${encodeURIComponent(fileName)}`,
    };
  } finally {
    await browser.close().catch(() => {});
  }
}
