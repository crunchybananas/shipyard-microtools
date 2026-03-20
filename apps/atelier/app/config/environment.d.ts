declare const config: {
  modulePrefix: string;
  environment: string;
  rootURL: string;
  locationType: "hash" | "history" | "none" | "auto";
  EmberENV: {
    EXTEND_PROTOTYPES: boolean;
    FEATURES: Record<string, boolean>;
  };
  APP: Record<string, unknown>;
};

export default config;
