const { app, BrowserWindow, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { pathToFileURL } = require('url');

// Polyfills globais para pdf-parse / pdfjs-dist no Windows sem @napi-rs/canvas
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

let mainWindow;
let tray;
let isQuitting = false;
let localServerPort = 3847;

// Carrega variáveis do arquivo .env embutido (se existir)
function loadEnvFile() {
  try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      content.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      });
    }
  } catch (err) {
    console.warn('[Env] Aviso ao ler .env:', err.message);
  }
}

loadEnvFile();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function startEmbeddedServer() {
  return new Promise((resolve) => {
    const distDir = path.join(__dirname, 'dist');

    const server = http.createServer(async (req, res) => {
      try {
        const parsedUrl = new URL(req.url || '/', `http://127.0.0.1:${localServerPort}`);
        const pathname = parsedUrl.pathname;

        // 1. Endpoint Telemedicina
        if (pathname === '/api/telemedicina/buscar-laudos' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const { patientName, username, password } = JSON.parse(body || '{}');
              if (!patientName) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Nome do paciente é obrigatório.' }));
                return;
              }
              const telePath = pathToFileURL(path.join(__dirname, 'src', 'server', 'telemedicinaService.js')).href;
              const { searchAndFetchReports } = await import(telePath);
              const exams = await searchAndFetchReports(patientName, {
                username: username || process.env.TELEMEDICINA_USERNAME,
                password: password || process.env.TELEMEDICINA_PASSWORD
              });
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, exams }));
            } catch (err) {
              console.error('[API Telemedicina Error]', err);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: err?.message || 'Erro ao buscar laudos no portal.' }));
            }
          });
          return;
        }

        // 2. Endpoints de Backup
        if (pathname === '/api/backup/salvar' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const payload = JSON.parse(body || '{}');
              const backupPath = pathToFileURL(path.join(__dirname, 'src', 'server', 'backupService.js')).href;
              const { saveBackupData } = await import(backupPath);
              const result = saveBackupData(payload);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(result));
            } catch (err) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: err?.message || 'Erro ao salvar backup.' }));
            }
          });
          return;
        }

        if (pathname === '/api/backup/listar' && req.method === 'GET') {
          try {
            const backupPath = pathToFileURL(path.join(__dirname, 'src', 'server', 'backupService.js')).href;
            const { listBackups, getBackupDirectory } = await import(backupPath);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              backupDir: getBackupDirectory(),
              backups: listBackups()
            }));
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err?.message }));
          }
          return;
        }

        if (pathname === '/api/backup/carregar' && req.method === 'GET') {
          try {
            const file = parsedUrl.searchParams.get('file');
            const backupPath = pathToFileURL(path.join(__dirname, 'src', 'server', 'backupService.js')).href;
            const { loadBackupFile } = await import(backupPath);
            const result = loadBackupFile(file || undefined);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err?.message }));
          }
          return;
        }

        // 3. Arquivos Estáticos do Frontend (dist/)
        let safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
        if (safePath === '/' || safePath === '\\') {
          safePath = '/index.html';
        }
        let filePath = path.join(distDir, safePath);
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          filePath = path.join(distDir, 'index.html');
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        const content = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      }
    });

    const tryListen = (port) => {
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          tryListen(port + 1);
        } else {
          console.error('[Server Error]', err);
          resolve(port);
        }
      });
      server.listen(port, '127.0.0.1', () => {
        localServerPort = port;
        console.log(`[Calculadora UTI-AVC] Servidor interno ativo em http://127.0.0.1:${port}`);
        resolve(port);
      });
    };

    tryListen(3847);
  });
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'Calculadora UTI-AVC',
    icon: path.join(__dirname, 'dist', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      nativeWindowOpen: true
    }
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}`);
  mainWindow.setMenuBarVisibility(false);

  // Permite janelas pop-up de impressão (Checklists, Exames, Gasometrias, Resumo, etc.)
  mainWindow.webContents.setWindowOpenHandler(() => {
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 1024,
        height: 800,
        title: 'Visualização de Impressão — Calculadora UTI-AVC',
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: false
        }
      }
    };
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting && tray) {
      event.preventDefault();
      mainWindow.hide();
      if (process.platform === 'win32') {
        tray.displayBalloon({
          title: 'Calculadora UTI-AVC',
          content: 'O aplicativo continua rodando em segundo plano. Clique duas vezes no ícone perto do relógio para reabrir.',
          iconType: 'info'
        });
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const { nativeImage } = require('electron');

  let iconPath = path.join(__dirname, 'dist', 'icon.png');
  if (!fs.existsSync(iconPath)) {
    iconPath = path.join(__dirname, 'public', 'logo2.png');
  }

  try {
    let trayImage = fs.existsSync(iconPath)
      ? nativeImage.createFromPath(iconPath)
      : nativeImage.createEmpty();
    tray = new Tray(trayImage.resize({ width: 16, height: 16 }));
  } catch (error) {
    tray = new Tray(nativeImage.createEmpty());
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Mostrar Calculadora UTI-AVC',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Iniciar junto com o Windows',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (menuItem) => {
        app.setLoginItemSettings({
          openAtLogin: menuItem.checked,
          path: app.getPath('exe')
        });
      }
    },
    {
      label: 'Minimizar para segundo plano',
      click: () => {
        if (mainWindow) mainWindow.hide();
      }
    },
    { type: 'separator' },
    {
      label: 'Sair Completamente',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Calculadora UTI-AVC (Ativa)');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    const port = await startEmbeddedServer();
    createTray();
    createWindow(port);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow(localServerPort);
      }
    });
  });
}

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
