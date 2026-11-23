const userSelect = document.querySelector('#owner');
const list = document.querySelector('#requests-list');
const message = document.querySelector('#requests-message');

const STATUS_LABELS = {
  pending: 'En attente',
  accepted: 'Acceptée',
  refused: 'Refusée',
  returned: 'Rendue',
};
const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeZone: 'UTC' });
const formatDate = (date) => dateFormat.format(new Date(`${date}T00:00:00Z`));

let latestLoad = 0;

function paragraph(className, text) {
  const element = document.createElement('p');
  element.className = className;
  element.textContent = text;
  return element;
}

function showMessage(className, text) {
  message.replaceChildren(paragraph(className, text));
}

async function callApi(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'X-User-Id': userSelect.value } });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error);
  }
  return body;
}

function createButton(label, className, loan, action) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.setAttribute('aria-label', `${label} la demande de ${loan.borrower.firstName} pour ${loan.tool.name}`);
  button.addEventListener('click', () => answer(loan, action));
  return button;
}

function createCard(loan) {
  const card = document.createElement('article');
  card.className = 'request-card';

  const title = document.createElement('h3');
  title.textContent = loan.tool.name;

  const information = document.createElement('div');
  information.append(
    title,
    paragraph('request-detail', `${loan.borrower.firstName} (${loan.borrower.district})`),
    paragraph('request-detail', `Du ${formatDate(loan.startDate)} au ${formatDate(loan.endDate)}`),
  );

  const status = document.createElement('span');
  status.className = `tool-status request-${loan.status}`;
  status.textContent = STATUS_LABELS[loan.status] ?? 'Statut inconnu';

  const side = document.createElement('div');
  side.className = 'request-side';
  side.append(status);

  if (loan.status === 'pending') {
    const actions = document.createElement('div');
    actions.className = 'request-actions';
    actions.append(
      createButton('Accepter', 'button-accept', loan, 'accept'),
      createButton('Refuser', 'button-refuse', loan, 'refuse'),
    );
    side.append(actions);
  }

  card.append(information, side);
  return card;
}

async function loadRequests() {
  latestLoad += 1;
  const load = latestLoad;

  if (userSelect.value === '') {
    list.replaceChildren(paragraph('empty-message', 'Choisis ton profil pour voir les demandes reçues.'));
    return;
  }

  try {
    const loans = await callApi('/api/loans/received');
    if (load !== latestLoad) return;
    list.replaceChildren(...(loans.length > 0
      ? loans.map(createCard)
      : [paragraph('empty-message', 'Aucune demande reçue pour le moment.')]));
  } catch {
    if (load !== latestLoad) return;
    list.replaceChildren(paragraph('error-message', 'Impossible de charger les demandes. Vérifie que le serveur est lancé.'));
  }
}

async function answer(loan, action) {
  list.querySelectorAll('button').forEach((button) => {
    button.disabled = true;
  });

  try {
    await callApi(`/api/loans/${loan.id}/${action}`, { method: 'POST' });
    showMessage('success-message', action === 'accept'
      ? `Demande acceptée. L’outil « ${loan.tool.name} » est maintenant prêté.`
      : `Demande refusée pour « ${loan.tool.name} ».`);
  } catch (error) {
    showMessage('error-message', error.message);
  }

  await loadRequests();
}

async function loadUsers() {
  try {
    const response = await fetch('/api/users');
    const users = await response.json();
    users.forEach(({ id, firstName, district }) => {
      userSelect.add(new Option(`${firstName} (${district})`, id));
    });
  } catch {
    showMessage('error-message', 'Impossible de charger les profils. Recharge la page.');
  }
}

function refresh() {
  if (location.hash === '#demandes') {
    message.replaceChildren();
    loadRequests();
  }
}

userSelect.addEventListener('change', refresh);
window.addEventListener('hashchange', refresh);
loadUsers();
refresh();
