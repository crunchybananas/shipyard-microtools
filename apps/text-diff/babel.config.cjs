const config = {
  presets: [],
  plugins: [
    [
      "babel-plugin-ember-template-compilation",
      {
        compilerPath: "ember-source/dist/ember-template-compiler",
        enableLegacyModules: ["ember-cli-htmlbars"],
      },
    ],
    [
      "@babel/plugin-transform-typescript",
      { allExtensions: true, onlyRemoveTypeImports: true, allowDeclareFields: true },
    ],
    ["@babel/plugin-proposal-decorators", { version: "2023-11" }],
    "@babel/plugin-transform-runtime",
    "decorator-transforms",
  ],
};

module.exports = config;
