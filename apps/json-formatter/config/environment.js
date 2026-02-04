"use strict";

module.exports = function (environment) {
  const ENV = {
    modulePrefix: "json-formatter",
    environment,
    rootURL: "./",
    locationType: "hash",
    EmberENV: {
      EXTEND_PROTOTYPES: false,
      FEATURES: {},
    },
    APP: {},
  };

  if (environment === "development") {
    // Development-specific settings
  }

  if (environment === "test") {
    ENV.locationType = "none";
    ENV.APP.LOG_ACTIVE_GENERATION = false;
    ENV.APP.LOG_VIEW_LOOKUPS = false;
    ENV.APP.rootElement = "#ember-testing";
    ENV.APP.autoboot = false;
  }

  if (environment === "production") {
    ENV.rootURL = "./";
    ENV.locationType = "hash";
  }

  return ENV;
};
