// Données de démo chargées au démarrage (T-03).

export const CATEGORIES = ['Perçage', 'Jardinage', 'Peinture', 'Nettoyage', 'Mesure', 'Autre'];

export const users = [
  { id: 1, firstName: 'Alice', district: 'Centre' },
  { id: 2, firstName: 'Bilal', district: 'Gare' },
  { id: 3, firstName: 'Chloé', district: 'Les Jardins' },
  { id: 4, firstName: 'David', district: 'Centre' },
];

export const tools = [
  { id: 1, ownerId: 1, name: 'Perceuse à percussion', category: 'Perçage', description: 'Livrée avec un jeu de forets béton et bois.', status: 'available' },
  { id: 2, ownerId: 1, name: 'Niveau laser', category: 'Mesure', description: 'Portée de 15 mètres.', status: 'available' },
  { id: 3, ownerId: 2, name: 'Taille-haie électrique', category: 'Jardinage', description: 'Lame de 50 cm, rallonge non fournie.', status: 'unavailable' },
  { id: 4, ownerId: 2, name: 'Tondeuse', category: 'Jardinage', description: 'Tondeuse électrique pour petit jardin.', status: 'available' },
  { id: 5, ownerId: 3, name: 'Pistolet à peinture', category: 'Peinture', description: 'À nettoyer après utilisation.', status: 'available' },
  { id: 6, ownerId: 3, name: 'Nettoyeur haute pression', category: 'Nettoyage', description: 'Idéal pour une terrasse.', status: 'available' },
  { id: 7, ownerId: 4, name: 'Ponceuse', category: 'Autre', description: 'Ponceuse excentrique, abrasifs non fournis.', status: 'available' },
  { id: 8, ownerId: 4, name: 'Visseuse sans fil', category: 'Perçage', description: 'Deux batteries et un chargeur.', status: 'available' },
];

// Date dans n jours, au format AAAA-MM-JJ.
function inDays(n) {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + n)).toISOString().slice(0, 10);
}

// Un prêt à venir déjà accepté, pour voir des dates réservées dans le calendrier (US-04).
// L'outil reste « available » : le prêt n'a pas commencé.
export const loans = [
  { id: 1, toolId: 1, borrowerId: 3, startDate: inDays(3), endDate: inDays(6), status: 'accepted' },
];
