/* istanbul ignore file: simple wrapper, tho todo eventually */
import { Client, Presence } from "discord-rpc";
const clientId = "593302206661525504";

export class DiscordRPC {
  private client: Client;
  private static instance: DiscordRPC;

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
      ...rpcActivity,
      instance: false
    });
  }

  private constructor() {
    this.client = new Client({ transport: "ipc" });
  }
}
