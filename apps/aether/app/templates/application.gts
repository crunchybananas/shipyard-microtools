import type { TOC } from "@ember/component/template-only";

const Application: TOC<{ Blocks: { default: [] } }> = <template>
  {{outlet}}
</template>;

export default Application;
