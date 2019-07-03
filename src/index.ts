/* istanbul ignore file: only a basic runner for now, it'll be scrapped */
import { ConfigFile } from "./Config";
import { DiscordRPC } from "./DiscordRPC";
import { Database } from "./Database";
import * as path from "path";
import * as os from "os";
import { Client } from "./Client";

(async function() {
  const config = await ConfigFile.getExistingConfig();
  const database = await Database.getInstance(path.join(os.homedir(), "discord-ghost", "data"), config.data.apiKey);
  const rpc = await DiscordRPC.getInstance();

  new Client(database, config, rpc);
})();
