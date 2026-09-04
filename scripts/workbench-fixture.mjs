export const jsonExample = JSON.stringify({
  observatory: 'North Atlantic', station: 'CB-07', online: true,
  coordinates: { latitude: 44.65, longitude: -63.57 },
  instruments: [{ name: 'Hydrophone', depth_m: 240, recording: true }, { name: 'Current meter', depth_m: 80, recording: false }],
  latest: { temperature_c: 8.4, salinity_psu: 34.7, note: null }, tags: ['ocean', 'night-watch']
}, null, 2);
export const originalText = '# Night watch\nStation: North Atlantic\n\nSampling interval: 60 seconds\nHydrophone depth: 240 m\nCurrent meter: offline\n\nKeep raw recordings for 7 days.\nSend a daily digest at 08:00.\n\nOn a sensor failure:\n  Retry once.\n  Notify the keeper.\n';
export const modifiedText = '# Night watch\nStation: North Atlantic\n\nSampling interval: 15 seconds\nHydrophone depth: 240 m\nCurrent meter: online\n\nKeep raw recordings for 30 days.\nSend a daily digest at 08:00.\nInclude the overnight temperature range.\n\nOn a sensor failure:\n  Retry three times.\n  Notify the keeper.\n';
