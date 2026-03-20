import Route from "@ember/routing/route";

export default class EditorRoute extends Route {
  model(params: { project_id: string }) {
    return params.project_id;
  }
}
