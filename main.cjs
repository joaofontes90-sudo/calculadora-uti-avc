const { app, BrowserWindow, Tray, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let tray;
let isQuitting = false;

// Auto-launch configuration
const autoLaunchKey = 'UTI_AVC_AutoLaunch';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Calculadora UTI-AVC',
    icon: path.join(__dirname, 'dist', 'icon.png'), // Will fallback if doesn't exist
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  // Check if we are in development mode
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // Remove default menu bar
  mainWindow.setMenuBarVisibility(false);

  // When clicking the close button on the window, just hide it to keep it running 24h
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      
      // Show notification on first hide/minimize to let the user know it's in the tray
      if (tray) {
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
  
  // A beautiful base64-encoded 32x32 blue-and-white rounded medical icon
  const logoBase64 = 
    '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 HeHeHfrfDfnPff OfDef//8D/// OfBfOfwnfdY/HeEeA/wfeEfBfeHeDfeW9fNdf HeE/MnfdW/HfCfHeMfK/////bvgfvDf9ffQ//////////M/ynfOemD9G/Mf8vfffK+e///8D//////////Yfb6DfF3xX8Z////g//////////X////fDftPHeE/OfwnfEfHeHeNfrfDfnHeHeHfeBfxX//A/w79DHeBfGfWfDfoffq7E9Ev/Z9O8lffffMf8XfK////Y//////////w////FfiHeW/YfHfff8D//////b//////////TfwnfdY///OemHePfOfDfoffXfYfM9O9T3MvHeM/////M///OfwnfOfBfxXwRfdw9U//vPHeBftP9PfOfDfdPfOfNfYPHeA9efpbel/EvN38n////Kfg///t/An+C////BfG/+8D/uP8N/wfeXfp6B/E9U9eE+EPF//N//////M/yfCfHeLfC/OfEvKfnfK///t+HfdA/DHeA9T3GfdY/w/Nfp6B/E9EP8D/H/M/AfyG///HeD////AfOf8LfCfNfy///t///////E/yPOfCfE///KfOfAfOfGfyvHeGfafM/XvwP//Q9///VfhHeW/DfOfMfOfMfOfHePfDfv++F/w///9b///////T///HfdDffYfcG+Def4L+D/P/Z///////fGfA///KfCfnvN/EvK9EP8TfI///////+GfoTbyHeGfynfO///uN6F/////XfdVdfKfeHeAd9Z9efOf///XfvwnfzfvDf9D/v7+EPvd9u////OfMn///K///////Ev8XfyvHeHeNfrfffXfeB/O/Of8b///Of9HfrfT38XdfA////0P/OfHeHfwbwr3HePHeM7///////eB/Y78t3uPHeMeNfr37///B///////fB/O//////fN+XvwffO//////HeE/M//////EvvddfF//////B3ynfOf/b//f/f/0///////Xvwd9W//////M/////E/////MvvvEfXvyff HeN//////ZfcD////////////////K////////F3/Wf6zvHeHfrfdXfK+/Df8D+PfA//////////////v8D//N//////////////////////////////g///wf8XfH//P+DfG/Y////L///G/D3ynfOfHeHfrffffN///O9HeA////OemHeNfra9Ffb////0PwnbZ///K///////v8XfB///////P//////////////////L///////F3/8F8Z///////////////v8D////N//////E///////fG///v8D//////////////////////////P8T8h/wfwnf3vMfHeGfcnfdEf HeMfOemEeHeE/OfNfOf///YfpbeE///u9RfK////////////////a//////////////Vd//////g////////////////fB/N//////////////////////Ffh3vfOfHeNfrffffuN//////g///////E///v8D///////////eB/gnfh7///W//////K//////////////L///////////////Ev8D////eB/Y7vHfrffXfeG/b///////////XvfP///DfF//////DffEv/Hf//////////M///Yfbwnf0POfHeM/////sH//Y/H/M/////RfY////H/OenHeE/////M///////vHeHf9z//////////8N/////////sH/GfyvHeHeHeHfffOfXvyffOfXvHeHfwbwr3DfY/////T3HeBfBvK///////////AfHePfDfsT///n0////t/An+EPwnf3vMfHfSfMnfeK///////O9OfDfoff HeDfePfM//Mff HeF////////////////K/g/////MfNfffA///////////K/g///wnb9D///////O9OfHeMfHffEv8X///uD///Zfs7/F/2fRfXvwnffffE/8Xfc/OfA////////////////////fT3C/K///Y5MfXeMeA9T3C////////EvK//////W////BffG/A///mPXfxT3EvHeGfeT////g////////////////ZfY70ffT///////////w///fXvOfeF8HfY///////////O///T/pXfE/////T/EvG/////K//////E/H/////B3///wX9j//////Kfg/////////8TfI///fDfEvMnfE/Mf4vHeE/////M3///U////HeBffHeGfAnfH/8HfH///OfwnfOfDfHeBfwnffffDfHeMfG//vN/MfnHeDfteGfsT////////////////N//////d///////EvHdfDeCfnvCfNffffffO9OfM////fB//////////d///wX4V9e///3wR//g////////////////X/EvHdnff3vK///fK+E/MvOfGfeTeHfPfvMffMfHeHfHeMfKfnffffNfffXffHeHfKfO9PfOfEfOfO9MfCfEeEvHeA//w===';

  let iconPath = path.join(__dirname, 'dist', 'icon.png');
  
  if (!fs.existsSync(iconPath)) {
    iconPath = path.join(__dirname, 'src', 'assets', 'icon.png');
  }

  try {
    let trayImage;
    if (fs.existsSync(iconPath)) {
      trayImage = nativeImage.createFromPath(iconPath);
    } else {
      trayImage = nativeImage.createFromBuffer(Buffer.from(logoBase64, 'base64'));
    }
    tray = new Tray(trayImage.resize({ width: 16, height: 16 }));
  } catch (error) {
    const emptyIcon = nativeImage.createFromBuffer(Buffer.from(logoBase64, 'base64'));
    tray = new Tray(emptyIcon.resize({ width: 16, height: 16 }));
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Mostrar Calculadora UTI-AVC',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    { type: 'separator' },
    {
      label: 'Iniciar junto com o Windows',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (menuItem) => {
        const openAtLogin = menuItem.checked;
        app.setLoginItemSettings({
          openAtLogin: openAtLogin,
          path: app.getPath('exe')
        });
      }
    },
    {
      label: 'Minimizar para segundo plano',
      click: () => {
        mainWindow.hide();
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

  // Restore on double click
  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

// Single Instance Lock: Prevent multiple instances from running
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    createTray();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
