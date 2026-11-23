import { openReservation } from './reservation.js?v=296a098';

const app = document.querySelector('#app');
const authPage = document.querySelector('#auth-page');
const proposerPage = document.querySelector('#proposer-page');
const requestsPage = document.querySelector('#requests-page');
const borrowingsPage = document.querySelector('#borrowings-page');

const PAGES = {
  catalogue: app,
  proposer: proposerPage,
  demandes: requestsPage,
  emprunts: borrowingsPage,
};

const STATUS_LABELS = {
  available: 'Disponible',
  lent: 'Prêté',
  unavailable: 'Indisponible',
};

const DETAIL_HOVER_DELAY = 2000;

function renderToolDetails(panel, tool) {
  const ownerName = [tool.owner?.firstName, tool.owner?.lastName].filter(Boolean).join(' ');
  const values = [
    ['Catégorie', tool.category],
    ['Description', tool.description],
    ['Statut', STATUS_LABELS[tool.status] ?? 'Statut inconnu'],
    ['Propriétaire', ownerName],
    ['Quartier', tool.owner?.district],
  ];
  const list = document.createElement('dl');
  for (const [label, value] of values) {
    const term = document.createElement('dt');
    term.textContent = label;
    const description = document.createElement('dd');
    description.textContent = value || 'Non renseigné';
    list.append(term, description);
  }
  panel.replaceChildren(list);
}

function attachToolDetails(card, button, toolId) {
  const panel = document.createElement('div');
  panel.id = `tool-details-${toolId}`;
  panel.className = 'tool-details';
  panel.hidden = true;
  button.setAttribute('aria-controls', panel.id);
  button.setAttribute('aria-expanded', 'false');
  card.append(panel);

  let hoverTimer;
  let request;
  let openedByButton = false;

  function closeDetails() {
    clearTimeout(hoverTimer);
    request?.abort();
    openedByButton = false;
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  }

  async function openDetails() {
    clearTimeout(hoverTimer);
    if (!panel.hidden || !card.isConnected || app.hidden) return;
    request = new AbortController();
    const { signal } = request;
    panel.textContent = 'Chargement du détail…';
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');

    try {
      const response = await fetch(`/api/tools/${toolId}`, { signal });
      const data = await response.json();
      if (signal.aborted || !card.isConnected) return;
      if (response.ok) {
        renderToolDetails(panel, data);
      } else {
        panel.textContent = data.error ?? 'Impossible de charger le détail de cet outil.';
      }
    } catch {
      if (!signal.aborted) panel.textContent = 'Impossible de charger le détail de cet outil.';
    }
  }

  card.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'mouse') hoverTimer = setTimeout(openDetails, DETAIL_HOVER_DELAY);
  });
  card.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse' && !openedByButton) closeDetails();
  });
  button.addEventListener('click', () => {
    if (panel.hidden) {
      openedByButton = true;
      openDetails();
    } else {
      closeDetails();
    }
  });
  button.addEventListener('blur', () => {
    if (openedByButton) closeDetails();
  });
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDetails();
  });
}

function createToolCard(tool) {
  const article = document.createElement('article');
  article.className = 'tool-card';

  const information = document.createElement('div');
  information.className = 'tool-information';

  const name = document.createElement('h3');
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'tool-open';
  open.textContent = tool.name;
  open.addEventListener('click', () => {
    openReservation(tool, STATUS_LABELS[tool.status] ?? 'Statut inconnu');
  });
  name.append(open);

  const category = document.createElement('p');
  category.className = 'tool-category';
  category.textContent = tool.category;

  const detailButton = document.createElement('button');
  detailButton.type = 'button';
  detailButton.className = 'tool-detail-toggle';
  detailButton.textContent = 'Détails';
  detailButton.setAttribute('aria-label', `Détails : ${tool.name}`);
  information.append(name, category, detailButton);

  const status = document.createElement('span');
  status.className = `tool-status status-${tool.status}`;
  status.textContent = STATUS_LABELS[tool.status] ?? 'Statut inconnu';

  article.append(information, status);
  attachToolDetails(article, detailButton, tool.id);

  return article;
}

function renderTools(tools) {
  app.replaceChildren();

  const section = document.createElement('section');
  section.className = 'catalogue';

  const heading = document.createElement('div');
  heading.className = 'catalogue-heading';

  const title = document.createElement('h2');
  title.textContent = 'Catalogue des outils';

  const count = document.createElement('span');
  count.className = 'tool-count';
  count.textContent = `${tools.length} outil${tools.length > 1 ? 's' : ''}`;

  heading.append(title, count);
  section.append(heading);

  if (tools.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-message';
    empty.textContent = 'Aucun outil pour le moment';
    section.append(empty);
  } else {
    const list = document.createElement('div');
    list.className = 'tool-list';
    tools.forEach((tool) => list.append(createToolCard(tool)));
    section.append(list);
  }

  app.append(section);
}

async function loadTools() {
  app.textContent = 'Chargement du catalogue...';

  try {
    const response = await fetch('/api/tools');
    if (!response.ok) throw new Error('Impossible de récupérer les outils.');
    renderTools(await response.json());
  } catch (error) {
    app.replaceChildren();
    const message = document.createElement('p');
    message.className = 'error-message';
    message.textContent = error.message;
    app.append(message);
  }
}

function showPage() {
  const requestedPage = location.hash.slice(1) || 'connexion';
  const page = ['catalogue', 'proposer', 'demandes', 'emprunts', 'connexion', 'inscription'].includes(requestedPage)
    ? requestedPage
    : 'catalogue';

  if (!window.bricoloopAuthReady) {
    Object.values(PAGES).forEach((element) => {
      element.hidden = true;
    });
    app.hidden = true;
    proposerPage.hidden = true;
    requestsPage.hidden = true;
    authPage.hidden = false;
    return;
  }

  const isAuthPage = page === 'connexion' || page === 'inscription';

  if (!window.bricoloopAuthenticated && !isAuthPage) {
    location.hash = '#connexion';
    return;
  }

  authPage.hidden = !isAuthPage;

  Object.entries(PAGES).forEach(([name, element]) => {
    element.hidden = name !== page;
  });

  document.querySelectorAll('.tabs a').forEach((link) => {
    if (link.hash === `#${page}`) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  if (page === 'catalogue') loadTools();

  window.dispatchEvent(new CustomEvent('bricoloop:page', { detail: page }));
}

window.addEventListener('hashchange', showPage);
window.addEventListener('bricoloop:auth', showPage);
showPage();
