/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require("fs");
const http = require("https");
function upload(url) {
  return new Promise((accept, reject) => {
    const file = fs.readFileSync("windows.zip", { encoding: null });

    const options = {
      method: "PUT",
      headers: {
        "Content-Type": "application/zip",
        "Content-Length": file.length,
        Authorization: `Basic ${Buffer.from("louis-bompart:" + process.argv[2]).toString("base64")}`
      }
    };
    const data = [];
    const request = http.request(url, options, response => {
      response.on("data", chunk => data.push(chunk));
      response.on("end", () =>
        accept({
          headers: response.headers,
          statusCode: response.statusCode,
          data: Buffer.concat(data)
        })
      );
    });
    request.on("error", err => reject(err));
    request.write(file);
    request.end();
  });
}
(async function() {
  try {
    const uploadURL = async function getUploadURL() {
      return new Promise(resolve => {
        const req = http.request(
          "https://api.github.com/repos/brakacai/discord-ghost/releases/latest",
          {
            headers: {
              "User-Agent": "Brakacai Build"
            }
          },
          function(res) {
            const chunks = [];

            res.on("data", function(chunk) {
              chunks.push(chunk);
            });

            res.on("end", function() {
              const body = Buffer.concat(chunks);
              resolve(JSON.parse(body.toString())["upload_url"]);
            });
          }
        );

        req.end();
      });
    };
    const url = (await uploadURL()).replace("{?name,label}", "?name=windows.zip");
    const response = await upload(url);
    console.log("done!");
  } catch (error) {
    console.log(error);
  }
})();
