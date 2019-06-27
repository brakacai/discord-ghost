/* eslint-disable */
import { ConfigFile } from "./Config";

(async function() {
  console.log(JSON.stringify((await ConfigFile.getExistingConfig()).data));
})();
