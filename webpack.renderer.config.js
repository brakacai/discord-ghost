module.exports = {
  // Put your normal webpack config below here
  module: {
    rules: require("./webpack.rules")
  },
  externals: {
    sqlite3: "commonjs sqlite3"
  }
};
