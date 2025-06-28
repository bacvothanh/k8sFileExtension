// main.js
const { app, BrowserWindow, ipcMain } = require('electron/main')
const { executeCommand } = require('./powershell');
const { ensureDebugInConfigMap } = require('./configmap');
const path = require('path');
const fs = require('fs');
const os = require('os');

const appRoot = __dirname; 
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
    
    const tempPath = path.join(appRoot, filename);
    fs.writeFileSync(tempPath, content, 'utf8');

     // Trả về path theo định dạng dành cho kubectl cp (không chứa ổ đĩa)
    const relativePath = tempPath.replace(/^.:/, ''); // remove ổ đĩa (C:, D:, ...)
    const kubectlPath = relativePath.replace(/\\/g, '/'); // chuyển \ thành /

    return kubectlPath.startsWith('/') ? kubectlPath : `/${kubectlPath}`;
  } catch (err) {
    console.error('❌ Error saving tmp file:', err);
    throw err;
  }
});

ipcMain.handle('delete-temp-file', async (event, filename) => {
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