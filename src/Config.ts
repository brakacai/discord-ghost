import { prompt, Questions } from "inquirer";
import { getFromBungie, isPlatformSupported, createHierarchyIfNeeded } from "./Utils";
import { BungieMembershipType, ServerResponse, PlatformErrorCodes } from "bungie-api-ts/common";
import { UserMembership } from "bungie-api-ts/user/interfaces";
import { System, DefaultSystem } from "./System";

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
  public static System: System = DefaultSystem;
  // #region Config file paths.
  private static CONFIG_FOLDER_NAME = "discord-ghost";
  private static CONFIG_FILE_NAME = "config.json";
  private static CONFIG_FILE_PATH = ConfigFile.System.path.join(
    ConfigFile.System.os.homedir(),
    ConfigFile.CONFIG_FOLDER_NAME,
    ConfigFile.CONFIG_FILE_NAME
  );
  // #endregion

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

  // #region Factories & constructor
  /**
   * Create a new ConfigFile from scratch
   */

  /* istanbul ignore next: defaultAssignement */
  public static async createNewConfig(configPath: string = this.CONFIG_FILE_PATH): Promise<ConfigFile> {
    const answers = await ConfigFile.getInfoFromUser();
    const apiKey: string = answers.API_KEY;
    try {
      const { playerId, platform } = await ConfigFile.getPlayerInfoFromPlayerName(answers.PLAYER_NAME, apiKey);
      const configFileData = {
        platform: platform,
        apiKey: apiKey,
        playerId: playerId
      };
      ConfigFile.writeConfig(configFileData, configPath);

      return new ConfigFile(configFileData);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * Try to load the config file in the User directory.
   */
  /* istanbul ignore next: defaultAssignement */
  public static getExistingConfig(): Promise<ConfigFile> {
    /* istanbul ignore next: defaultAssignement */
    return this.getConfigFromPath(this.CONFIG_FILE_PATH);
  }

  /**
   * Try to load the config from file, will create a new one if none is found
   * or if it is corrupted.
   * @param configPath the path to try to load
   */
  public static getConfigFromPath(configPath: string): Promise<ConfigFile> {
    if (this.hasConfigFile(configPath)) {
      let configFile;
      try {
        configFile = JSON.parse(ConfigFile.System.fs.readFileSync(configPath).toString());
      } catch (error) {
        console.warn(`Failed to read config file at: ${configPath}.`);
      }
      if (ConfigFile.isConfigFileValid(configFile)) {
        console.log("Config file found");
        return Promise.resolve(new ConfigFile(configFile));
      }
      console.warn("Config file is corrupted, deleting...");
      ConfigFile.System.fs.unlinkSync(configPath);
    }
    return ConfigFile.createNewConfig(configPath);
  }

  /**
   * Create a Config from the configFileData
   * @param configFileData the data on which to build the Config
   */
  private constructor(configFileData: ConfigFileData) {
    this.data = configFileData;
  }
  // #endregion

  // #region File Manipulation functions
  /**
   * Check if the file at the configFilePath is readable.
   * @param configFilePath a path to a configFile
   */
  private static hasConfigFile(configFilePath: string): boolean {
    try {
      ConfigFile.System.fs.accessSync(configFilePath, ConfigFile.System.fs.constants.R_OK);
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
  private static writeConfig(configFileData: ConfigFileData, configPath: string): void {
    const configPathObj = ConfigFile.System.path.parse(configPath);
    try {
      createHierarchyIfNeeded(ConfigFile.System, configPathObj.dir);
      ConfigFile.System.fs.accessSync(configPath, ConfigFile.System.fs.constants.W_OK);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
    ConfigFile.System.fs.writeFileSync(configPath, JSON.stringify(configFileData));
  }

  // #endregion

  /**
   * Prompt some questions to the user to get his basic infos.
   */
  private static getInfoFromUser(): Promise<Record<string, string>> {
    const questions: Questions = [
      {
        name: "API_KEY",
        type: "password",
        message: "What is your Bungie.net API-Key? (see https://bungie.net/en/Application/Create)",
        mask: "*"
      },
      {
        name: "PLAYER_NAME",
        type: "input",
        message: "What is your BattleTag/PlaystationID/Gamertag? (e.g. axelg#11781 for Battle.Net)",

        when: /* istanbul ignore next: depends on user input */ (answers): boolean => {
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
  private static async getPlayerInfoFromPlayerName(playerName: string, apiKey: string): Promise<PartialConfigFileData> {
    // Call the server and get the infos.
    const playersInfoResponse = await getFromBungie<ServerResponse<UserMembership[]>>(
      {
        uri: `/Destiny2/SearchDestinyPlayer/${BungieMembershipType.All}/${encodeURIComponent(playerName)}`
      },
      apiKey
    );

    // Check the response.
    if (
      !playersInfoResponse.Response ||
      !playersInfoResponse.Response.length ||
      playersInfoResponse.ErrorCode !== PlatformErrorCodes.Success
    ) {
      const error = new Error("Error occured while retrieving the player");
      error.stack = JSON.stringify(playersInfoResponse);
      throw error;
    }

    // Return the platformID and playerId.
    return {
      playerId: playersInfoResponse.Response[0].membershipId as string,
      platform: playersInfoResponse.Response[0].membershipType as BungieMembershipType
    };
  }
}
