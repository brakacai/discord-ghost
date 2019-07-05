/* istanbul ignore file: techdebt, todo */

import { Database } from "./Database";
import { ConfigFile } from "./Config";
import { DiscordRPC } from "./DiscordRPC";
import {
  DestinyComponentType,
  DestinyCharacterActivitiesComponent,
  DestinyCharacterComponent,
  DestinyActivityDefinition,
  DestinyActivityModeDefinition,
  DestinyPlaceDefinition,
  DestinyClassDefinition
} from "bungie-api-ts/destiny2/interfaces";
import { getFromBungie } from "./Utils";
import { ServerResponse, PlatformErrorCodes } from "bungie-api-ts/common";
import { createHash } from "crypto";
import { System, DefaultSystem } from "./System";
import { clearInterval } from "timers";

interface CharacterComponentsData<T> {
  [characterId: string]: T;
}
interface CharacterComponentsDataWrapper<T> {
  data: CharacterComponentsData<T>;
}

interface DestinyCharacterActivitiesComponentResponse {
  characterActivities: CharacterComponentsDataWrapper<DestinyCharacterActivitiesComponent>;
  characters: CharacterComponentsDataWrapper<DestinyCharacterComponent>;
}
export class Client {
  public static System: System = DefaultSystem;

  private interval: NodeJS.Timeout;

  private database: Database;
  private configFile: ConfigFile;
  private discordRpc: DiscordRPC;
  private refreshRate: number;

  public constructor(
    database: Database,
    configFile: ConfigFile,
    discordRpc: DiscordRPC,
    refreshRate: number = 10e3,
    startNow: boolean = true
  ) {
    this.database = database;
    this.configFile = configFile;
    this.discordRpc = discordRpc;
    this.refreshRate = refreshRate;

    if (startNow) {
      this.start();
    }
  }

  private async getCharacterInformation(): Promise<DestinyCharacterActivitiesComponentResponse> {
    const response = await getFromBungie<ServerResponse<DestinyCharacterActivitiesComponentResponse>>(
      {
        uri: `Destiny2/${this.configFile.data.platform}/Profile/${this.configFile.data.playerId}`,
        components: [DestinyComponentType.CharacterActivities, DestinyComponentType.Characters]
      },
      this.configFile.data.apiKey
    );

    if (response.ErrorCode !== PlatformErrorCodes.Success) {
      // TODO
    }
    return response.Response;
  }

  public start(): void {
    if (!this.interval) {
      console.log("Starting service");
      this.interval = setInterval(async () => {
        let response;
        try {
          response = await this.getCharacterInformation();
        } catch (error) {
          throw error;
        }

        const currentCharacterId = this.getCurrentCharacterId(response);
        if (!currentCharacterId) {
          return this.stop();
        }

        const currentActivity = this.database.getFromDatabase<DestinyActivityDefinition>(
          "DestinyActivityDefinition",
          response.characterActivities.data[currentCharacterId].currentActivityHash
        );

        let additionalInfos;

        if (currentActivity.directActivityModeHash) {
          const activityMode = this.database.getFromDatabase<DestinyActivityModeDefinition>(
            "DestinyActivityModeDefinition",
            currentActivity.directActivityModeHash
          );
          additionalInfos = activityMode;
        } else {
          const destination = this.database.getFromDatabase<DestinyPlaceDefinition>(
            "DestinyPlaceDefinition",
            currentActivity.placeHash
          );
          additionalInfos = destination;
        }

        const smallImageKey = Client.System.path.parse(additionalInfos.displayProperties.icon).name;
        const currentCharacterData = response.characters.data[currentCharacterId];
        const currentCharacterRace = this.database.getFromDatabase<DestinyClassDefinition>(
          "DestinyClassDefinition",
          currentCharacterData.classHash
        );

        this.discordRpc.setActivity({
          state: this.getState(currentActivity, additionalInfos.displayProperties.name),
          details: additionalInfos.displayProperties.name,
          largeImageKey: this.getLargeImageKey(currentActivity),
          largeImageText: currentActivity.displayProperties.name,
          smallImageKey: this.getSmallImageKey(smallImageKey),
          smallImageText: `${currentCharacterRace.displayProperties.name} - ${currentCharacterData.light}`,
          startTimestamp: Date.parse(response.characterActivities.data[currentCharacterId].dateActivityStarted)
        });
      }, this.refreshRate);
    }
  }

  private getCurrentCharacterId(response: DestinyCharacterActivitiesComponentResponse): string {
    let currentCharacterId: string;
    Object.keys(response.characterActivities.data).forEach(characterId => {
      if (this.isCharacterMoreRecent(currentCharacterId, response, characterId)) {
        currentCharacterId = characterId;
      }
    });
    return currentCharacterId;
  }

  private isCharacterMoreRecent(
    currentCharacterId: string,
    response: DestinyCharacterActivitiesComponentResponse,
    characterId: string
  ): boolean {
    return (
      response.characterActivities.data[characterId].currentActivityHash &&
      (!currentCharacterId ||
        new Date(response.characterActivities.data[characterId].dateActivityStarted) >
          new Date(response.characterActivities.data[currentCharacterId].dateActivityStarted))
    );
  }

  public isRunning(): boolean {
    return !!this.interval;
  }

  public stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      console.log("Service stopped");
    }
  }

  private getState(currentActivity: DestinyActivityDefinition, details: string): string {
    return currentActivity.displayProperties.description && details !== "Explore"
      ? currentActivity.displayProperties.description
      : "  ";
  }

  private getSmallImageKey(smallImageKey: string): string {
    return smallImageKey.substr(smallImageKey.indexOf("_") + 1);
  }

  private getLargeImageKey(currentActivity: DestinyActivityDefinition): string {
    return currentActivity.pgcrImage
      ? createHash("md5")
          .update(Client.System.path.parse(currentActivity.pgcrImage).name)
          .digest("hex")
      : "default_large";
  }
}
