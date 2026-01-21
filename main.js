
// main.js
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const { execFile, spawn, execSync } = require('child_process');
const XLSX = require('xlsx');
const crypto = require('crypto');

// Configure logging for autoUpdater
autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'info';
autoUpdater.autoDownload = true; 

const fileWatchers = new Map();
const folderWatchers = new Map(); 
const jobStateTimestamps = new Map(); 
const fileJobStates = new Map();

const userDataPath = app.getPath('userData');
const configPath = path.join(userDataPath, 'app-config.json');
const statsPath = path.join(userDataPath, 'stats.json'); 
let mainWindow;

const ACTIVATION_SECRET = 'your-super-secret-key-for-mv-prompt-generator-pro-2024'; 

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

function getMachineId() {
    let config = readConfig();
    if (!config.machineId) {
        config.machineId = crypto.randomUUID();
        writeConfig(config);
    }
    return config.machineId;
}

function verifyLicenseKey(machineId, inputKey) {
    try {
        if (!inputKey || !inputKey.includes('.')) return false;
        const parts = inputKey.trim().split('.');
        const inputSignature = parts.pop(); 
        const inputMachineId = parts.join('.');
        if (inputMachineId !== machineId) return false;
        const hmac = crypto.createHmac('sha256', ACTIVATION_SECRET);
        hmac.update(inputMachineId);
        const expectedSignature = hmac.digest('hex');
        return inputSignature.toLowerCase() === expectedSignature.toLowerCase();
    } catch (e) {
        return false;
    }
}

function checkActivationStatus() {
    const config = readConfig();
    if (!config.machineId || !config.licenseKey) return false;
    return verifyLicenseKey(config.machineId, config.licenseKey);
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
        if (job.id && job.videoName) {
            const specificImgPattern = `Image_${job.id}_${job.videoName}`.toLowerCase();
            const specificVidPattern = `Video_${job.id}_${job.videoName}`.toLowerCase();
            const specificMatch = resultFiles.find(f => {
                const nameNoExt = path.parse(f).name.toLowerCase();
                return nameNoExt === specificImgPattern || nameNoExt === specificVidPattern;
            });
            if (specificMatch) return { ...job, videoPath: specificMatch, status: 'Completed' };
        }
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
                typeVideo: get('TYPE_VIDEO') || '',
                videoPath: get('VIDEO_PATH') || undefined,
            };
        }).filter(job => job.id);
    } catch (e) { return []; }
}

function createApplicationMenu() {
    const template = [
        { label: 'Tệp (File)', submenu: [{ role: 'quit', label: 'Thoát (Exit)' }] },
        { label: 'Hiển thị (View)', submenu: [{ role: 'reload', label: 'Tải lại trang (Reload)' }, { role: 'forceReload', label: 'Tải lại bắt buộc' }, { role: 'toggledevtools', label: 'Công cụ lập trình (DevTools)' }, { type: 'separator' }, { role: 'resetzoom', label: 'Đặt lại thu phóng' }, { role: 'zoomin', label: 'Phóng to' }, { role: 'zoomout', label: 'Thu nhỏ' }, { type: 'separator' }, { role: 'togglefullscreen', label: 'Toàn màn hình' }] },
        { label: 'Trợ Giúp (Help)', submenu: [{ label: 'Hướng dẫn sử dụng', click: async () => { const guideWindow = new BrowserWindow({ width: 1024, height: 800, autoHideMenuBar: true, title: 'Hướng dẫn sử dụng V-Manga', webPreferences: { nodeIntegration: false, contextIsolation: true }, icon: getIconPath() }); const guidePath = app.isPackaged ? path.join(__dirname, 'dist', 'guide.html') : path.join(__dirname, 'guide.html'); if (fs.existsSync(guidePath)) guideWindow.loadFile(guidePath); else guideWindow.loadURL('data:text/html;charset=utf-8,<h1>Không tìm thấy file hướng dẫn!</h1>'); } }, { type: 'separator' }, { label: 'Phiên bản: ' + app.getVersion(), enabled: false }, { label: 'Kiểm tra cập nhật', click: () => autoUpdater.checkForUpdatesAndNotify() }, { label: 'Tác giả: V-Manga Team', enabled: false }] }
    ];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

function setupAutoUpdater() {
    if (!app.isPackaged) return;
    const sendStatusToWindow = (text, type = 'info', data = null) => { if (mainWindow) mainWindow.webContents.send('update-message', { message: text, type, data }); };
    autoUpdater.on('checking-for-update', () => sendStatusToWindow('Đang kiểm tra bản cập nhật...', 'checking'));
    autoUpdater.on('update-available', (info) => sendStatusToWindow('Phát hiện bản cập nhật mới. Đang tải xuống...', 'available'));
    autoUpdater.on('update-not-available', (info) => sendStatusToWindow('Bạn đang sử dụng phiên bản mới nhất.', 'not-available'));
    autoUpdater.on('error', (err) => sendStatusToWindow('Lỗi cập nhật: ' + err, 'error'));
    autoUpdater.on('download-progress', (progressObj) => sendStatusToWindow(`Tiến độ: ${progressObj.percent}%`, 'progress', progressObj));
    autoUpdater.on('update-downloaded', (info) => sendStatusToWindow('Bản cập nhật đã sẵn sàng.', 'downloaded', info));
    autoUpdater.checkForUpdatesAndNotify();
}

/**
 * Hàm hỗ trợ lấy đường dẫn Icon chuẩn xác
 */
function getIconPath() {
    // Ưu tiên tệp .ico trên Windows và .png trên các hệ điều hành khác cho Taskbar
    const ext = process.platform === 'win32' ? 'ico' : 'png';
    // Khi app đóng gói, thư mục assets nằm cùng cấp với main.js hoặc trong dist/
    const iconPath = app.isPackaged 
        ? path.join(__dirname, 'assets', `icon.${ext}`)
        : path.join(__dirname, 'assets', `icon.${ext}`);
    
    // Kiểm tra xem file có tồn tại không, nếu không lấy PNG làm dự phòng
    if (fs.existsSync(iconPath)) return iconPath;
    return path.join(__dirname, 'assets', 'icon.png');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900,
    webPreferences: { contextIsolation: false, nodeIntegration: true },
    icon: getIconPath(), // Cấu hình Icon Taskbar
    backgroundColor: '#ffffff'
  });
  
  createApplicationMenu();
  setupAutoUpdater();
  
  mainWindow.loadFile(app.isPackaged ? path.join(__dirname, 'dist', 'index.html') : 'index.html');
}

app.whenReady().then(() => {
  createWindow();
});

ipcMain.handle('get-app-config', () => readConfig());
ipcMain.handle('save-app-config', async (e, cfg) => { writeConfig({ ...readConfig(), ...cfg }); return { success: true }; });
ipcMain.handle('restart-app-update', () => { autoUpdater.quitAndInstall(); });
ipcMain.handle('get-machine-id', () => { return { machineId: getMachineId() }; });
ipcMain.handle('check-activation', () => { return { activated: checkActivationStatus() }; });
ipcMain.handle('activate-app', (e, key) => { const machineId = getMachineId(); const isValid = verifyLicenseKey(machineId, key); if (isValid) { const config = readConfig(); config.licenseKey = key.trim(); writeConfig(config); return { success: true }; } return { success: false }; });
ipcMain.handle('save-file-dialog', async (event, { defaultPath, fileContent }) => { const res = await dialog.showSaveDialog(mainWindow, { title: 'Lưu File V-Manga', defaultPath, filters: [{ name: 'Excel', extensions: ['xlsx'] }] }); if (res.filePath) { fs.writeFileSync(res.filePath, Buffer.from(fileContent)); return { success: true, filePath: res.filePath }; } return { success: false }; });
ipcMain.handle('save-file-custom', async (event, { path: filePath, content }) => { try { fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, Buffer.from(content)); return { success: true }; } catch (e) { return { success: false, error: e.message }; } });
ipcMain.handle('open-file-dialog', async () => { const res = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: [{ name: 'Excel', extensions: ['xlsx'] }] }); if (res.canceled) return { success: false }; const p = res.filePaths[0]; return { success: true, files: [{ path: p, name: path.basename(p), content: fs.readFileSync(p) }] }; });
ipcMain.handle('open-folder-dialog', async () => { const res = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] }); if (res.canceled) return { success: false }; return { success: true, path: res.filePaths[0] }; });
ipcMain.handle('read-dir', async (event, dirPath) => { try { const files = fs.readdirSync(dirPath).filter(f => !f.startsWith('.')); const fileList = files.map(f => ({ name: f, fullPath: path.join(dirPath, f) })); return { success: true, files: fileList }; } catch (e) { return { success: false, error: e.message }; } });
ipcMain.handle('update-jobs', async (event, { filePath, updates }) => { try { if (!fs.existsSync(filePath)) return { success: false, error: 'File not found' }; const workbook = XLSX.readFile(filePath); const worksheet = workbook.Sheets[workbook.SheetNames[0]]; const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }); const headers = data[0]; const idIdx = headers.indexOf('JOB_ID'); const statusIdx = headers.indexOf('STATUS'); if (idIdx === -1 || statusIdx === -1) return { success: false, error: 'Invalid Excel structure' }; let updatedCount = 0; for (let i = 1; i < data.length; i++) { const rowId = data[i][idIdx]; const update = updates.find(u => u.id === rowId); if (update) { data[i][statusIdx] = update.status; updatedCount++; } } const newWs = XLSX.utils.aoa_to_sheet(data); workbook.Sheets[workbook.SheetNames[0]] = newWs; XLSX.writeFile(workbook, filePath); return { success: true, count: updatedCount }; } catch (e) { return { success: false, error: e.message }; } });
ipcMain.handle('delete-file', async (event, filePath) => { try { if (fs.existsSync(filePath)) { fs.unlinkSync(filePath); return { success: true }; } return { success: true }; } catch (e) { return { success: false, error: e.message }; } });

const handleFileOrFolderChange = (event, filePath) => { try { setTimeout(() => { if (!fs.existsSync(filePath)) return; const buf = fs.readFileSync(filePath); const raw = parseExcelData(buf); const { updatedJobs } = syncStatsAndState(filePath, raw, false); event.sender.send('file-content-updated', { path: filePath, content: buf, discoveredStatus: updatedJobs }); }, 500); } catch(e) {} };

ipcMain.on('start-watching-file', (event, filePath) => {
    if (fileWatchers.has(filePath)) return;
    try { if (fs.existsSync(filePath)) { const buf = fs.readFileSync(filePath); const raw = parseExcelData(buf); const { updatedJobs } = syncStatsAndState(filePath, raw, true); event.sender.send('file-content-updated', { path: filePath, content: buf, discoveredStatus: updatedJobs }); } } catch (e) {}
    const fileWatcher = fs.watch(filePath, (ev) => { if (ev === 'change') handleFileOrFolderChange(event, filePath); });
    fileWatchers.set(filePath, fileWatcher);
    const rootDir = path.dirname(filePath);
    const excelNameNoExt = path.basename(filePath, '.xlsx');
    const subDir = path.join(rootDir, excelNameNoExt);
    if (fs.existsSync(subDir)) { const folderWatcher = fs.watch(subDir, (ev, filename) => handleFileOrFolderChange(event, filePath)); folderWatchers.set(filePath, folderWatcher); }
});

ipcMain.on('stop-watching-file', (e, p) => { if (fileWatchers.has(p)) { fileWatchers.get(p).close(); fileWatchers.delete(p); } if (folderWatchers.has(p)) { folderWatchers.get(p).close(); folderWatchers.delete(p); } });
ipcMain.on('open-folder', (e, p) => fs.existsSync(p) && shell.openPath(p));
ipcMain.on('open-video-path', (e, p) => fs.existsSync(p) && shell.openPath(p));
ipcMain.handle('check-ffmpeg', async () => ({ found: fs.existsSync(getFfmpegPath()) }));
ipcMain.handle('open-tool-flow', async () => { const p = readConfig().toolFlowPath; if (p && fs.existsSync(p)) { spawn(p, [], { detached: true, stdio: 'ignore' }).unref(); return { success: true }; } return { success: false }; });
ipcMain.handle('set-tool-flow-path', async () => { const res = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: [{ name: 'Executables', extensions: ['exe'] }] }); if (!res.canceled) { writeConfig({ ...readConfig(), toolFlowPath: res.filePaths[0] }); return { success: true, path: res.filePaths[0] }; } return { success: false }; });
