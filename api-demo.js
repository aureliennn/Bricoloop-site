// Version en ligne seulement : GitHub Pages n'a pas de serveur.
// Ce fichier répond à la place de l'API, avec les données et la validation du projet.
// Les outils ajoutés restent dans la page et disparaissent au rechargement.
import * as seed from './src/seed.js';
import { CREATION_CATEGORIES, validateTool } from './src/validation/tool.js';

const tools = structuredClone(seed.tools);
const STATUS_ORDER = { available: 0, loaned: 1, unavailable: 2 };

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

function listTools() {
  const sorted = [...tools].sort((a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3));
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
    id: Math.max(0, ...tools.map(({ id }) => id)) + 1,
    ownerId: user.id,
    ...tool,
    status: 'available',
  };
  tools.push(created);
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
