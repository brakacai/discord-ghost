import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import { prompt, Questions } from "inquirer";
import { getFromBungie, isPlatformSupported } from "./Utils";
import { BungieMembershipType, ServerResponse } from "bungie-api-ts/common";
import { UserInfoCard } from "bungie-api-ts/user/interfaces";

/**
 * Minimal data required to get meaningful info on the user.
 */
export interface ConfigFileData {
  playerId: string;
  apiKey: string;
  platform: BungieMembershipType;
}
type PartialConfigFileData = {
  [P in keyof ConfigFileData]?: ConfigFileData[P];
};

/**
 * Config-factory. Either get one from a path, or create a new one from user inputs.
 */
export class ConfigFile {
  //#region Config file paths.
  private static CONFIG_FOLDER_NAME = "ghost-discord";
  private static CONFIG_FILE_NAME = "config.json";
  private static CONFIG_FILE_PATH = path.join(
    os.homedir(),
    ConfigFile.CONFIG_FOLDER_NAME,
    ConfigFile.CONFIG_FILE_NAME
  );
  //#endregion

  /**
   * The data of the user, useful for querying Bungie API.
   */
  private _data: ConfigFileData;
  public get data(): ConfigFileData {
    return this._data;
  }
  public set data(v: ConfigFileData) {
    this._data = v;
  }

  //#region Factories & constructor
  /**
   * Create a new ConfigFile from scratch
   */
  public static async createNewConfig(): Promise<ConfigFile> {
    const answers = await ConfigFile.getInfoFromUser();
    const apiKey: string = answers.API_KEY;
    const { playerId, platform } = await ConfigFile.getPlayerIdFromPlayerName(
      answers.PLAYER_NAME,
      apiKey
    );
    const configFileData = {
      platform: platform,
      apiKey: apiKey,
      playerId: playerId
    };
    ConfigFile.writeConfig(configFileData);
    return new ConfigFile(configFileData);
  }

  /**
   * Try to load the config file in the User directory.
   */
  public static getExistingConfig(): Promise<ConfigFile> {
    return this.getConfigFromPath(this.CONFIG_FILE_PATH);
  }

  /**
   * Try to load the config from file, will create a new one if none is found
   * or if it is corrupted.
   * @param path the path to try to load
   */
  public static getConfigFromPath(path: string): Promise<ConfigFile> {
    if (this.hasConfigFile(path)) {
      let configFile;
      try {
        configFile = JSON.parse(
          fs.readFileSync(path).toString()
        );  
      } catch (error) {
        console.warn(`Failed to read config file at: ${path}.`)
      }
      if (ConfigFile.isConfigFileValid(configFile)) {
        console.log("Config file found");
        return Promise.resolve(new ConfigFile(configFile));
      }
      console.warn("Config file is corrupted, deleting...");
      fs.unlinkSync(ConfigFile.CONFIG_FILE_PATH);
    }
    return ConfigFile.createNewConfig();
  }

  /**
   * Create a Config from the configFileData
   * @param configFileData the data on which to build the Config
   */
  private constructor(configFileData: ConfigFileData) {
    this.data = configFileData;
  }
  //#endregion

  //#region File Manipulation functions
  /**
   * Check if the file at the configFilePath is readable.
   * @param configFilePath a path to a configFile
   */
  private static hasConfigFile(configFilePath: string): boolean {
    try {
      fs.accessSync(configFilePath, fs.constants.R_OK);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if an object is a @interface ConfigFileData
   * @param obj an object to check
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static isConfigFileValid(obj: any): obj is ConfigFileData {
    if (!obj || !obj.playerId || !obj.apiKey) {
      return false;
    }
    return isPlatformSupported(obj.platform);
  }

  /**
   * Save the config file in the `CONFIG_FOLDER_NAME`
   * @param configFileData the config to write
   */
  private static writeConfig(configFileData: ConfigFileData): void {
    const fullDirPath = path.join(os.homedir(), this.CONFIG_FOLDER_NAME);
    try {
      fs.statSync(fullDirPath);
    } catch (error) {
      fs.mkdirSync(fullDirPath);
    }
    try {
      fs.statSync(this.CONFIG_FILE_PATH);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
      fs.writeFileSync(this.CONFIG_FILE_PATH, JSON.stringify(configFileData));
    }
  }
  //#endregion

  /**
   * Prompt some questions to the user to get his basic infos.
   */
  private static getInfoFromUser(): Promise<Record<string, string>> {
    const questions: Questions = [
      {
        name: "API_KEY",
        type: "password",
        message:
          "What is your Bungie.net API-Key? (see https://bungie.net/en/Application/Create)",
        mask: "*"
      },
      {
        name: "PLAYER_NAME",
        type: "input",
        message: "What is your BattleTag/PlaystationID/Gamertag?",
        when: (answers): boolean => {
          return !!answers.API_KEY;
        }
      }
    ];
    return prompt(questions);
  }

  /**
   * Get the basic Ids of the players from Bungie.
   * @param playerName A BattleTag/PSN ID/GamerTag/(SteamId?)
   * @param apiKey The API key to use
   */
  private static async getPlayerIdFromPlayerName(
    playerName: string,
    apiKey: string
  ): Promise<PartialConfigFileData> {
    // Call the server and get the infos.
    const playersInfoResponse = await getFromBungie<ServerResponse<UserInfoCard[]>>(
      {
        uri: `/Destiny2/SearchDestinyPlayer/${
          BungieMembershipType.All
        }/${encodeURIComponent(playerName)}`
      },
      apiKey
    );

    // Get the platformID and playerId.
    if (
      playersInfoResponse.Response &&
      playersInfoResponse.Response.length > 0
    ) {
      return {
        playerId: playersInfoResponse.Response[0].membershipId as string,
        platform: playersInfoResponse.Response[0]
          .membershipType as BungieMembershipType
      };
    } else {
      throw new Error("Player not found");
    }
  }
}
