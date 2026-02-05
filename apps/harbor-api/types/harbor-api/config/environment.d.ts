declare module "harbor-api/config/environment" {
  export interface EnvironmentConfig {
    environment: string;
    modulePrefix: string;
    locationType: "history" | "hash" | "none" | "auto";
    rootURL: string;
    APP: Record<string, unknown>;
  }

  const config: EnvironmentConfig;
  export default config;
}
