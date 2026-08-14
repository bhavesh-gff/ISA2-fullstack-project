// webpack.config.js
// Frontend asset bundling only (college syllabus requirement).
// Each existing public/assets/js/*.js file becomes its own bundle in
// public/dist/, preserving the current 1-script-per-page structure so
// no HTML/JS needs to be rewritten in bulk. Scripts already attach
// their public functions to `window`, so plain (non-module) bundling
// keeps `onclick="markNoShow(...)"` etc. working unchanged.
const path = require("path");
module.exports = {
  entry: {
    main: "./public/assets/js/main.js",
    "admin-login": "./public/assets/js/admin-login.js",
    "admin-dashboard": "./public/assets/js/admin-dashboard.js",
    "manage-services": "./public/assets/js/manage-services.js",
    "no-show-manager": "./public/assets/js/no-show-manager.js",
    reports: "./public/assets/js/reports.js",
    "staff-dashboard": "./public/assets/js/staff-dashboard.js",
  },
  output: {
    path: path.resolve(__dirname, "public/dist"),
    filename: "[name].bundle.js",
    clean: true,
  },
  mode: "development",
  devtool: "source-map",
  target: "web",
};
