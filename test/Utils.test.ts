import { BungieMembershipType } from "bungie-api-ts/common";
import { expect, use } from "chai";
import request from "request-promise-native";
import Sinon from "sinon";
import { BungieAPIParams, getFromBungie, isPlatformSupported, createHierarchyIfNeeded } from "../src/Utils";
import { System, DefaultSystem } from "../src/System";
import sinon from "sinon";
import { SystemError } from "./SystemError";
import bungieConfig from "../config/bungieApp.json";
use(require("sinon-chai"));

describe("Utils", () => {
  describe("isValidPlatform", () => {
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

  describe("getFromBungie", () => {
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

      getFromBungie(params, "myaccesstoken");

      expect(requestGetStub).to.have.been.calledOnceWith({
        uri: "https://www.bungie.net/Platform/my/awesome/service/",
        headers: { "X-API-Key": bungieConfig.apiKey, Authorization: "Bearer myaccesstoken" },
        json: true
      });
    });

    it("should call the API with params properly built without token", () => {
      const params: BungieAPIParams = { uri: "my/awesome/service/" };

      getFromBungie(params);

      expect(requestGetStub).to.have.been.calledOnceWith({
        uri: "https://www.bungie.net/Platform/my/awesome/service/",
        headers: { "X-API-Key": bungieConfig.apiKey },
        json: true
      });
    });

    it("should call the API with params properly built with one component", () => {
      const params: BungieAPIParams = { uri: "my/awesome/service/", components: 42 };

      getFromBungie(params, "myaccesstoken");

      expect(requestGetStub).to.have.been.calledOnceWith({
        uri: "https://www.bungie.net/Platform/my/awesome/service/?components=42",
        headers: { "X-API-Key": bungieConfig.apiKey, Authorization: "Bearer myaccesstoken" },
        json: true
      });
    });

    it("should call the API with params properly built with multiple components", () => {
      const params: BungieAPIParams = { uri: "my/awesome/service/", components: [42, 43] };

      getFromBungie(params, "myaccesstoken");

      expect(requestGetStub).to.have.been.calledOnceWith({
        uri: `https://www.bungie.net/Platform/my/awesome/service/?components=42${encodeURIComponent(",")}43`,
        headers: { "X-API-Key": bungieConfig.apiKey, Authorization: "Bearer myaccesstoken" },
        json: true
      });
    });

    it("should bubble up the error it get", async () => {
      const params: BungieAPIParams = { uri: "my/awesome/service/", components: [42, 43] };
      const requestError = new Error("get error");
      requestGetStub.throws(requestError);
      expect(await getFromBungie(params, bungieConfig.apiKey)).to.be.equal(requestError);
    });
  });

  describe("createHierarchyIfNeed", () => {
    const sandbox = sinon.createSandbox();

    it("should do nothing nor throw if the hierarchy already exists and is fully accessible", () => {
      const fakeSystem: System = {
        ...DefaultSystem,
        fs: { ...DefaultSystem.fs, accessSync: sandbox.stub(), mkdirSync: sandbox.stub() }
      };

      expect(createHierarchyIfNeeded.bind(createHierarchyIfNeeded, fakeSystem, "test/Path")).to.not.throws();
      expect(fakeSystem.fs.accessSync).to.be.calledWith("test/Path");
      expect(fakeSystem.fs.mkdirSync).to.not.be.called;
    });

    it("should create the hierarchy but not throw if the hierarchy is creatable", () => {
      const fakeSystem: System = {
        ...DefaultSystem,
        fs: {
          ...DefaultSystem.fs,
          accessSync: sandbox.stub().throws({ code: "ENOENT" }),
          mkdirSync: sandbox.stub()
        }
      };

      expect(createHierarchyIfNeeded.bind(createHierarchyIfNeeded, fakeSystem, "test/Path")).to.not.throws();
      expect(fakeSystem.fs.accessSync).to.be.calledWith("test/Path");
      expect(fakeSystem.fs.accessSync).to.throw;
      expect(fakeSystem.fs.mkdirSync).to.be.calledWith("test/Path", { recursive: true });
    });

    it("should throw if the hierarchy is not accessible or creatable", () => {
      const error = new SystemError("somemessage");
      error.code = "someCode";
      const fakeSystem: System = {
        ...DefaultSystem,
        fs: {
          ...DefaultSystem.fs,
          accessSync: sandbox.stub().throws(error),
          mkdirSync: sandbox.stub()
        }
      };

      expect(createHierarchyIfNeeded.bind(createHierarchyIfNeeded, fakeSystem, "test/Path")).to.throws(error);
      expect(fakeSystem.fs.accessSync).to.be.calledWith("test/Path");
      expect(fakeSystem.fs.accessSync).to.throw;
      expect(fakeSystem.fs.mkdirSync).to.not.be.called;
    });
  });
});
