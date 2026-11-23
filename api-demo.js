// Version en ligne seulement : GitHub Pages n'a pas de serveur.
// Ce fichier répond à la place de l'API, avec les données et la validation du projet.
// Les outils ajoutés sont gardés dans le navigateur de chaque visiteur.
import * as seed from './src/seed.js?v=7aee656b';
import { CREATION_CATEGORIES, validateTool } from './src/validation/tool.js?v=7aee656b';

const STORAGE_KEY = 'bricoloop-outils-ajoutes';
const STATUS_ORDER = { available: 0, loaned: 1, unavailable: 2 };

// Utilisé si le navigateur refuse le stockage (navigation privée, par exemple).
let memory = [];

function addedTools() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : memory;
  } catch {
    return memory;
  }
}

function saveAddedTools(tools) {
  memory = tools;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tools));
  } catch {
    // Les outils restent en mémoire jusqu'au rechargement.
  }
}

const allTools = () => [...seed.tools, ...addedTools()];

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

function listTools() {
  const sorted = allTools().sort((a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3));
  return json(200, sorted.map(({ id, name, category, status }) => ({ id, name, category, status })));
}

function createTool(options) {
  const userId = Number(new Headers(options.headers).get('X-User-Id'));
  const user = seed.users.find(({ id }) => id === userId);
  if (!user) {
    return json(401, { error: 'Choisis ton profil avant de proposer un outil.' });
  }

  const { tool, errors } = validateTool(JSON.parse(options.body));
  if (errors.length > 0) {
    return json(400, { error: errors.map(({ message }) => message).join(' '), errors });
  }

  const created = {
    id: Math.max(0, ...allTools().map(({ id }) => id)) + 1,
    ownerId: user.id,
    ...tool,
    status: 'available',
  };
  saveAddedTools([...addedTools(), created]);
  return json(201, created);
}

const routes = {
  'GET /api/tools': listTools,
  'POST /api/tools': createTool,
  'GET /api/tools/categories': () => json(200, CREATION_CATEGORIES),
  'GET /api/users': () => json(200, seed.users),
};

const realFetch = window.fetch.bind(window);

window.fetch = async (url, options = {}) => {
  if (typeof url !== 'string' || !url.startsWith('/api/')) {
    return realFetch(url, options);
  }
  const route = routes[`${options.method ?? 'GET'} ${url}`];
  return route ? route(options) : json(404, { error: 'Route inconnue' });
};
