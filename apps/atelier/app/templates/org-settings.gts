import AtelierOrgSettings from "atelier/components/atelier/org-settings";
import type { TOC } from "@ember/component/template-only";

const OrgSettingsRoute: TOC<{ Args: { model: string } }> = <template>
  <AtelierOrgSettings @orgId={{@model}} />
</template>;

export default OrgSettingsRoute;
