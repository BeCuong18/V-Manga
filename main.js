
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      webSecurity: false // Cho phép load ảnh từ ổ đĩa local qua giao thức file://
    },
    icon: path.join(__dirname, 'assets/icon.png')
  });

  // Nếu là môi trường dev, có thể trỏ tới localhost:5173 của Vite
  // Ở đây mặc định load file index.html được build
  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  // --- IPC Handlers cho File/Folder ---
  ipcMain.handle('open-folder-dialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    if (result.canceled) return { success: false };
    return { success: true, path: result.filePaths[0] };
  });

  ipcMain.handle('open-file-dialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }]
    });
    if (result.canceled) return { success: false };
    const filePath = result.filePaths[0];
    const content = fs.readFileSync(filePath);
    return { success: true, files: [{ path: filePath, content: content }] };
  });

  ipcMain.handle('read-dir', async (event, dirPath) => {
    try {
      const files = fs.readdirSync(dirPath);
      const fileList = files.map(f => ({
        name: f,
        fullPath: path.join(dirPath, f)
      }));
      return { success: true, files: fileList };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('save-file-custom', async (event, { path: filePath, content }) => {
    try {
      fs.writeFileSync(filePath, Buffer.from(content));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('save-file-dialog', async (event, { defaultPath, fileContent }) => {
    const result = await dialog.showSaveDialog({
        title: 'Lưu File V-Manga',
        defaultPath: defaultPath,
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
    });
    if (result.canceled || !result.filePath) return { success: false };
    try {
        fs.writeFileSync(result.filePath, Buffer.from(fileContent));
        return { success: true, filePath: result.filePath };
    } catch (err) {
        return { success: false, error: err.message };
    }
  });

  ipcMain.handle('show-item-in-folder', async (event, fullPath) => {
    if (fs.existsSync(fullPath)) {
      shell.showItemInFolder(fullPath);
      return { success: true };
    }
    return { success: false, error: 'File not found' };
  });

  ipcMain.handle('open-path', async (event, fullPath) => {
    if (fs.existsSync(fullPath)) {
      shell.openPath(fullPath);
      return { success: true };
    }
    return { success: false, error: 'Path not found' };
  });

  // --- Giả lập quản trị (Stats/Admin) ---
  ipcMain.handle('get-stats', async () => {
    return {
        machineId: "DEV-MACHINE-001",
        total: 150,
        promptCount: 450,
        totalCredits: 1200,
        history: [{date: "2024-01-20", count: 12}, {date: "2024-01-19", count: 25}]
    };
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
