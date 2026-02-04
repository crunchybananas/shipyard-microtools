declare module "rate-limit/config/environment" {
  const config: {
    modulePrefix: string;
    environment: string;
    rootURL: string;
    locationType: string;
    EmberENV: Record<string, unknown>;
    APP: Record<string, unknown>;
  };
  export default config;
}
