// Catégories proposées à la création d'un outil (ticket US-02).
export const CREATION_CATEGORIES = ['Perceuse', 'Visseuse', 'Tondeuse'];

export const NAME_MIN = 2;
export const NAME_MAX = 60;
export const DESCRIPTION_MAX = 300;

const text = (value) => (typeof value === 'string' ? value.trim() : '');

// Renvoie l'outil nettoyé et la liste des champs en erreur.
export function validateTool(body) {
  const { name, category, description } = body ?? {};
  const tool = { name: text(name), category, description: text(description) };
  const errors = [];

  if (tool.name.length < NAME_MIN || tool.name.length > NAME_MAX) {
    errors.push({
      field: 'name',
      message: `Nom : obligatoire, entre ${NAME_MIN} et ${NAME_MAX} caractères.`,
    });
  }

  if (!CREATION_CATEGORIES.includes(category)) {
    errors.push({
      field: 'category',
      message: `Catégorie : obligatoire, à choisir parmi ${CREATION_CATEGORIES.join(', ')}.`,
    });
  }

  const descriptionIsText = description === undefined || description === null || typeof description === 'string';
  if (!descriptionIsText || tool.description.length > DESCRIPTION_MAX) {
    errors.push({
      field: 'description',
      message: `Description : facultative, ${DESCRIPTION_MAX} caractères maximum.`,
    });
  }

  return { tool, errors };
}
