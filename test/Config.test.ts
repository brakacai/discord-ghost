import { expect, use } from "chai";
import Sinon from "sinon";

import { ConfigFile } from "../src/Config";

import fs from "fs";
import os from "os";
import inquirer from "inquirer";
import * as Utils from "../src/Utils";

import { UserMembership } from "bungie-api-ts/user/interfaces";
import { ServerResponse, PlatformErrorCodes } from "bungie-api-ts/common";

use(require("sinon-chai"));

describe("ConfigFile", () => {
  const sandbox = Sinon.createSandbox();
  let promptStub: Sinon.SinonStub;
  let getFromBungieStub: Sinon.SinonStub;
  let isPlatformCompatibleStub: Sinon.SinonStub;
  let createHierarchyIfNeededStub: Sinon.SinonStub;

  before(() => {
    promptStub = sandbox.stub(inquirer, "prompt");
    getFromBungieStub = sandbox.stub(Utils, "getFromBungie");
    isPlatformCompatibleStub = sandbox.stub(Utils, "isPlatformSupported");
    createHierarchyIfNeededStub = sandbox.stub(Utils, "createHierarchyIfNeeded");

    ConfigFile.System.fs = {
      ...fs,
      readFileSync: sandbox.stub(fs, "readFileSync") as typeof fs.readFileSync,
      writeFileSync: sandbox.stub(fs, "writeFileSync"),
      mkdirSync: sandbox.stub(fs, "mkdirSync"),
      unlinkSync: sandbox.stub(fs, "unlinkSync"),
      statSync: sandbox.stub(fs, "statSync").returns(new fs.Stats()),
      accessSync: sandbox.stub(fs, "accessSync")
    };
    ConfigFile.System.os = {
      ...os,
      homedir: sandbox.stub(os, "homedir")
    };
  });

  afterEach(() => {
    sandbox.reset();
  });

  after(() => {
    sandbox.restore();
  });

  describe("ConfigFile.createNewConfig", () => {
    const API_KEY = "apikey";
    const PLAYER_NAME = "playername";
    const getFromBungieReturnValue: ServerResponse<UserMembership[]> = {
      Response: [{ membershipType: 0, membershipId: "membershipId", displayName: "displayName" }],
      ErrorCode: PlatformErrorCodes.Success,
      ThrottleSeconds: 0,
      ErrorStatus: "Success",
      Message: "Ok",
      MessageData: {}
    };

    beforeEach(() => {
      promptStub.returns({ API_KEY: API_KEY, PLAYER_NAME: PLAYER_NAME });
      getFromBungieStub.returns(getFromBungieReturnValue);
    });

    context("when the data from the API is good and the file already exists", () => {
      it("should update the config file and return the config", async () => {
        const configFile = await ConfigFile.createNewConfig("myPath");
        const expectedData = {
          platform: 0,
          apiKey: API_KEY,
          playerId: "membershipId"
        };

        expect(ConfigFile.System.fs.writeFileSync).to.be.calledWith("myPath", JSON.stringify(expectedData));
        expect(configFile.data).to.be.eql(expectedData);
      });
    });

    context("when the data from the API is good and the file does not exists but can be created", () => {
      beforeEach(() => {
        (ConfigFile.System.fs.accessSync as Sinon.SinonStub).throws({ code: "ENOENT" });
      });

      it("should create a new config file and return the config", async () => {
        const configFile = await ConfigFile.createNewConfig("myPath");
        const expectedData = {
          platform: 0,
          apiKey: API_KEY,
          playerId: "membershipId"
        };

        expect(ConfigFile.System.fs.writeFileSync).to.be.calledWith("myPath", JSON.stringify(expectedData));
        expect(configFile.data).to.be.eql(expectedData);
      });
    });

    context("when the data from the API is good and the file does not exists and cannot be created", () => {
      const cannotCreateError = new Error("CannotCreate");

      beforeEach(() => {
        createHierarchyIfNeededStub.throws(cannotCreateError);
      });

      it("should throw when the dir cannot be created", async () => {
        try {
          await ConfigFile.createNewConfig("myPath");
          expect.fail("resolved", `rejected with ${cannotCreateError}`);
        } catch (error) {
          expect(error).to.be.eql(cannotCreateError);
        }
      });

      it("should throw when the dir exists but cannot create the file", async () => {
        (ConfigFile.System.fs.accessSync as Sinon.SinonStub).throws(cannotCreateError);

        await ConfigFile.createNewConfig("myPath")
          .then(() => {
            expect.fail("resolved", `rejected with ${cannotCreateError}`);
          })
          .catch((error: Error) => {
            expect(error.message).to.be.eql(cannotCreateError.message);
          });
      });
    });

    context("when the data from the API is bad", () => {
      const getFromBungieReturnValue: ServerResponse<UserMembership[]> = {
        Response: [{ membershipType: 0, membershipId: "membershipId", displayName: "displayName" }],
        ErrorCode: PlatformErrorCodes.TagNotFound,
        ThrottleSeconds: 0,
        ErrorStatus: "Ohno",
        Message: "NOK",
        MessageData: {}
      };
      const ApiError = new Error("Error occured while retrieving the player");
      ApiError.stack = JSON.stringify(getFromBungieReturnValue);

      beforeEach(() => {
        getFromBungieStub.returns(getFromBungieReturnValue);
      });

      it("should throw", async () => {
        try {
          await ConfigFile.createNewConfig("myPath");
          expect.fail("resolved", `rejected with ${ApiError}`);
        } catch (error) {
          expect(error.message).to.be.equal(ApiError.message);
          expect(error.stack).to.be.equal(ApiError.stack);
        }
      });
    });
  });

  describe("ConfigFile.getConfigFromPath", () => {
    context("if the config file exists and is valid", () => {
      const testConfig = {
        platform: 447,
        apiKey: "anotherapikey",
        playerId: "membershipId"
      };
      beforeEach(() => {
        isPlatformCompatibleStub.returns(true);
        (ConfigFile.System.fs.readFileSync as Sinon.SinonStub).returns(JSON.stringify(testConfig));
      });

      it("should read it", async () => {
        const configFile = await ConfigFile.getConfigFromPath("myPath");

        expect(configFile.data).to.be.eql(testConfig);
        expect(ConfigFile.System.fs.accessSync).to.be.calledWith("myPath", fs.constants.R_OK);
        expect(ConfigFile.System.fs.readFileSync).to.be.calledWith("myPath");
        expect(isPlatformCompatibleStub).to.be.calledWith(447);
      });
    });

    context("if the config file exists, is a proper JSON, and is not valid", () => {
      const testConfig = {
        platform: 447,
        apiKey: "anotherapikey"
      };
      let createNewConfigStub: Sinon.SinonStub;
      before(() => {
        createNewConfigStub = sandbox.stub(ConfigFile, "createNewConfig");
      });

      beforeEach(() => {
        (ConfigFile.System.fs.readFileSync as Sinon.SinonStub).returns(JSON.stringify(testConfig));
      });

      after(() => {
        createNewConfigStub.restore();
      });

      it("should create a new one", async () => {
        await ConfigFile.getConfigFromPath("myPath");
        expect(createNewConfigStub).to.be.called;
      });
    });

    context("if the config file doesn't exist", () => {
      let createNewConfigStub: Sinon.SinonStub;

      before(() => {
        createNewConfigStub = sandbox.stub(ConfigFile, "createNewConfig");
      });

      beforeEach(() => {
        (ConfigFile.System.fs.accessSync as Sinon.SinonStub).throws(new Error("error"));
      });

      after(() => {
        createNewConfigStub.restore();
      });

      it("should create a new one", async () => {
        await ConfigFile.getConfigFromPath("myPath");
        expect(createNewConfigStub).to.be.called;
      });
    });

    context("if the config file exists is not a proper JSON", () => {
      let createNewConfigStub: Sinon.SinonStub;

      before(() => {
        createNewConfigStub = sandbox.stub(ConfigFile, "createNewConfig");
      });

      beforeEach(() => {
        isPlatformCompatibleStub.returns(true);
        (ConfigFile.System.fs.readFileSync as Sinon.SinonStub).returns("some random string that is not a json at all");
      });

      after(() => {
        createNewConfigStub.restore();
      });

      it("should create a new one", async () => {
        await ConfigFile.getConfigFromPath("myPath");
        expect(createNewConfigStub).to.be.called;
      });
    });
  });
});
