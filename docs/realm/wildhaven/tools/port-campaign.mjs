/** Earned Free Port proof: imported linen/metal/tools replace six local industries. */
process.env.WILDHAVEN_CAMPAIGN_STRATEGY = 'freeport';
process.env.WILDHAVEN_CAMPAIGN_PREFIX ||= 'campaign-freeport';
await import('./campaign.mjs');
