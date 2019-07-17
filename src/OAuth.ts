import { System, DefaultSystem } from "./System";
import request from "request-promise-native";
import crypto from "crypto";
import open from "open";
import { ChildProcess } from "child_process";

import bungieApplicationSecrets from "../config/bungieApp.json";
import { clearTimeout } from "timers";

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
  membership_id: string;
}

export class OAuthClient {
  public static System: System = DefaultSystem;
  private static instance: OAuthClient;

  private state: string;
  private accessToken: string;
  private accessTokenExpiration: Date;
  private refreshToken: string;
  private refreshTokenExpiration: Date;
  private _membershipId: string;
  private refreshTimeout: NodeJS.Timeout;

  public async getMembershipId(): Promise<string> {
    if (!this._membershipId) {
      await this.getAccessToken();
    }
    return this._membershipId;
  }

  private readonly expirationOffset = 60e3;
  private browserProcess: ChildProcess;
  public static notifyAuthorizationCodeReturn: (value?: { code: string; state: string }) => void;

  public static async getInstance(): Promise<OAuthClient> {
    if (!this.instance) {
      try {
        this.System.fs.mkdirSync(this.System.path.join(this.System.os.homedir(), "discord-ghost"));
      } catch (error) {
        // Just ensure the dir is there, will check accessibility with the files
      }
      let userInfo: { token: string; expiration: string; playerId: string };
      try {
        userInfo = JSON.parse(
          this.System.fs
            .readFileSync(this.System.path.join(this.System.os.homedir(), "discord-ghost", "userSettings.json"))
            .toString()
        ) as { token: string; expiration: string; playerId: string };
      } catch (error) {}
      if (!userInfo) {
        this.instance = new OAuthClient();
        return this.instance;
      }
      const refreshToken: string = userInfo.token;
      const refreshTokenExpiration: string = userInfo.expiration;
      const membershipId: string = userInfo.playerId;
      if (refreshToken && refreshTokenExpiration && membershipId) {
        this.instance = new OAuthClient(refreshToken, parseInt(refreshTokenExpiration, 10), membershipId);
      } else {
        this.instance = new OAuthClient();
      }
    }
    return this.instance;
  }

  private async sendAuthorizationCodeRequest(): Promise<void> {
    this.state = crypto.randomBytes(16).toString("hex");
    const authorizeUrl = new URL("https://www.bungie.net/en/OAuth/Authorize");
    authorizeUrl.searchParams.set("state", this.state);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", bungieApplicationSecrets.clientId);
    this.browserProcess = await open(authorizeUrl.toString());
  }

  private constructor(refreshToken?: string, refreshTokenExpiration?: number, membershipId?: string) {
    this.refreshToken = refreshToken;
    this._membershipId = membershipId;
    this.refreshTokenExpiration = new Date(refreshTokenExpiration);
  }

  private isStateValid(state: string): boolean {
    return state === this.state;
  }

  public async getAccessToken(): Promise<string> {
    if (this.accessToken && this.accessTokenExpiration.valueOf() > Date.now()) {
      return this.accessToken;
    }

    if (this.refreshToken && this.refreshTokenExpiration.valueOf() + this.expirationOffset > Date.now()) {
      const refreshResponse = await this.refreshAccessToken();
      this.setAccessTokensInfo(refreshResponse);
      this.scheduleRefresh();
      return this.accessToken;
    }
    await this.sendAuthorizationCodeRequest();
    const authorizationCode = await this.waitForAuthorizationCodeReturn();

    const getNewAccessTokenResponse = await this.getNewAccessToken(authorizationCode);
    await this.setAccessTokensInfo(getNewAccessTokenResponse);
    this.scheduleRefresh();
    return this.accessToken;
  }

  private async setAccessTokensInfo(getNewAccessTokenResponse: TokenResponse): Promise<void> {
    this.accessTokenExpiration = new Date(
      Date.now() - this.expirationOffset + getNewAccessTokenResponse["expires_in"] * 10e3
    );
    this.refreshTokenExpiration = new Date(Date.now() + getNewAccessTokenResponse["refresh_expires_in"] * 10e3);
    this.refreshToken = getNewAccessTokenResponse["refresh_token"];
    this.accessToken = getNewAccessTokenResponse["access_token"];
    this._membershipId = getNewAccessTokenResponse["membership_id"];
    const userInfo: { token: string; expiration: string; playerId: string } = {
      token: this.refreshToken,
      expiration: this.refreshTokenExpiration.valueOf().toString(),
      playerId: this._membershipId
    };
    try {
      OAuthClient.System.fs.mkdirSync(OAuthClient.System.path.join(OAuthClient.System.os.homedir(), "discord-ghost"));
    } catch (error) {
      // Just ensure the dir is there, will check accessibility with the files
    }
    try {
      OAuthClient.System.fs.writeFileSync(
        OAuthClient.System.path.join(OAuthClient.System.os.homedir(), "discord-ghost", "userSettings.json"),
        JSON.stringify(userInfo)
      );
    } catch (error) {}
  }

  private scheduleRefresh(): void {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
    this.refreshTimeout = setTimeout(async () => {
      const refreshAccessTokenResponse = await this.refreshAccessToken();
      await this.setAccessTokensInfo(refreshAccessTokenResponse);
      this.scheduleRefresh();
    }, this.accessTokenExpiration.valueOf() - Date.now());
  }

  private waitForAuthorizationCodeReturn(): Promise<string> {
    return new Promise(async (resolve, reject) => {
      this.browserProcess.on("exit", () => {
        // Return reject("User closed browser");
      });
      const authorizationResponse = await new Promise<{ code: string; state: string }>(resolve => {
        OAuthClient.notifyAuthorizationCodeReturn = resolve;
      });
      if (!this.isStateValid(authorizationResponse.state)) {
        return reject("Response state invalid");
      }
      this.browserProcess.kill();
      resolve(authorizationResponse.code);
    });
  }

  private async getNewAccessToken(authorizationCode: string): Promise<TokenResponse> {
    /* eslint-disable  @typescript-eslint/camelcase */
    const form: { grant_type: string; code: string } = { grant_type: "authorization_code", code: authorizationCode };
    /* eslint-enable  @typescript-eslint/camelcase */
    return this.queryAccessTokenEndpoint(form);
  }

  private async queryAccessTokenEndpoint(form: {
    grant_type: string;
    code?: string;
    refresh_token?: string;
  }): Promise<TokenResponse> {
    const accessTokenUrl = new URL("https://www.bungie.net/platform/app/oauth/token/");
    const authorizationHeader = `Basic ${Buffer.from(
      `${bungieApplicationSecrets.clientId}:${bungieApplicationSecrets.clientSecret}`
    ).toString("base64")}`;
    return (await request(accessTokenUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: authorizationHeader
      },
      form: form,
      json: true
    })) as TokenResponse;
  }

  private async refreshAccessToken(): Promise<TokenResponse> {
    /* eslint-disable  @typescript-eslint/camelcase */
    const form: { grant_type: string; refresh_token: string } = {
      grant_type: "refresh_token",
      refresh_token: this.refreshToken
    };
    /* eslint-enable  @typescript-eslint/camelcase */
    return this.queryAccessTokenEndpoint(form);
  }
}
