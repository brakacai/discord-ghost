import { expect, use } from "chai";
import Sinon from "sinon";
use(require("sinon-chai"));

import { Database } from "../src/Database";
import * as Utils from "../src/Utils";
import request from "request-promise-native";
import { ServerResponse, PlatformErrorCodes } from "bungie-api-ts/common";
import { DestinyManifest } from "bungie-api-ts/destiny2";
import * as fs from "fs";
import * as path from "path";
import { SystemError } from "./SystemError";

describe("Database", () => {
  const sandbox = Sinon.createSandbox();
  let requestGetStub: Sinon.SinonStub;
  let getFromBungieStub: Sinon.SinonStub;
  let createHierarchyIfNeededStub: Sinon.SinonStub;

  const fakeDatabaseUri = "/path/dir/file.ext";
  const manifestResponse: ServerResponse<DestinyManifest> = {
    ErrorCode: PlatformErrorCodes.Success,
    ErrorStatus: "OK",
    Message: "OK",
    MessageData: {},
    ThrottleSeconds: 0,
    Response: {
      iconImagePyramidInfo: [],
      mobileWorldContentPaths: {},
      mobileAssetContentPath: "aPath",
      mobileClanBannerDatabasePath: "aPath",
      mobileGearAssetDataBases: [],
      version: "1.0.0",
      mobileGearCDN: {},
      jsonWorldContentPaths: {
        en: fakeDatabaseUri
      }
    }
  };

  before(() => {
    requestGetStub = sandbox.stub(request, "get");
    getFromBungieStub = sandbox.stub(Utils, "getFromBungie");
    createHierarchyIfNeededStub = sandbox.stub(Utils, "createHierarchyIfNeeded");

    Database.System.fs = {
      ...fs,
      statSync: sandbox.stub(fs, "statSync").returns(new fs.Stats()),
      accessSync: sandbox.stub(fs, "accessSync"),
      readdirSync: (sandbox.stub(fs, "readdirSync") as unknown) as typeof fs.readdirSync,
      writeFileSync: sandbox.stub(fs, "writeFileSync"),
      unlinkSync: sandbox.stub(fs, "unlinkSync"),
      readFileSync: (sandbox.stub(fs, "readFileSync") as unknown) as typeof fs.readFileSync
    };
  });

  afterEach(() => {
    sandbox.reset();
  });

  after(() => {
    sandbox.restore();
  });

  describe("getInstance", () => {
    beforeEach(() => {
      getFromBungieStub.returns(manifestResponse);
    });

    it("should get the manifest no matter what", async () => {
      try {
        await Database.getInstance("database/path");
      } catch (e) {
      } finally {
        expect(getFromBungieStub).to.be.calledWith({ uri: "Destiny2/Manifest/" });
      }
    });

    context("when the database is not cached", () => {
      beforeEach(() => {
        requestGetStub.returns("testManifestRawJson");
        (Database.System.fs.statSync as Sinon.SinonStub).throws("EONENT");
        (Database.System.fs.readdirSync as Sinon.SinonStub).returns([]);
        (Database.System.fs.readFileSync as Sinon.SinonStub).returns(Buffer.from(JSON.stringify({ foo: "bar" })));
      });

      it("should download it", async () => {
        await Database.getInstance("database/path");

        expect(getFromBungieStub).to.be.calledWith({ uri: "Destiny2/Manifest/" });
        expect(requestGetStub).to.be.calledWith(
          `https://Bungie.net${fakeDatabaseUri}`,
          Sinon.match.has("encoding", "utf8")
        );
        expect(createHierarchyIfNeededStub).to.calledWith(Sinon.match.any, "database/path");
        expect(Database.System.fs.writeFileSync as Sinon.SinonStub).to.be.calledWith(
          path.join("database/path", "file.ext"),
          "testManifestRawJson"
        );
        expect(Database.System.fs.readFileSync as Sinon.SinonStub).to.be.calledWith(
          path.join("database/path", "file.ext")
        );
      });

      context("if the file is not there", () => {
        beforeEach(() => {
          const error = new SystemError("somemessage");
          error.code = "ENOENT";
          (Database.System.fs.accessSync as Sinon.SinonStub).throws(error);
        });

        it("should not throw", async () => {
          await Database.getInstance("database/path")
            .then(() => {
              expect(true).to.be.ok;
            })
            .catch(() => {
              expect.fail("getInstance has thrown an error");
            });
        });
      });

      context("if the file is not writable", () => {
        beforeEach(() => {
          const error = new SystemError("somemessage");
          error.code = "someCode";
          (Database.System.fs.accessSync as Sinon.SinonStub).throws(error);
        });

        it("should throw", async () => {
          await Database.getInstance("database/path")
            .then(() => {
              expect.fail("has not thrown an error");
            })
            .catch((error: Error) => {
              expect(error.message).to.be.equals(new Error("Cannot write database file.").message);
            });
        });
      });
    });

    context("when the database is cached but deprecated", () => {
      beforeEach(() => {
        requestGetStub.returns("testManifestRawJson");
        Database.System.fs.statSync as Sinon.SinonStub;
        (Database.System.fs.readdirSync as Sinon.SinonStub).returns(["file1", "file2"]);
        (Database.System.fs.readFileSync as Sinon.SinonStub).returns(Buffer.from(JSON.stringify({ foo: "bar" })));
      });

      it("should delete the deprecated version and download the most recent one", async () => {
        await Database.getInstance("database/path");

        expect(getFromBungieStub).to.be.calledWith({ uri: "Destiny2/Manifest/" });
        expect(requestGetStub).to.be.calledWith(
          `https://Bungie.net${fakeDatabaseUri}`,
          Sinon.match.has("encoding", "utf8")
        );
        expect(createHierarchyIfNeededStub).to.calledWith(Sinon.match.any, "database/path");

        expect(Database.System.fs.unlinkSync as Sinon.SinonStub).to.be.calledWith(path.join("database/path", "file1"));
        expect(Database.System.fs.unlinkSync as Sinon.SinonStub).to.be.calledWith(path.join("database/path", "file2"));

        expect(Database.System.fs.writeFileSync as Sinon.SinonStub).to.be.calledWith(
          path.join("database/path", "file.ext"),
          "testManifestRawJson"
        );
      });
    });

    context("when the database is cached and up-to-date", () => {
      beforeEach(() => {
        Database.System.fs.statSync as Sinon.SinonStub;
        (Database.System.fs.readdirSync as Sinon.SinonStub).returns(["file.ext"]);
        (Database.System.fs.readFileSync as Sinon.SinonStub).returns(Buffer.from(JSON.stringify({ foo: "bar" })));
      });

      it("should use the cache", async () => {
        await Database.getInstance("database/path");
        expect(getFromBungieStub).to.be.calledWith({ uri: "Destiny2/Manifest/" });
        expect(requestGetStub).to.not.be.called;
      });
    });

    context("if we can't get the name of the database", () => {
      let manifestError: Error;
      const manifestFailedResponse = { ...manifestResponse, ErrorCode: PlatformErrorCodes.None };

      beforeEach(() => {
        manifestError = new Error("Error while getting the manifest");
        manifestError.stack = JSON.stringify(manifestFailedResponse);
        getFromBungieStub.returns(manifestFailedResponse);
      });

      it("should throw if the download fail", async () => {
        await Database.getInstance("database/path")
          .then(() => {
            expect.fail();
          })
          .catch((error: Error) => {
            expect(error.message).to.be.equals(manifestError.message);
            expect(error.stack).to.be.equals(manifestError.stack);
          });
      });
    });
  });

  describe("getFromDatabase", () => {
    const testResponse = { foo: "bar" };
    beforeEach(() => {
      getFromBungieStub.returns(manifestResponse);
      Database.System.fs.statSync as Sinon.SinonStub;
      (Database.System.fs.readdirSync as Sinon.SinonStub).returns(["file.ext"]);
      (Database.System.fs.readFileSync as Sinon.SinonStub).returns(
        Buffer.from(JSON.stringify({ someTable: { "42": testResponse } }))
      );
    });

    it("call sqlite with the proper argument and it should parse the response accordingly", async () => {
      const databaseInstance = await Database.getInstance("somePath");

      expect(databaseInstance.getFromDatabase("someTable", 42)).to.be.deep.equals(testResponse);
    });
  });
});
