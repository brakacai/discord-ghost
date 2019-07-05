/* istanbul ignore file: simple wrapper, tho todo eventually */
import { Client, Presence } from "discord-rpc";
const clientId = "593302206661525504";

export class DiscordRPC {
  private client: Client;
  private static instance: DiscordRPC;
  public static readonly maxStateLength: number = 128;
  /*
   * Public static readonly maxLargeTe: number = 128;
   * public static readonly maxStateLength: number = 128;
   */

  public static getInstance(): Promise<DiscordRPC> {
    DiscordRPC.instance = new DiscordRPC();
    const promise = new Promise<DiscordRPC>(resolve => {
      DiscordRPC.instance.client.on("ready", () => {
        resolve(DiscordRPC.instance);
      });
      DiscordRPC.instance.client.login({ clientId });
    });
    return promise;
  }

  public async setActivity(rpcActivity: Presence): Promise<void> {
    return this.client.setActivity({
      ...this.sanitizeActivity(rpcActivity),
      instance: false
    });
  }

  private sanitizeActivity(rpcActivity: Presence): Presence {
    return {
      ...rpcActivity,
      details: rpcActivity.details.substr(0, DiscordRPC.maxStateLength),
      state: rpcActivity.state.substr(0, DiscordRPC.maxStateLength),
      smallImageText: rpcActivity.smallImageText.substr(0, DiscordRPC.maxStateLength),
      largeImageText: rpcActivity.largeImageText.substr(0, DiscordRPC.maxStateLength)
    };
  }

  private constructor() {
    this.client = new Client({ transport: "ipc" });
  }
}
