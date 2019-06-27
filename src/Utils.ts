import { DestinyComponentType, BungieMembershipType } from "bungie-api-ts/destiny2";
import { get } from "request";

/**
 * The param to send to @function getFromBungie to get some data.
 */
interface BungieAPIParams {
  uri: string;
  components?: DestinyComponentType | DestinyComponentType[];
}

/**
 * Call the [Bungie.Net API](https://github.com/Bungie-net/api)
 * @param data uri and params to call the API
 * @param bungiekey the API Key to authorize the call
 */
export async function getFromBungie<T>(
  data: BungieAPIParams,
  bungiekey: string
): Promise<T> {
  const url = new URL(`https://www.bungie.net/Platform/${data.uri}`);
  // Normalize components as an array.
  if (data.components) {
    data.components = Array.isArray(data.components)
      ? data.components
      : [data.components];
    url.searchParams.set("components", data.components.join(","));
  }
  return new Promise<T>((resolve, reject): void => {
    get(
      url.toString(),
      { headers: { "X-API-Key": bungiekey } },
      (err, response): void => {
        if (err) {
          reject(err);
        }
        if (response && response.statusCode === 200) {
          resolve(JSON.parse(response.body) as T);
        }
      }
    );
  });
}

/**
 * Supported BungieMembershipType.
 */
export const CURATED_PLATFORM: BungieMembershipType[] = [BungieMembershipType.TigerBlizzard,BungieMembershipType.TigerPsn,BungieMembershipType.TigerXbox];

/**
 * Check if the BungieMembershipType is supported/valid.
 * @param platform the BungieMembershipType if all's good.
 */
export function isPlatformSupported(
  platform: number
): boolean {
  return CURATED_PLATFORM.includes(platform);
}
