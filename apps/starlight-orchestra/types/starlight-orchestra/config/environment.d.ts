declare module "starlight-orchestra/config/environment" {
  export interface EnvironmentConfig {
    modulePrefix: string;
    environment: string;
    rootURL: string;
    locationType: string;
    EmberENV: {
      EXTEND_PROTOTYPES: boolean;
      FEATURES: Record<string, boolean>;
    };
    APP: Record<string, unknown>;
  }

  const config: EnvironmentConfig;
  export default config;
}
