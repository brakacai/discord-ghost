import { isPlatformSupported } from "../src/Utils";
import { expect } from "chai";
import { BungieMembershipType } from "bungie-api-ts/common";

describe("Utils", () => {
  describe("#isValidPlatform", () => {
    it("should return true for curated platforms", () => {
      const curatedPlatform = [
        BungieMembershipType.TigerBlizzard,
        BungieMembershipType.TigerPsn,
        BungieMembershipType.TigerXbox
      ];
      curatedPlatform.forEach(platform => {
        expect(isPlatformSupported(platform), `${platform} is not recognized`).to.be.true;
      });
    });

    it("should return false for non-curated platforms", () => {
      [BungieMembershipType.None, BungieMembershipType.BungieNext, BungieMembershipType.All].forEach(platform => {
        expect(isPlatformSupported(platform), `${platform} is wrongly recognized`).to.be.false;
      });
    });
  });
});
