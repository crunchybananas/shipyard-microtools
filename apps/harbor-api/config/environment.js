"use strict";

module.exports = function (environment) {
  const ENV = {
    modulePrefix: "harbor-api",
    environment,
    rootURL: "./",
    locationType: "hash",
    EmberENV: {
      EXTEND_PROTOTYPES: false,
      FEATURES: {},
    },
    APP: {},
  };

  if (environment === "test") {
    ENV.locationType = "none";
    ENV.APP.rootURL = "/";
    ENV.APP.autoboot = false;
  }

  return ENV;
};
