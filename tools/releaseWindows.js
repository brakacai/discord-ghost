/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require("fs");
const https = require("https");

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
    const request = https.request(url, options, response => {
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
function delay(t, val) {
  return new Promise(function(resolve) {
    setTimeout(function() {
      resolve(val);
    }, t);
  });
}
async function getUploadURL() {
  return new Promise(resolve => {
    const req = https.request(
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
          resolve(JSON.parse(body.toString()));
        });
      }
    );

    req.end();
  });
}

(async function() {
  try {
    let url;
    let attempt = 0;
    let done = false;
    while (!done) {
      try {
        attempt++;
        const urlRep = await getUploadURL();
        console.log(JSON.stringify(urlRep));
        url = urlRep["upload_url"].replace("{?name,label}", "?name=windows.zip");
        done = true;
      } catch (error) {
        if (attempt > 10) {
          throw error;
        }
        await delay(1e3);
      }
    }
    const response = await upload(url);
    console.log(response);
    console.log("Completed upload!");
  } catch (error) {
    console.log(error);
  }
})();
