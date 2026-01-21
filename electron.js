// electron.js
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
    },
    icon: path.join(__dirname, 'assets/icon.png')
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  // IPC Handlers
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

});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
