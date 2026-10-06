/** Earned Forge Town proof: local metallurgy, imported linen, and prepared coastal defense. */
process.env.WILDHAVEN_CAMPAIGN_STRATEGY = 'forge';
process.env.WILDHAVEN_CAMPAIGN_PREFIX ||= 'campaign-forge';
process.env.WILDHAVEN_CAMPAIGN_DAYS ||= '120';
await import('./campaign.mjs');
