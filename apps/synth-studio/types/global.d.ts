// Types for compiled templates
declare module "synth-studio/templates/*" {
  import type { TemplateFactory } from "ember-cli-htmlbars";

  const tmpl: TemplateFactory;
  export default tmpl;
}
