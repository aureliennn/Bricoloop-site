// Image d'un outil : on cherche un mot connu dans son nom, puis dans sa catégorie.
const IMAGES = [
  [/taille-haie/i, 'taille-haie'],
  [/tondeuse|jardinage/i, 'tondeuse'],
  [/visseuse/i, 'visseuse'],
  [/perceuse|perçage/i, 'perceuse'],
  [/niveau|mesure/i, 'niveau'],
  [/peinture/i, 'pistolet-peinture'],
  [/nettoyeur|nettoyage/i, 'nettoyeur'],
  [/ponceuse/i, 'ponceuse'],
];

const find = (text) => IMAGES.find(([pattern]) => pattern.test(text))?.[1];

export function toolImage({ name, category }) {
  return `images/${find(name) ?? find(category) ?? 'outil'}.svg`;
}
