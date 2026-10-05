/** Earned Free Port proof with a strict global manual staffing action rate limit. */
process.env.WILDHAVEN_CAMPAIGN_STRATEGY = 'freeport';
process.env.WILDHAVEN_CAMPAIGN_PREFIX ||= 'campaign-freeport-slow';
process.env.WILDHAVEN_CAMPAIGN_DAYS ||= '120';
process.env.WILDHAVEN_CAMPAIGN_SLOW_STAFFING = '1';
await import('./campaign.mjs');
