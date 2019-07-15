/* istanbul ignore file: TODO */

import { app, BrowserWindow } from "electron";
import * as path from "path";
import { OAuthClient } from "./OAuth";
import { initProtocolHandling } from "./protocol";
import { foo } from "./index";
let mainWindow: Electron.BrowserWindow;
if (require("electron-squirrel-startup")) {
  app.quit();
}

const windowsOption = {
  width: 1080,
  minWidth: 680,
  height: 840,
  title: app.getName()
};

function createWindow(): void {
  const windowOptions = windowsOption;

  mainWindow = new BrowserWindow(windowOptions);
  mainWindow.loadFile(path.join(__dirname, "../index.html"));
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.requestSingleInstanceLock();
if (!app.requestSingleInstanceLock()) {
  app.quit();
}
initProtocolHandling();
require("update-electron-app")();

app.on("ready", () => {
  createWindow();
  console.log("foo");
  foo();
  try {
  } catch (error) {
    console.log(error);
  }
});

app.on("window-all-closed", () => {
  return;
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("second-instance", (_event, argv) => {
  const oAuthredirectUrl = new URL(argv.pop());

  OAuthClient.notifyAuthorizationCodeReturn({
    code: oAuthredirectUrl.searchParams.get("code"),
    state: oAuthredirectUrl.searchParams.get("state")
  });
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  }
});
