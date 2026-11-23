// Affichage commun aux demandes reçues et à mes emprunts.
const STATUS_LABELS = {
  pending: 'En attente',
  accepted: 'Acceptée',
  refused: 'Refusée',
  returned: 'Rendue',
};

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeZone: 'UTC',
});

const formatDate = (date) => dateFormat.format(new Date(`${date}T00:00:00Z`));

export function paragraph(className, text) {
  const element = document.createElement('p');
  element.className = className;
  element.textContent = text;
  return element;
}

// Carte d'un prêt. actions : élément facultatif, affiché à côté du statut.
export function createLoanCard(loan, person, actions) {
  const card = document.createElement('article');
  card.className = 'request-card';

  const title = document.createElement('h3');
  title.textContent = loan.tool.name;

  const information = document.createElement('div');
  information.append(
    title,
    paragraph('request-detail', person),
    paragraph('request-detail', `Du ${formatDate(loan.startDate)} au ${formatDate(loan.endDate)}`),
  );

  const status = document.createElement('span');
  status.className = `tool-status request-${loan.status}`;
  status.textContent = STATUS_LABELS[loan.status] ?? 'Statut inconnu';

  const side = document.createElement('div');
  side.className = 'request-side';
  side.append(status);
  if (actions) side.append(actions);

  card.append(information, side);
  return card;
}
