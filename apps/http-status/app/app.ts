import Application from "@ember/application";
import Resolver from "ember-resolver";
import loadInitializers from "ember-load-initializers";
import config from "http-status/config/environment";
import "http-status/http-status/init";

export default class App extends Application {
  modulePrefix = config.modulePrefix;
  Resolver = Resolver;
}

loadInitializers(App, config.modulePrefix);

const app = new App();
app.rootElement = document.body;
app.visit("/");
