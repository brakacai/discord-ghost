/* istanbul ignore file: only a basic runner for now, it'll be scrapped */
import { DiscordRPC } from "./DiscordRPC";
import { Database } from "./Database";
import * as path from "path";
import * as os from "os";
import { Client } from "./Client";
import { OAuthClient } from "./OAuth";

export const foo = async function(): Promise<void> {
  console.log(path.join(os.homedir(), "discord-ghost", "data"));
  const database = await Database.getInstance(path.join(os.homedir(), "discord-ghost", "data"));
  const rpc = await DiscordRPC.getInstance();
  const oAuth = await OAuthClient.getInstance();
  new Client(database, rpc, oAuth);
};
