/* istanbul ignore file: TODO */

import { app } from "electron";
import path from "path";

export function initProtocolHandling(): void {
  app.removeAsDefaultProtocolClient("discord-ghost");
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient("discord-ghost", process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient("discord-ghost");
  }

  app.on("open-url", (event, url) => {
    console.log("Welcome Back", `You arrived from: ${url}`);
  });
}
