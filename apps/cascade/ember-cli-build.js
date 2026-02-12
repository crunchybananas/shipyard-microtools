/* eslint-disable */

"use strict";
const EmberApp = require("ember-cli/lib/broccoli/ember-app");

const { compatBuild } = require("@embroider/compat");

module.exports = async function (defaults) {
  const { buildOnce } = await import("@embroider/vite");

  let app = new EmberApp(defaults, {
    "ember-cli-babel": { enableTypeScriptTransform: true },
    minifyJS: {
      enabled: EmberApp.env() === "production",
      options: {
        keep_fnames: true,
        keep_classnames: true,
      },
    },
  });

  return compatBuild(app, buildOnce, {
    staticInvokables: true,
  });
};
