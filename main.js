
// main.js
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const { execFile, spawn, execSync } = require('child_process');
const XLSX = require('xlsx');
const { randomUUID } = require('crypto');

// Configure logging for autoUpdater
autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'info';

const fileWatchers = new Map();
const jobStateTimestamps = new Map(); 
const fileJobStates = new Map();

const userDataPath = app.getPath('userData');
const configPath = path.join(userDataPath, 'app-config.json');
const statsPath = path.join(userDataPath, 'stats.json'); 
let mainWindow;

function readConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (error) {
    console.error('Error reading config file:', error);
  }
  return {};
}

function writeConfig(config) {
  try {
    if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Error writing config file:', error);
  }
}

function getFilesFromDirectories(dirs) {
    let files = [];
    const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.png', '.jpg', '.jpeg']; 
    dirs.forEach(dir => {
        try {
            if (fs.existsSync(dir)) {
                const dirents = fs.readdirSync(dir, { withFileTypes: true });
                const videoFiles = dirents
                    .filter(dirent => dirent.isFile() && videoExtensions.includes(path.extname(dirent.name).toLowerCase()))
                    .map(dirent => path.join(dir, dirent.name));
                files = [...files, ...videoFiles];
            }
        } catch (e) {}
    });
    return files;
}

function scanVideosInternal(jobs, excelFilePath) {
    const rootDir = path.dirname(excelFilePath);
    const excelNameNoExt = path.basename(excelFilePath, '.xlsx');
    const subDir = path.join(rootDir, excelNameNoExt);
    const resultFiles = getFilesFromDirectories([rootDir, subDir]);
    
    return jobs.map(job => {
        if (job.videoPath && fs.existsSync(job.videoPath)) return job;
        
        if (job.videoName) {
             const cleanName = job.videoName.trim();
             const escapedName = cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
             const nameRegex = new RegExp(`${escapedName}(?:[^0-9]|$)`, 'i');
             const matchedFileByName = resultFiles.find(f => nameRegex.test(path.basename(f, path.extname(f))));
             if (matchedFileByName) return { ...job, videoPath: matchedFileByName, status: 'Completed' };
        }
        return job;
    });
}

function syncStatsAndState(filePath, jobs, explicitInit = false) {
    const updatedJobs = scanVideosInternal(jobs, filePath);
    return { updatedJobs };
}

function getFfmpegPath() {
    const binary = 'ffmpeg';
    const binaryName = process.platform === 'win32' ? `${binary}.exe` : binary;
    const basePath = app.isPackaged ? path.join(process.resourcesPath, 'ffmpeg') : path.join(__dirname, 'resources', 'ffmpeg');
    const platformFolder = process.platform === 'win32' ? 'win' : 'mac';
    return path.join(basePath, platformFolder, binaryName);
}

function parseExcelData(data) {
    try {
        const workbook = XLSX.read(data, { type: 'buffer' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const dataAsArrays = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false });
        if (!dataAsArrays || dataAsArrays.length < 2) return [];
        const headerMap = {};
        dataAsArrays[0].forEach((h, i) => { headerMap[String(h).trim()] = i; });
        return dataAsArrays.slice(1).map((rowArray, index) => {
            const get = (h) => rowArray[headerMap[h]] || '';
            const statusStr = String(get('STATUS')).trim();
            return {
                id: get('JOB_ID') || `job_${index + 1}`,
                prompt: get('PROMPT') || '',
                imagePath: get('IMAGE_PATH') || '',
                imagePath2: get('IMAGE_PATH_2') || '',
                imagePath3: get('IMAGE_PATH_3') || '',
                imagePath4: get('IMAGE_PATH_4') || '',
                imagePath5: get('IMAGE_PATH_5') || '',
                imagePath6: get('IMAGE_PATH_6') || '',
                imagePath7: get('IMAGE_PATH_7') || '',
                imagePath8: get('IMAGE_PATH_8') || '',
                imagePath9: get('IMAGE_PATH_9') || '',
                imagePath10: get('IMAGE_PATH_10') || '',
                status: ['Pending', 'Processing', 'Generating', 'Completed', 'Failed'].includes(statusStr) ? statusStr : '',
                videoName: get('VIDEO_NAME') || '',
                typeVideo: get('TYPE_VIDEO') || 'IMG',
                videoPath: get('VIDEO_PATH') || undefined,
            };
        }).filter(job => job.id);
    } catch (e) { return []; }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900,
    webPreferences: { contextIsolation: false, nodeIntegration: true },
    icon: path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    backgroundColor: '#ffffff'
  });
  mainWindow.loadFile(app.isPackaged ? path.join(__dirname, 'dist', 'index.html') : 'index.html');
  mainWindow.removeMenu();
}

app.whenReady().then(() => {
  createWindow();
});

// IPC Handlers
ipcMain.handle('get-app-config', () => readConfig());
ipcMain.handle('save-app-config', async (e, cfg) => { writeConfig({ ...readConfig(), ...cfg }); return { success: true }; });

ipcMain.handle('save-file-dialog', async (event, { defaultPath, fileContent }) => {
    const res = await dialog.showSaveDialog(mainWindow, { title: 'Lưu File Manga Job', defaultPath, filters: [{ name: 'Excel', extensions: ['xlsx'] }] });
    if (res.filePath) {
        fs.writeFileSync(res.filePath, Buffer.from(fileContent));
        return { success: true, filePath: res.filePath };
    }
    return { success: false };
});

ipcMain.handle('save-file-custom', async (event, { path: filePath, content }) => {
    try {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, Buffer.from(content));
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('open-file-dialog', async () => {
    const res = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: [{ name: 'Excel', extensions: ['xlsx'] }] });
    if (res.canceled) return { success: false };
    const p = res.filePaths[0];
    return { success: true, files: [{ path: p, name: path.basename(p), content: fs.readFileSync(p) }] };
});

ipcMain.handle('open-folder-dialog', async () => {
    const res = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
    if (res.canceled) return { success: false };
    return { success: true, path: res.filePaths[0] };
});

ipcMain.handle('read-dir', async (event, dirPath) => {
    try {
        const files = fs.readdirSync(dirPath).filter(f => !f.startsWith('.'));
        const fileList = files.map(f => ({
            name: f,
            fullPath: path.join(dirPath, f)
        }));
        return { success: true, files: fileList };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('update-jobs', async (event, { filePath, updates }) => {
    // updates: array of { id: string, status: string }
    try {
        if (!fs.existsSync(filePath)) return { success: false, error: 'File not found' };
        
        const workbook = XLSX.readFile(filePath);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Find headers
        const headers = data[0];
        const idIdx = headers.indexOf('JOB_ID');
        const statusIdx = headers.indexOf('STATUS');
        
        if (idIdx === -1 || statusIdx === -1) return { success: false, error: 'Invalid Excel structure' };

        let updatedCount = 0;
        for (let i = 1; i < data.length; i++) {
            const rowId = data[i][idIdx];
            const update = updates.find(u => u.id === rowId);
            if (update) {
                data[i][statusIdx] = update.status;
                updatedCount++;
            }
        }

        const newWs = XLSX.utils.aoa_to_sheet(data);
        workbook.Sheets[workbook.SheetNames[0]] = newWs;
        XLSX.writeFile(workbook, filePath);
        
        return { success: true, count: updatedCount };
    } catch (e) {
        console.error(e);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('delete-file', async (event, filePath) => {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return { success: true };
        }
        return { success: true }; // Treat non-exist as success
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.on('start-watching-file', (event, filePath) => {
    if (fileWatchers.has(filePath)) return;
    try { if (fs.existsSync(filePath)) {
         const raw = parseExcelData(fs.readFileSync(filePath));
         syncStatsAndState(filePath, raw, true);
    }} catch (e) {}
    
    fileWatchers.set(filePath, fs.watch(filePath, (ev) => {
        if (ev === 'change') {
            try {
                // Short timeout to allow writes to finish
                setTimeout(() => {
                    if (!fs.existsSync(filePath)) return;
                    const buf = fs.readFileSync(filePath);
                    const raw = parseExcelData(buf);
                    const { updatedJobs } = syncStatsAndState(filePath, raw, false);
                    event.sender.send('file-content-updated', { path: filePath, content: buf });
                }, 100);
            } catch(e) {}
        }
    }));
});

ipcMain.on('stop-watching-file', (e, p) => { if (fileWatchers.has(p)) { fileWatchers.get(p).close(); fileWatchers.delete(p); } });

ipcMain.on('open-folder', (e, p) => fs.existsSync(p) && shell.openPath(p));
ipcMain.on('open-video-path', (e, p) => fs.existsSync(p) && shell.openPath(p));

ipcMain.handle('check-ffmpeg', async () => ({ found: fs.existsSync(getFfmpegPath()) }));
ipcMain.handle('open-tool-flow', async () => {
    const p = readConfig().toolFlowPath;
    if (p && fs.existsSync(p)) { spawn(p, [], { detached: true, stdio: 'ignore' }).unref(); return { success: true }; }
    return { success: false };
});
ipcMain.handle('set-tool-flow-path', async () => {
    const res = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: [{ name: 'Executables', extensions: ['exe'] }] });
    if (!res.canceled) { writeConfig({ ...readConfig(), toolFlowPath: res.filePaths[0] }); return { success: true, path: res.filePaths[0] }; }
    return { success: false };
});
