import { createLoanCard, paragraph } from './loan-display.js?v=296a098';

const list = document.querySelector('#borrowings-list');

let latestLoad = 0;

async function loadBorrowings() {
  latestLoad += 1;
  const load = latestLoad;

  // Efface la liste précédente : elle peut venir d'un autre compte.
  list.replaceChildren(paragraph('empty-message', 'Chargement de tes emprunts...'));

  try {
    const response = await fetch('/api/loans/mine');
    const body = await response.json();
    if (load !== latestLoad) return;
    if (!response.ok) throw new Error(body.error);

    list.replaceChildren(...(body.length > 0
      ? body.map((loan) => createLoanCard(loan, `Propriétaire : ${loan.owner.firstName} (${loan.owner.district})`))
      : [paragraph('empty-message', 'Tu n’as fait aucune demande pour le moment.')]));
  } catch (error) {
    if (load !== latestLoad) return;
    list.replaceChildren(paragraph('error-message', error.message || 'Impossible de charger tes emprunts.'));
  }
}

window.addEventListener('bricoloop:page', (event) => {
  if (event.detail === 'emprunts') {
    loadBorrowings();
  } else {
    latestLoad += 1;
    list.replaceChildren();
  }
});
