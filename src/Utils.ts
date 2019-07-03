import { DestinyComponentType, BungieMembershipType } from "bungie-api-ts/destiny2";
import { get } from "request-promise-native";
import { System } from "./System";

const BUNGIE_ENDPOINT = "https://www.bungie.net/Platform";
/**
 * The param to send to @function getFromBungie to get some data.
 */
export interface BungieAPIParams {
  uri: string;
  components?: DestinyComponentType | DestinyComponentType[];
}

/**
 * Call the [Bungie.Net API](https://github.com/Bungie-net/api)
 * @param params uri and params to call the API
 * @param bungiekey the API Key to authorize the call
 */
export async function getFromBungie<T>(params: BungieAPIParams, bungiekey: string): Promise<T> {
  const url = new URL(`${BUNGIE_ENDPOINT}/${params.uri}`);
  // Normalize components as an array.
  if (params.components) {
    params.components = Array.isArray(params.components) ? params.components : [params.components];
    url.searchParams.set("components", params.components.join(","));
  }
  try {
    return (await get({ uri: url.toString(), headers: { "X-API-Key": bungiekey }, json: true })) as T;
  } catch (error) {
    return error;
  }
}

/**
 * Supported BungieMembershipType.
 */
export const CURATED_PLATFORM: BungieMembershipType[] = [
  BungieMembershipType.TigerBlizzard,
  BungieMembershipType.TigerPsn,
  BungieMembershipType.TigerXbox
];

/**
 * Check if the BungieMembershipType is supported/valid.
 * @param platform the BungieMembershipType if all's good.
 */
export function isPlatformSupported(platform: number): boolean {
  return CURATED_PLATFORM.includes(platform);
}

export function createHierarchyIfNeeded(system: System, targetDirectory: string): void {
  try {
    system.fs.accessSync(targetDirectory, system.fs.constants.F_OK);
    return;
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
  system.fs.mkdirSync(targetDirectory, { recursive: true });
}
