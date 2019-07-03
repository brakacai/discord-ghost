/* istanbul ignore file: We don't test node behavior */
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";

/**
 * Collections of basic native modules.
 */
export interface System {
  fs: typeof fs;
  os: typeof os;
  path: typeof path;
  zlib: typeof zlib;
}

/**
 * The native modules.
 */
export const DefaultSystem: System = {
  fs: fs,
  os: os,
  path: path,
  zlib: zlib
};
