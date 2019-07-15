module.exports = {
  packagerConfig: {
    asar: true
  },
  publisher: [
    {
      name: "@electron-forge/publisher-github",
      config: {
        repository: {
          owner: "brakacai",
          name: "discord-ghost"
        }
      }
    }
  ],
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "discord_ghost"
      }
    },
    {
      name: "@electron-forge/maker-deb",
      config: {
        maintainer: "Louis Bompart",
        homepage: "https://github.com/brakacai/discord-ghost"
      }
    },
    {
      name: "@electron-forge/maker-dmg",
      config: {}
    }
  ],
  plugins: [
    [
      "@electron-forge/plugin-webpack",
      {
        mainConfig: "./webpack.main.config.js",
        renderer: {
          config: "./webpack.renderer.config.js",
          entryPoints: [
            {
              html: "./src/index.html",
              js: "./src/renderer.js",
              name: "main_window"
            }
          ]
        }
      }
    ]
  ]
};
