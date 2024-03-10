import {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  Menu,
  Tray,
  dialog,
  nativeImage,
} from "electron";
import { release } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initWebSocketServer } from "./server/app";
import {
  setupTitlebar,
  attachTitlebarToWindow,
} from "custom-electron-titlebar/main";

globalThis.__filename = fileURLToPath(import.meta.url);
globalThis.__dirname = dirname(__filename);
import AutoLaunch from "auto-launch";

initWebSocketServer();

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs    > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.DIST_ELECTRON = join(__dirname, "..");
process.env.DIST = join(process.env.DIST_ELECTRON, "../dist");
process.env.BASE = join(process.env.DIST_ELECTRON, "../");
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? join(process.env.DIST_ELECTRON, "../public")
  : process.env.DIST;

// Disable GPU Acceleration for Windows 7
if (release().startsWith("6.1")) app.disableHardwareAcceleration();

// Set application name for Windows 10+ notifications
if (process.platform === "win32") app.setAppUserModelId(app.getName());

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

if (app.isPackaged) {
  const autoLauncher = new AutoLaunch({
    name: "QueRestoPlugin",
  });

  autoLauncher
    .isEnabled()
    .then(function (isEnabled) {
      if (isEnabled) {
        return;
      }
      autoLauncher.enable();
    })
    .catch(function (err) {
      // handle error
    });
}

// Remove electron security warnings
// This warning only shows in development mode
// Read more on https://www.electronjs.org/docs/latest/tutorial/security
// process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

let win: BrowserWindow | null = null;
// Here, you can also use other preload
const preload = join(__dirname, "../preload/index.js");
const url = process.env.VITE_DEV_SERVER_URL;
const indexHtml = join(process.env.DIST, "index.html");
setupTitlebar();

async function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 240,
    resizable: false,
    title: "QueResto.com Plugin",
    icon: join(process.env.VITE_PUBLIC, "logoorange@25.png"),
    titleBarStyle: "hidden",
    maximizable: false,
    /* You can use *titleBarOverlay: true* to use the original Windows controls */
    titleBarOverlay: true,
    webPreferences: {
      preload,
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      nodeIntegration: true,

      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
      // contextIsolation: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    // electron-vite-vue#298
    win.loadURL(url);
    // Open devTool if the app is not packaged
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(indexHtml);
    //win.webContents.openDevTools({ mode: "detach" });
  }

  // Test actively push message to the Electron-Renderer
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:")) shell.openExternal(url);
    return { action: "deny" };
  });
  // win.webContents.on('will-navigate', (event, url) => { }) #344

  win.on("close", (event) => {
    if (!app["isQuiting"]) {
      event.preventDefault();
      const choice = dialog
        .showMessageBox(win, {
          type: "question",
          noLink: true,
          buttons: ["Minimizar", "Cerrar"],
          title: "¿Quieres salir o minimizar?",
          message:
            "Elige minimizar si quieres que la aplicación siga corriendo en segundo plano",
        })
        .then((choice) => {
          if (choice.response == 0) {
            win.hide();
          } else {
            app["isQuiting"] = true;
            app.quit();
          }
        });
    }

    return false;
  });

  win.on("minimize", (event) => {
    event.preventDefault();
    win.hide();
  });

  const menuTemplate = [
    {
      label: "Menú",
      submenu: [
        {
          label: "Acerca de...",
          click() {
            dialog.showMessageBox(null, {
              type: "info",
              defaultId: 2,
              title: "Información",
              message: "Plugin de impresión de QueResto.com",
              detail: `Versión ${app.getVersion()} - 24/08/2020`,
              icon: join(process.env.VITE_PUBLIC, "logoorange@25.png"),
            });
          },
        },
        { type: "separator" },
        {
          label: "Minimizar",
          click() {
            app.quit();
          },
        },
        {
          label: "Cerrar",
          click() {
            app["isQuiting"] = true;
            app.quit();
          },
        },
      ],
    },
  ];
  // @ts-ignore
  const mainMenu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(mainMenu);

  attachTitlebarToWindow(win);

  let appIcon = new Tray(join(process.env.VITE_PUBLIC, "logoorange@25.png"));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Abrir panel",
      click: function () {
        win.show();
      },
    },
    /*{
      label: 'Consola desarrollador', click: function () {
        win.webContents.openDevTools({ mode: 'detach' });
      }
    },*/
    {
      label: "Versión " + app.getVersion(),
    },
    {
      label: "Salir",
      click: function () {
        app["isQuiting"] = true;
        app.quit();
      },
    },
  ]);

  appIcon.on("click", () => {
    win.show();
  });

  appIcon.setContextMenu(contextMenu);
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  win = null;
  if (process.platform !== "darwin") app.quit();
});

app.on("second-instance", () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on("activate", () => {
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length) {
    allWindows[0].focus();
  } else {
    createWindow();
  }
});

// New window example arg: new windows url
ipcMain.handle("open-win", (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${url}#${arg}`);
  } else {
    childWindow.loadFile(indexHtml, { hash: arg });
  }
});
