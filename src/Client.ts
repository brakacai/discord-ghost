/* istanbul ignore file: techdebt, todo */

import { Database } from "./Database";
import { DiscordRPC } from "./DiscordRPC";
import { Presence } from "discord-rpc";
import {
  DestinyComponentType,
  DestinyCharacterActivitiesComponent,
  DestinyCharacterComponent,
  DestinyActivityDefinition,
  DestinyActivityModeDefinition,
  DestinyClassDefinition,
  DestinyLinkedProfilesResponse,
  DestinyActivityModeType,
  DestinyDestinationDefinition
} from "bungie-api-ts/destiny2/interfaces";
import { getFromBungie } from "./Utils";
import { ServerResponse, PlatformErrorCodes, BungieMembershipType } from "bungie-api-ts/common";
import { createHash } from "crypto";
import { System, DefaultSystem } from "./System";
import { clearInterval } from "timers";
import { OAuthClient } from "./OAuth";

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

  private static readonly PLACE_ORBIT: number = 2961497387;
  private static readonly ACTIVITY_TYPE_FORGE: number = 838603889;
  private static readonly ACTIVITY_TYPE_MENAGERIE: number = 400075666;
  private static readonly PLAYLIST_PRIVATE_GAMBIT: number = 2624692004;

  private interval: NodeJS.Timeout;

  private database: Database;
  private discordRpc: DiscordRPC;
  private refreshRate: number;
  private oAuthClient: OAuthClient;
  private membershipPerPlatform: Map<BungieMembershipType, string>;

  private lastActivity: string;

  public constructor(
    database: Database,
    discordRpc: DiscordRPC,
    oAuthClient: OAuthClient,
    refreshRate: number = 15e3,
    startNow: boolean = true
  ) {
    this.database = database;
    this.oAuthClient = oAuthClient;
    this.discordRpc = discordRpc;
    this.refreshRate = refreshRate;
    this.membershipPerPlatform = new Map<BungieMembershipType, string>();
    if (startNow) {
      this.start();
    }
  }

  private async getCharacterInformation(): Promise<DestinyCharacterActivitiesComponentResponse> {
    const agreggatedResponse: DestinyCharacterActivitiesComponentResponse = {
      characterActivities: { data: {} },
      characters: { data: {} }
    };
    const iterator = await this.membershipPerPlatform.entries();

    while (true) {
      const it = iterator.next();
      if (it.done) {
        break;
      }
      const response = await getFromBungie<ServerResponse<DestinyCharacterActivitiesComponentResponse>>(
        {
          uri: `Destiny2/${it.value[0]}/Profile/${it.value[1]}`,
          components: [DestinyComponentType.CharacterActivities, DestinyComponentType.Characters]
        },
        await this.oAuthClient.getAccessToken()
      );

      if (response.ErrorCode !== PlatformErrorCodes.Success) {
        // TODO
        debugger;
      }
      Object.assign(agreggatedResponse.characterActivities.data, response.Response.characterActivities.data);
      Object.assign(agreggatedResponse.characters.data, response.Response.characters.data);
    }
    return agreggatedResponse;
  }

  private async getLinkedProfiles(): Promise<DestinyLinkedProfilesResponse> {
    const response = await getFromBungie<ServerResponse<DestinyLinkedProfilesResponse>>(
      {
        uri: `Destiny2/-1/Profile/${await this.oAuthClient.getMembershipId()}/LinkedProfiles`
      },
      await this.oAuthClient.getAccessToken()
    );

    if (response.ErrorCode !== PlatformErrorCodes.Success) {
      // TODO
    }
    return response.Response;
  }

  public async start(): Promise<void> {
    if (!this.interval) {
      console.log("Starting service");
      const linkedProfileResponse = await this.getLinkedProfiles();
      linkedProfileResponse.profiles.forEach(profile =>
        this.membershipPerPlatform.set(profile.membershipType, profile.membershipId)
      );

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

        const currentActivityData = response.characterActivities.data[currentCharacterId];
        const currentCharacterData = response.characters.data[currentCharacterId];

        if (this.getActivityHash(currentActivityData) != this.lastActivity) {
          const activityInfo = this.getActivityInfo(currentActivityData, currentCharacterData);
          activityInfo.largeImageKey = this.sanitizeLargeImageKey(activityInfo.largeImageKey);
          if (activityInfo.smallImageKey) {
            activityInfo.smallImageKey = this.sanitizeSmallImageKey(activityInfo.smallImageKey);
          }
          console.log(`\nNew activity:\n${activityInfo.details || ""}\n${activityInfo.state}`);
          this.discordRpc.setActivity(activityInfo);
          this.lastActivity = this.getActivityHash(currentActivityData);
        }
      }, this.refreshRate);
    }
  }

  private getActivityHash(currentActivityData: DestinyCharacterActivitiesComponent): string {
    return Buffer.from(currentActivityData.currentActivityHash + currentActivityData.dateActivityStarted).toString(
      "base64"
    );
  }

  private getCurrentCharacterId(response: DestinyCharacterActivitiesComponentResponse): string {
    let currentCharacterId: string;
    if (!response.characterActivities.data) {
      console.warn(
        "No character activities found, try to modify your privacy settings (see https://github.com/brakacai/discord-ghost/docs/PrivacySettings.md)"
      );
    }
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

  private getActivityInfo(
    currentActivityData: DestinyCharacterActivitiesComponent,
    currentCharacterData: DestinyCharacterComponent
  ): Presence {
    const currentActivity = this.database.getFromDatabase<DestinyActivityDefinition>(
      "DestinyActivityDefinition",
      currentActivityData.currentActivityHash
    );

    if (this.isActivityOrbit(currentActivity)) {
      // Orbit has no additional data to show
      return {
        state: "In Orbit",
        largeImageKey: "default_large",
        largeImageText: "In Orbit",
        startTimestamp: Date.now() // Bungie does not restart the timer...
      };
    }

    const currentActivityMode = this.database.getFromDatabase<DestinyActivityModeDefinition>(
      "DestinyActivityModeDefinition",
      currentActivityData.currentActivityModeHash
    );

    const currentPlaylist = this.database.getFromDatabase<DestinyActivityDefinition>(
      "DestinyActivityDefinition",
      currentActivityData.currentPlaylistActivityHash
    );

    const currentCharacterRace = this.database.getFromDatabase<DestinyClassDefinition>(
      "DestinyClassDefinition",
      currentCharacterData.classHash
    );

    const currentPlaylistDestination = this.database.getFromDatabase<DestinyDestinationDefinition>(
      "DestinyDestinationDefinition",
      currentPlaylist.destinationHash
    );

    const currentActivityDestination = this.database.getFromDatabase<DestinyDestinationDefinition>(
      "DestinyDestinationDefinition",
      currentActivity.destinationHash
    );
    const activityInfo: Presence = {
      smallImageText: `${currentCharacterRace.displayProperties.name} \u2013 ${currentCharacterData.light}`,
      startTimestamp: Date.parse(currentActivityData.dateActivityStarted)
    };

    if (this.isActivityPvp(currentActivity)) {
      return {
        ...activityInfo,
        state: `${currentPlaylist.displayProperties.name} - ${currentActivityMode.displayProperties.name}`,
        smallImageKey: currentActivityMode.displayProperties.icon,
        largeImageKey: currentActivity.pgcrImage,
        largeImageText: `${currentActivity.displayProperties.name} - ${currentActivity.displayProperties.description}`,
        startTimestamp: Date.parse(currentActivityData.dateActivityStarted)
      };
    }

    if (this.isActivityForge(currentActivity)) {
      return {
        ...activityInfo,
        state: `${currentActivity.displayProperties.name} - ${currentPlaylist.displayProperties.name}`,
        smallImageKey: currentPlaylist.displayProperties.icon,
        largeImageKey: currentPlaylist.pgcrImage,
        largeImageText: `${currentPlaylistDestination.displayProperties.name} - ${currentPlaylistDestination.displayProperties.description}`,
        startTimestamp: Date.parse(currentActivityData.dateActivityStarted)
      };
    }

    if (this.isActivityGambit(currentActivity)) {
      return {
        ...activityInfo,
        state: `${currentPlaylist.hash === Client.PLAYLIST_PRIVATE_GAMBIT ? "Gambit - " : ""}${
          currentPlaylist.displayProperties.name
        }`,
        smallImageKey: currentActivityMode.displayProperties.icon,
        largeImageKey: currentActivity.pgcrImage,
        largeImageText: `${currentActivityDestination.displayProperties.name} - ${currentActivityDestination.displayProperties.description}`
      };
    }

    if (this.isMenagerie(currentActivity)) {
      return {
        ...activityInfo,
        state: currentActivity.displayProperties.name,
        smallImageKey: currentActivity.displayProperties.icon,
        largeImageKey: currentActivity.pgcrImage,
        largeImageText: `${currentPlaylistDestination.displayProperties.name}`
      };
    }

    if (this.isNightfall(currentActivity)) {
      return {
        ...activityInfo,
        state: `Strike - ${currentActivity.displayProperties.name}`,
        smallImageKey: currentActivity.displayProperties.icon,
        largeImageKey: currentActivity.pgcrImage,
        largeImageText: `${currentPlaylistDestination.displayProperties.name} - ${currentPlaylistDestination.displayProperties.description}`
      };
    }

    if (this.isStrike(currentActivity)) {
      return {
        ...activityInfo,
        state: currentActivity.displayProperties.name.replace(":", " -"),
        smallImageKey: currentActivity.displayProperties.icon,
        largeImageKey: currentActivity.pgcrImage,
        largeImageText: `${currentPlaylistDestination.displayProperties.name} - ${currentPlaylistDestination.displayProperties.description}`
      };
    }

    return {
      ...activityInfo,
      state: `${currentActivityMode.displayProperties.name} - ${
        currentPlaylist.displayProperties.name
          ? currentPlaylist.displayProperties.name
          : currentActivity.displayProperties.name
      }`,
      smallImageKey: currentActivityMode.displayProperties.icon,
      largeImageText: `${currentPlaylistDestination.displayProperties.name} - ${currentPlaylistDestination.displayProperties.description}`,
      largeImageKey: currentActivity.pgcrImage
    };
  }

  private isStrike(currentActivity: DestinyActivityDefinition): boolean {
    return currentActivity.activityModeTypes.includes(DestinyActivityModeType.AllStrikes);
  }

  private isNightfall(currentActivity: DestinyActivityDefinition): boolean {
    const nightfallTypeIds = [16, 17, 46, 47];
    return currentActivity.activityModeTypes.some(activityType =>
      nightfallTypeIds.some(nightfallType => activityType === nightfallType)
    );
  }

  private isMenagerie(currentActivity: DestinyActivityDefinition): boolean {
    return currentActivity.activityTypeHash == Client.ACTIVITY_TYPE_MENAGERIE;
  }

  private isActivityGambit(currentActivity: DestinyActivityDefinition): boolean {
    return (
      currentActivity.activityModeTypes.includes(DestinyActivityModeType.Gambit) ||
      currentActivity.activityModeTypes.includes(DestinyActivityModeType.GambitPrime)
    );
  }

  private isActivityForge(currentActivity: DestinyActivityDefinition): boolean {
    return currentActivity.activityTypeHash == Client.ACTIVITY_TYPE_FORGE;
  }

  private isActivityPvp(currentActivity: DestinyActivityDefinition): boolean {
    return currentActivity.activityModeTypes.includes(DestinyActivityModeType.AllPvP);
  }

  private isActivityOrbit(currentActivity: DestinyActivityDefinition): boolean {
    return currentActivity.placeHash == Client.PLACE_ORBIT;
  }

  private sanitizeSmallImageKey(smallImageKey: string): string {
    const smallImage = Client.System.path.parse(smallImageKey).name;
    return smallImage.substr(smallImage.indexOf("_") + 1);
  }

  private sanitizeLargeImageKey(largeImageKey: string): string {
    return largeImageKey !== "default_large"
      ? createHash("md5")
          .update(Client.System.path.parse(largeImageKey).name)
          .digest("hex")
      : "default_large";
  }
}
