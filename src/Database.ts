import { System, DefaultSystem } from "./System";
import { getFromBungie, createHierarchyIfNeeded } from "./Utils";
import {
  DestinyManifest,
  ServerResponse,
  PlatformErrorCodes,
  DestinyActivityDefinition,
  DestinyActivityModeDefinition,
  DestinyPlaceDefinition,
  DestinyClassDefinition,
  DestinyDestinationDefinition
} from "bungie-api-ts/destiny2";
import { get } from "request-promise-native";
const LOCALE = "en";

type DestinyRecord =
  | DestinyActivityDefinition
  | DestinyActivityModeDefinition
  | DestinyPlaceDefinition
  | DestinyClassDefinition
  | DestinyDestinationDefinition;

export class Database {
  public static System: System = DefaultSystem;
  public static instance: Database;

  private databasePath: string;
  private databaseName: string;
  private sqlDatabase: {
    [table: string]: {
      [hash: string]: DestinyRecord;
    };
  };

  private constructor(databasePath: string) {
    this.databasePath = databasePath;
  }

  private openDatabase(): void {
    this.sqlDatabase = JSON.parse(
      Database.System.fs
        .readFileSync(Database.System.path.join(this.databasePath, Database.System.path.parse(this.databaseName).base))
        .toString()
    );
  }

  public getFromDatabase<T extends DestinyRecord>(table: string, hash: number): T {
    if (this.sqlDatabase.hasOwnProperty(table) && this.sqlDatabase[table].hasOwnProperty(hash.toString())) {
      return this.sqlDatabase[table][hash.toString()] as T;
    }
  }

  private async initialize(): Promise<void> {
    try {
      this.databaseName = await this.getDatabaseName();
      if (!this.isCached()) {
        await this.getFromAPI();
      }
    } catch (error) {
      throw error;
    }
    this.openDatabase();
  }

  public static async getInstance(databasePath: string): Promise<Database> {
    Database.instance = new Database(databasePath);
    console.log(databasePath);

    await Database.instance.initialize();
    return Database.instance;
  }

  private isCached(): boolean {
    try {
      Database.System.fs.statSync(this.databasePath);
      return Database.System.fs
        .readdirSync(this.databasePath)
        .some((fileName: string) => fileName === Database.System.path.parse(this.databaseName).base);
    } catch (error) {
      return false;
    }
  }

  private isWritable(): boolean {
    try {
      Database.System.fs.accessSync(this.databasePath, Database.System.fs.constants.W_OK);
    } catch (error) {
      if (error.code !== "ENOENT") {
        return false;
      }
    }
    return true;
  }

  private async getFromAPI(): Promise<void> {
    const databaseName = await this.getDatabaseName();

    const databaseFileName = Database.System.path.parse(databaseName).base;

    const databaseFile = await get(`https://Bungie.net${databaseName}`, { encoding: "utf8" });

    createHierarchyIfNeeded(Database.System, this.databasePath);

    if (this.isWritable()) {
      Database.System.fs.readdirSync(this.databasePath).forEach(file => {
        try {
          Database.System.fs.unlinkSync(Database.System.path.join(this.databasePath, file));
        } catch (error) {
          // Wer're doing our best effort to clean the old files, but that's not critical either.
          /* istanbul ignore next: not important, and don't want to test the sdout/stderr*/
          console.warn(error);
        }
      });
      return this.writeDatabaseFile(databaseFile, databaseFileName);
    }
    throw new Error("Cannot write database file.");
  }

  private async getDatabaseName(): Promise<string> {
    const manifestResponse = await getFromBungie<ServerResponse<DestinyManifest>>({ uri: "Destiny2/Manifest/" });
    if (manifestResponse.ErrorCode !== PlatformErrorCodes.Success) {
      const error = new Error("Error while getting the manifest");
      error.stack = JSON.stringify(manifestResponse);
      throw error;
    }
    const manifest = manifestResponse.Response;
    return manifest.jsonWorldContentPaths[LOCALE];
  }

  private writeDatabaseFile(databaseFile: string, databaseFileName: string): void {
    Database.System.fs.writeFileSync(Database.System.path.join(this.databasePath, databaseFileName), databaseFile);
  }
}
