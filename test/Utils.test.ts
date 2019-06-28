import { BungieMembershipType } from "bungie-api-ts/common";
import { expect, use } from "chai";
import request from "request-promise-native";
import Sinon from "sinon";
import { BungieAPIParams, getFromBungie, isPlatformSupported } from "../src/Utils";

use(require("sinon-chai"));

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

  describe("#getFromBungie", () => {
    const sandbox = Sinon.createSandbox();

    let requestGetStub: Sinon.SinonStub;
    before(() => {
      requestGetStub = sandbox.stub(request, "get");
    });

    afterEach(() => {
      sandbox.reset();
    });

    after(() => {
      sandbox.restore();
    });

    it("should call the API with params properly built without components", () => {
      const params: BungieAPIParams = { uri: "my/awesome/service/" };
      const apiKey = "myawesomeapikey";

      getFromBungie(params, apiKey);

      expect(requestGetStub).to.have.been.calledOnceWith({
        uri: "https://www.bungie.net/Platform/my/awesome/service/",
        headers: { "X-API-Key": apiKey },
        json: true
      });
    });

    it("should call the API with params properly built with one component", () => {
      const params: BungieAPIParams = { uri: "my/awesome/service/", components: 42 };
      const apiKey = "myawesomeapikey";

      getFromBungie(params, apiKey);

      expect(requestGetStub).to.have.been.calledOnceWith({
        uri: "https://www.bungie.net/Platform/my/awesome/service/?components=42",
        headers: { "X-API-Key": apiKey },
        json: true
      });
    });

    it("should call the API with params properly built with multiple components", () => {
      const params: BungieAPIParams = { uri: "my/awesome/service/", components: [42, 43] };
      const apiKey = "myawesomeapikey";

      getFromBungie(params, apiKey);

      expect(requestGetStub).to.have.been.calledOnceWith({
        uri: `https://www.bungie.net/Platform/my/awesome/service/?components=42${encodeURIComponent(",")}43`,
        headers: { "X-API-Key": apiKey },
        json: true
      });
    });
  });
});
