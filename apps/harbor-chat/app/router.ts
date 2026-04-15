import EmberRouter from "@ember/routing/router";
import config from "harbor-chat/config/environment";

export default class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function () {
  this.route("invite", { path: "/invite/:invite_id" });
  this.route("workspace", { path: "/workspace/:workspace_id" }, function () {
    this.route("channel", { path: "/channel/:channel_id" });
  });
});
