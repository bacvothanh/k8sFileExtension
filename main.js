// main.js
const { app, BrowserWindow, ipcMain } = require('electron/main')
const { executeCommand } = require('./powershell');
const { ensureDebugInConfigMap } = require('./configmap');
const path = require('path');
const fs = require('fs');
const os = require('os');

function createWindow () {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,    // 👈 BẮT BUỘC để preload.js chạy an toàn
      nodeIntegration: false     // 👈 BẮT BUỘC để ngăn dùng require trong renderer
    }
  })

  win.loadFile('index.html')
  win.setMenuBarVisibility(false);
  win.maximize(); 
  //win.webContents.openDevTools();
}

// IPC handler
ipcMain.handle('run-powershell', async (event, command) => {
  try {
    return await executeCommand(command);
  } catch (err) {
    return `Error: ${err.message}`;
  }
});

ipcMain.handle('ensure-debug', async (event, namespace, configMapName) => {
  return await ensureDebugInConfigMap(namespace, configMapName, executeCommand);
});

ipcMain.handle('save-temp-file', async (event, filename, content) => {
  try {
    const appRoot = path.dirname(app.getPath('exe')); // 📌 Tránh dùng __dirname
    const tempPath = path.join(appRoot, filename);

    fs.writeFileSync(tempPath, content, 'utf8');

    // Chuyển path sang định dạng dùng được cho kubectl cp
    const relativePath = tempPath.replace(/^.:/, ''); // loại bỏ C: hoặc D:
    const kubectlPath = relativePath.replace(/\\/g, '/');

    return kubectlPath.startsWith('/') ? kubectlPath : `/${kubectlPath}`;
  } catch (err) {
    console.error('❌ Error saving temp file:', err);
    throw err;
  }
});

ipcMain.handle('delete-temp-file', async (event, filename) => {
  const appRoot = path.dirname(app.getPath('exe'));
  const filePath = path.join(appRoot, filename);

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return `✅ Deleted: ${filename}`;
    } else {
      return `⚠️ File not exist: ${filename}`;
    }
  } catch (err) {
    throw new Error(`❌ Cannot delete file: ${err.message}`);
  }
});


app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})