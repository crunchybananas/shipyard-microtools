// Names are chosen only for new arrivals. Saved residents keep their identities.
export const GIVEN_NAMES = Object.freeze([
  'Ada', 'Amina', 'Arun', 'Beatriz', 'Chen', 'Dalia', 'Emeka', 'Farah',
  'Gabriel', 'Hana', 'Idris', 'Jun', 'Kavya', 'Leila', 'Mateo', 'Nia',
  'Omar', 'Priya', 'Quinn', 'Rafael', 'Sana', 'Tariq', 'Uma', 'Vera',
  'Wren', 'Ximena', 'Yara', 'Zuri', 'Akira', 'Bram', 'Cora', 'Dev',
  'Elin', 'Femi', 'Greta', 'Hollis', 'Inez', 'Jory', 'Kit', 'Lina',
  'Milo', 'Nell', 'Orin', 'Pia', 'Remy', 'Sage', 'Tess', 'Una',
  'Vale', 'Yusuf', 'Zoya', 'Anika', 'Bao', 'Camila', 'Dara', 'Elias',
  'Fatima', 'Gita', 'Hugo', 'Imani', 'Jaya', 'Kofi', 'Lucia', 'Minh',
  'Nadia', 'Oisín', 'Paloma', 'Ravi', 'Sora', 'Thandi', 'Uri', 'Viola',
  'Willa', 'Xavier', 'Yuki', 'Zain', 'Alma', 'Bilal', 'Celia', 'Diego',
  'Esme', 'Felix', 'Gael', 'Hadi', 'Isabel', 'Jamal', 'Keiko', 'Luca',
  'Maya', 'Nikhil', 'Olive', 'Pavel', 'Rosa', 'Selam', 'Tomas', 'Uzoma',
  'Vikram', 'Wen', 'Yasmin', 'Zara', 'Amara', 'Binta', 'Cian', 'Dina',
  'Eren', 'Freya', 'Gus', 'Hyejin', 'Ilona', 'Joaquim', 'Kiran', 'Laleh',
  'Mariam', 'Nico', 'Oona', 'Petra', 'Rohan', 'Soraya', 'Tenzin', 'Ulla',
  'Valeria', 'Willow', 'Xinyi', 'Yves', 'Zelda', 'Ayo', 'Bruno', 'Chandra',
  'Davi', 'Esther', 'Farid', 'Gemma', 'Haruto', 'Ibrahim', 'Jia', 'Kwame',
  'Linh', 'Malik', 'Noor', 'Oksana', 'Pema', 'Rina', 'Samir', 'Talia',
  'Umar', 'Vanya', 'Wes', 'Yelena', 'Zola', 'Adil', 'Belen', 'Céline',
  'Darius', 'Eleni', 'Finn', 'Gowri', 'Hector', 'Inaya', 'Jules', 'Kenza',
  'Liora', 'Marisol', 'Nabil', 'Osamu', 'Pilar', 'Rowan', 'Seydou', 'Tove',
  'Uche', 'Vivian', 'Wafa', 'Yosef', 'Zora', 'Aisha', 'Bodhi', 'Chiara',
  'Dmitri', 'Eniola', 'Fleur', 'Goran', 'Halima', 'Isha', 'Jin', 'Khalil',
  'Luisa', 'Mira', 'Noura', 'Otto', 'Pari', 'Ronan', 'Sita', 'Thiago',
]);

export const FAMILY_NAMES = Object.freeze([
  'Alden', 'Amani', 'Aranda', 'Aydin', 'Baptiste', 'Bauer', 'Bekele', 'Bello',
  'Berg', 'Carvalho', 'Chen', 'Costa', 'Das', 'Diallo', 'Duarte', 'Farah',
  'Flores', 'García', 'Haddad', 'Han', 'Hasan', 'Ibrahim', 'Ito', 'Jensen',
  'Kamau', 'Kapoor', 'Kaya', 'Khan', 'Kim', 'Kovač', 'Larsen', 'Laurent',
  'Lee', 'Lopes', 'Martin', 'Mensah', 'Mori', 'Nair', 'Nakamura', 'Nguyen',
  'Novak', 'Okafor', 'Oliveira', 'Park', 'Patel', 'Pereira', 'Rahman', 'Reyes',
  'Rivera', 'Rossi', 'Sato', 'Shah', 'Silva', 'Singh', 'Sørensen', 'Tan',
  'Tran', 'Vega', 'Walker', 'Wang', 'Williams', 'Yılmaz', 'Young', 'Zhang',
]);

const nameKey = name => name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();

/** Deterministic names, including enough full names for every supported town. */
export function newCitizenName(id, existingNames = []) {
  const used = new Set(Array.from(existingNames, nameKey));
  const count = GIVEN_NAMES.length * (FAMILY_NAMES.length + 1);
  for (let offset = 0; offset < count; offset++) {
    const index = (id - 1 + offset) % count;
    const given = GIVEN_NAMES[index % GIVEN_NAMES.length];
    const family = Math.floor(index / GIVEN_NAMES.length) - 1;
    const name = family < 0 ? given : `${given} ${FAMILY_NAMES[family]}`;
    if (!used.has(nameKey(name))) return name;
  }
  // A valid save allows at most 1,000 residents; this pool holds over 12,000.
  throw new RangeError('No unused citizen names remain.');
}
