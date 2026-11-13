export const SAVE_VERSION = 1;
export const INGREDIENTS = [
  { id: 'moonflower', name: 'Moonflower', shape: '✿', clue: 'Opens when the sun goes to sleep.', color: '#ddd8ff' },
  { id: 'moss', name: 'River moss', shape: '≋', clue: 'A soft green blanket, never woven.', color: '#aed19d' },
  { id: 'dew', name: 'Morning dew', shape: '◊', clue: 'A little water, borrowed from the dawn.', color: '#b7dce6' },
  { id: 'berry', name: 'Bramble berry', shape: '●', clue: 'Sweet enough for breakfast. Too sweet for this remedy.', color: '#dba8af' },
  { id: 'acorn', name: 'Oak acorn', shape: '◆', clue: 'A whole forest, still asleep in its shell.', color: '#dbbb86' },
];
export const RECIPE = ['moonflower', 'moss', 'dew'];
export function freshSave() { return { version: SAVE_VERSION, collected: [], mixture: [], completed: false, sound: false }; }
export function validateSave(value) {
  if (!value || value.version !== SAVE_VERSION || !Array.isArray(value.collected) || !Array.isArray(value.mixture) || typeof value.completed !== 'boolean' || typeof value.sound !== 'boolean') throw Error('This is not a supported Heartwood Trail save.');
  const ids = INGREDIENTS.map(item => item.id);
  if (value.collected.length > 5 || new Set(value.collected).size !== value.collected.length || value.collected.some(id => !ids.includes(id)) || value.mixture.length > 3 || new Set(value.mixture).size !== value.mixture.length || value.mixture.some(id => !value.collected.includes(id))) throw Error('This save contains invalid ingredients.');
  return { version: SAVE_VERSION, collected: [...value.collected], mixture: [...value.mixture], completed: value.completed, sound: value.sound };
}
export function evaluate(mixture) {
  if (mixture.length !== 3) return { success: false, message: 'Choose three ingredients, in the order on the recipe.' };
  if (mixture.every((id, index) => id === RECIPE[index])) return { success: true, message: 'A little light returns. Your lantern remedy is ready.' };
  if (mixture.some(id => !RECIPE.includes(id))) return { success: false, message: 'A lovely soup, but not a lantern remedy. Look for a flower, a soft green blanket, and a drop of dawn.' };
  return { success: false, message: 'The ingredients are right. Try a different order: night first, then the riverbank, and dawn last.' };
}
