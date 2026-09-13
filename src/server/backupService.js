import fs from 'fs';
import path from 'path';
import os from 'os';

export function getBackupDirectory() {
  const isWindows = process.platform === 'win32';
  let dir;

  if (isWindows) {
    dir = 'C:\\Backups_UTI_AVC';
  } else {
    dir = path.join(os.homedir(), 'Backups_UTI_AVC');
  }

  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  } catch (err) {
    console.warn(`[Backup] Não foi possível criar diretório principal ${dir}, usando pasta local:`, err.message);
    const fallbackDir = path.resolve(process.cwd(), 'backups');
    if (!fs.existsSync(fallbackDir)) {
      fs.mkdirSync(fallbackDir, { recursive: true });
    }
    return fallbackDir;
  }
}

export function saveBackupData(payload) {
  const backupDir = getBackupDirectory();
  const now = new Date();
  
  const pad = (n) => String(n).padStart(2, '0');
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());

  const timeStampStr = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
  const fileName = `backup_uti_avc_${timeStampStr}.json`;
  const latestFileName = `backup_uti_avc_latest.json`;

  const fullPayload = {
    version: '1.0',
    appName: 'Calculadora-UTI-AVC',
    createdAt: now.toISOString(),
    formattedDate: `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`,
    backupDir,
    patients: payload.patients || [],
    archivedPatients: payload.archivedPatients || []
  };

  const jsonStr = JSON.stringify(fullPayload, null, 2);

  // 1. Salva arquivo com timestamp
  const timeStampedPath = path.join(backupDir, fileName);
  fs.writeFileSync(timeStampedPath, jsonStr, 'utf-8');

  // 2. Atualiza arquivo "latest"
  const latestPath = path.join(backupDir, latestFileName);
  fs.writeFileSync(latestPath, jsonStr, 'utf-8');

  console.log(`[Backup] Backup salvo com sucesso em: ${timeStampedPath}`);

  return {
    success: true,
    fileName,
    filePath: timeStampedPath,
    backupDir,
    timestamp: fullPayload.formattedDate,
    patientsCount: fullPayload.patients.length,
    archivedCount: fullPayload.archivedPatients.length
  };
}

export function listBackups() {
  const backupDir = getBackupDirectory();
  if (!fs.existsSync(backupDir)) return [];

  const files = fs.readdirSync(backupDir);
  const jsonFiles = files
    .filter(f => f.endsWith('.json') && f !== 'backup_uti_avc_latest.json')
    .map(fileName => {
      const filePath = path.join(backupDir, fileName);
      const stat = fs.statSync(filePath);
      return {
        fileName,
        filePath,
        sizeBytes: stat.size,
        modifiedAt: stat.mtime
      };
    })
    .sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());

  return jsonFiles;
}

export function loadBackupFile(targetFileName) {
  const backupDir = getBackupDirectory();
  const fileName = targetFileName || 'backup_uti_avc_latest.json';
  const filePath = path.join(backupDir, fileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo de backup não encontrado: ${fileName}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(content);

  return {
    success: true,
    data: parsed
  };
}
