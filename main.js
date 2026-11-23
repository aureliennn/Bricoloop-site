import { openReservation } from './reservation.js?v=d8a5b87';

const app = document.querySelector('#app');

const STATUS_LABELS = {
  available: 'Disponible',
  lent: 'Prêté',
  unavailable: 'Indisponible',
};

function createToolCard(tool) {
  const article = document.createElement('article');
  article.className = 'tool-card';

  const information = document.createElement('div');
  information.className = 'tool-information';

  const name = document.createElement('h3');

  // Le bouton couvre toute la carte : un clic dessus ouvre la réservation.
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'tool-open';
  open.textContent = tool.name;
  open.addEventListener('click', () => openReservation(tool, STATUS_LABELS[tool.status] ?? 'Statut inconnu'));
  name.append(open);

  const category = document.createElement('p');
  category.className = 'tool-category';
  category.textContent = tool.category;

  information.append(name, category);

  const status = document.createElement('span');
  status.className = `tool-status status-${tool.status}`;
  status.textContent = STATUS_LABELS[tool.status] ?? 'Statut inconnu';

  article.append(information, status);

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

    if (!response.ok) {
      throw new Error('Impossible de récupérer les outils.');
    }

    renderTools(await response.json());
  } catch (error) {
    app.replaceChildren();

    const message = document.createElement('p');
    message.className = 'error-message';
    message.textContent = error.message;

    app.append(message);
  }
}

// L'adresse (#catalogue, #proposer ou #demandes) choisit l'onglet affiché.
const PAGES = {
  catalogue: app,
  proposer: document.querySelector('#proposer-page'),
  demandes: document.querySelector('#requests-page'),
};

function showPage() {
  const hash = location.hash.slice(1);
  const page = Object.hasOwn(PAGES, hash) ? hash : 'catalogue';

  Object.entries(PAGES).forEach(([name, element]) => {
    element.hidden = name !== page;
  });

  document.querySelectorAll('.tabs a').forEach((link) => {
    if (link.hash === `#${page}`) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });

  if (page === 'catalogue') {
    loadTools();
  }
}

window.addEventListener('hashchange', showPage);
showPage();
