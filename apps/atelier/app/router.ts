import EmberRouter from "@ember/routing/router";
import config from "atelier/config/environment";

export default class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function () {
  this.route('editor', { path: '/editor/:project_id' });
});
