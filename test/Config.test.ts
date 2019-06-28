import { expect, use } from "chai";
import Sinon, { SinonStub } from "sinon";

import { ConfigFile } from "../src/Config";

import fs, { readFileSync } from "fs";
import os from "os";
import inquirer from "inquirer";
import * as Utils from "../src/Utils";

import { UserMembership } from "bungie-api-ts/user/interfaces";
import { ServerResponse, PlatformErrorCodes } from "bungie-api-ts/common";
import { Stats } from "fs";

use(require("sinon-chai"));
use(require("chai-as-promised"));

describe("ConfigFile", () => {
  const sandbox = Sinon.createSandbox();
  let promptStub: Sinon.SinonStub;
  let getFromBungieStub: Sinon.SinonStub;
  let isPlatformCompatibleStub: Sinon.SinonStub;

  before(() => {
    promptStub = sandbox.stub(inquirer, "prompt");
    getFromBungieStub = sandbox.stub(Utils, "getFromBungie");
    isPlatformCompatibleStub = sandbox.stub(Utils, "isPlatformSupported");

    ConfigFile.System.fs = {
      ...fs,
      readFileSync: sandbox.stub(fs, "readFileSync") as typeof readFileSync,
      writeFileSync: sandbox.stub(fs, "writeFileSync"),
      mkdirSync: sandbox.stub(fs, "mkdirSync"),
      unlinkSync: sandbox.stub(fs, "unlinkSync"),
      statSync: sandbox.stub(fs, "statSync").returns(new Stats()),
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
    context("when the data from the API is good and the file already exists", () => {
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

      before(() => {
        promptStub.returns({ API_KEY: API_KEY, PLAYER_NAME: PLAYER_NAME });
        getFromBungieStub.returns(getFromBungieReturnValue);
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

    context("when the data from the API is good and the file already does not exists but can be created", () => {
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

      before(() => {
        promptStub.returns({ API_KEY: API_KEY, PLAYER_NAME: PLAYER_NAME });
        getFromBungieStub.returns(getFromBungieReturnValue);
        (ConfigFile.System.fs.accessSync as SinonStub).throws({ code: "ENOENT" });
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

    context("when the data from the API is good and the file already does not exists and cannot be created", () => {
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
      const cannotCreateError = new Error("CannotCreate");

      before(() => {
        promptStub.returns({ API_KEY: API_KEY, PLAYER_NAME: PLAYER_NAME });
        getFromBungieStub.returns(getFromBungieReturnValue);
        (ConfigFile.System.fs.accessSync as SinonStub).throws(cannotCreateError);
      });

      it("should create a new config file and return the config", async () => {
        expect(ConfigFile.createNewConfig("myPath")).to.eventually.throw(cannotCreateError);
      });
    });

    context("when the data from the API is bad", () => {
      const API_KEY = "apikey";
      const PLAYER_NAME = "playername";
      const getFromBungieReturnValue: ServerResponse<UserMembership[]> = {
        Response: [{ membershipType: 0, membershipId: "membershipId", displayName: "displayName" }],
        ErrorCode: PlatformErrorCodes.TagNotFound,
        ThrottleSeconds: 0,
        ErrorStatus: "Ohno",
        Message: "NOK",
        MessageData: {}
      };
      const ApiError = new Error(`Error while getting the player.
      ${JSON.stringify(getFromBungieReturnValue)}`);

      before(() => {
        promptStub.returns({ API_KEY: API_KEY, PLAYER_NAME: PLAYER_NAME });
        getFromBungieStub.returns(getFromBungieReturnValue);
      });

      it("should create a new config file and return the config", async () => {
        expect(ConfigFile.createNewConfig("myPath")).to.eventually.throw(ApiError);
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
      before(() => {
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
