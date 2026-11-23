import { createLoanCard, paragraph } from './loan-display.js?v=bd111fe';

const list = document.querySelector('#requests-list');
const message = document.querySelector('#requests-message');

let latestLoad = 0;

function showMessage(className, text) {
  message.replaceChildren(paragraph(className, text));
}

async function callApi(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: 'same-origin',
    headers: {
      ...(options.headers ?? {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });

  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? 'Une erreur est survenue.');
  return body;
}

function createButton(label, className, loan, action) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.setAttribute(
    'aria-label',
    `${label} la demande de ${loan.borrower.firstName} pour ${loan.tool.name}`,
  );
  button.addEventListener('click', () => answer(loan, action));
  return button;
}

function createCard(loan) {
  let actions;
  if (loan.status === 'pending') {
    actions = document.createElement('div');
    actions.className = 'request-actions';
    actions.append(
      createButton('Accepter', 'button-accept', loan, 'accept'),
      createButton('Refuser', 'button-refuse', loan, 'refuse'),
    );
  }

  return createLoanCard(loan, `${loan.borrower.firstName} (${loan.borrower.district})`, actions);
}

async function loadRequests() {
  latestLoad += 1;
  const load = latestLoad;

  try {
    const loans = await callApi('/api/loans/received');
    if (load !== latestLoad) return;

    list.replaceChildren(...(loans.length > 0
      ? loans.map(createCard)
      : [paragraph('empty-message', 'Aucune demande reçue pour le moment.')]));
  } catch (error) {
    if (load !== latestLoad) return;
    list.replaceChildren(paragraph('error-message', error.message));
  }
}

async function answer(loan, action) {
  list.querySelectorAll('button').forEach((button) => {
    button.disabled = true;
  });

  try {
    await callApi(`/api/loans/${loan.id}/${action}`, { method: 'POST' });
    showMessage(
      'success-message',
      action === 'accept'
        ? `Demande acceptée. L'outil « ${loan.tool.name} » est maintenant prêté.`
        : `Demande refusée pour « ${loan.tool.name} ».`,
    );
  } catch (error) {
    showMessage('error-message', error.message);
  }

  await loadRequests();
}

function refresh(event) {
  if (location.hash === '#demandes' && (!event || event.detail === 'demandes')) {
    message.replaceChildren();
    loadRequests();
  }
}

window.addEventListener('hashchange', refresh);
window.addEventListener('bricoloop:page', refresh);
