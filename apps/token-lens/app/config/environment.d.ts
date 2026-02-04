/**
 * Type declarations for
 *    import config from 'token-lens/config/environment'
 */
declare const config: {
  environment: string;
  modulePrefix: string;
  locationType: "history" | "hash" | "none" | "auto";
  rootURL: string;
  APP: Record<string, unknown>;
};

export default config;
