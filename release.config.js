module.exports = {
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/github",
    "@semantic-release/changelog",
    "@semantic-release/npm",
    [
      "@semantic-release/git",
      {
        message: "chore(release): ${nextRelease.version}\n\n${nextRelease.notes}"
      }
    ]
  ]
};
