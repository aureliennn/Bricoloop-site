// Textes de secours, si l'API ne donne pas de message.
const DEFAULT_MESSAGES = {
  400: 'Vérifie les informations saisies, puis réessaie.',
  401: 'Choisis ton profil ou connecte-toi, puis réessaie.',
  403: 'Tu n’as pas le droit de faire cette action.',
  404: 'Cet élément est introuvable. Il a peut-être été supprimé.',
  409: 'Cette action n’est plus possible. Recharge la page pour voir les changements.',
};

// Message à montrer pour une réponse en erreur de l'API.
export function errorMessage(status, body) {
  if (status >= 500) {
    return 'Le serveur a rencontré un problème. Réessaie dans un instant.';
  }
  return body?.error || DEFAULT_MESSAGES[status] || 'Une erreur est survenue. Réessaie.';
}

// Réponse dont le corps n'est pas du JSON : null.
export async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
