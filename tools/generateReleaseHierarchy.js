/* eslint-disable @typescript-eslint/no-var-requires */

const fs = require("fs-extra");
const os = require("os");
const path = require("path");
const binaryName = `start${os.type() === "Windows_NT" ? ".exe" : ""}`;
const targetDir = "discord-ghost";

fs.mkdirSync(targetDir);

fs.copyFileSync(binaryName, path.join(targetDir, binaryName));
fs.mkdirSync(path.join(targetDir, "node_modules", "better-sqlite3"), { recursive: true });
fs.copySync(
  path.join("node_modules", "better-sqlite3", "lib"),
  path.join(targetDir, "node_modules", "better-sqlite3", "lib")
);
fs.mkdirSync(path.join(targetDir, "node_modules", "better-sqlite3", "build"), { recursive: true });
fs.copySync(
  path.join("node_modules", "better-sqlite3", "build", "better_sqlite3.node"),
  path.join(targetDir, "node_modules", "better-sqlite3", "build", "better_sqlite3.node")
);

fs.mkdirSync(path.join(targetDir, "node_modules", "integer", "lib"), { recursive: true });
fs.copySync(
  path.join("node_modules", "integer", "lib", "index.js"),
  path.join(targetDir, "node_modules", "integer", "lib", "index.js")
);
fs.mkdirSync(path.join(targetDir, "node_modules", "integer", "build"), { recursive: true });
fs.copySync(
  path.join("node_modules", "integer", "build", "integer.node"),
  path.join(targetDir, "node_modules", "integer", "build", "integer.node")
);
