// Version en ligne seulement : GitHub Pages n'a pas de serveur.
// Ce fichier répond à la place de l'API, avec les données et la validation du projet.
// Les outils et les demandes ajoutés sont gardés dans le navigateur de chaque visiteur.
import * as seed from './src/seed.js?v=ebfb8a1';
import { overlaps, reservedPeriods, validateLoanDates } from './src/validation/loan.js?v=ebfb8a1';
import { CREATION_CATEGORIES, validateTool } from './src/validation/tool.js?v=ebfb8a1';

const STATUS_ORDER = { available: 0, loaned: 1, unavailable: 2 };

// Liste gardée dans le navigateur, ou en mémoire s'il refuse le stockage (navigation privée).
function savedList(key) {
  let memory = [];
  return {
    all() {
      try {
        const saved = JSON.parse(localStorage.getItem(key));
        return Array.isArray(saved) ? saved : memory;
      } catch {
        return memory;
      }
    },
    add(item) {
      memory = [...this.all(), item];
      try {
        localStorage.setItem(key, JSON.stringify(memory));
      } catch {
        // La liste reste en mémoire jusqu'au rechargement.
      }
    },
  };
}

const addedTools = savedList('bricoloop-outils-ajoutes');
const addedLoans = savedList('bricoloop-demandes');
const allTools = () => [...seed.tools, ...addedTools.all()];
const allLoans = () => [...seed.loans, ...addedLoans.all()];
const nextId = (items) => Math.max(0, ...items.map(({ id }) => id)) + 1;
const findTool = (toolId) => allTools().find(({ id }) => id === toolId);

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const invalid = (errors) => json(400, { error: errors.map(({ message }) => message).join(' '), errors });

function currentUser(options) {
  const userId = Number(new Headers(options.headers).get('X-User-Id'));
  return seed.users.find(({ id }) => id === userId);
}

function listTools() {
  const sorted = allTools().sort((a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3));
  return json(200, sorted.map(({ id, name, category, status }) => ({ id, name, category, status })));
}

function createTool(options) {
  const user = currentUser(options);
  if (!user) return json(401, { error: 'Choisis ton profil avant de proposer un outil.' });

  const { tool, errors } = validateTool(JSON.parse(options.body));
  if (errors.length > 0) return invalid(errors);

  const created = { id: nextId(allTools()), ownerId: user.id, ...tool, status: 'available' };
  addedTools.add(created);
  return json(201, created);
}

function listReservations(options, id) {
  const tool = findTool(Number(id));
  if (!tool) return json(404, { error: 'Cet outil n\'existe pas.' });
  return json(200, reservedPeriods(allLoans(), tool.id));
}

function createLoan(options) {
  const user = currentUser(options);
  if (!user) return json(401, { error: 'Choisis ton profil avant de demander un outil.' });

  const body = JSON.parse(options.body);
  const { toolId, startDate, endDate } = body;
  const tool = findTool(toolId);
  if (!tool) return json(404, { error: 'Cet outil n\'existe pas.' });

  const errors = validateLoanDates(body);
  if (errors.length > 0) return invalid(errors);
  if (tool.ownerId === user.id) return json(400, { error: 'Tu ne peux pas demander ton propre outil.' });
  if (tool.status === 'unavailable') return json(409, { error: 'Cet outil est indisponible.' });
  if (reservedPeriods(allLoans(), tool.id).some((period) => overlaps(period, { startDate, endDate }))) {
    return json(409, { error: 'L\'outil est déjà réservé sur une partie de ces dates.' });
  }

  const loan = { id: nextId(allLoans()), toolId, borrowerId: user.id, startDate, endDate, status: 'pending' };
  addedLoans.add(loan);
  return json(201, loan);
}

const routes = [
  [/^GET \/api\/tools$/, listTools],
  [/^POST \/api\/tools$/, createTool],
  [/^GET \/api\/tools\/categories$/, () => json(200, CREATION_CATEGORIES)],
  [/^GET \/api\/tools\/(\d+)\/reservations$/, listReservations],
  [/^POST \/api\/loans$/, createLoan],
  [/^GET \/api\/users$/, () => json(200, seed.users)],
];

const realFetch = window.fetch.bind(window);

window.fetch = async (url, options = {}) => {
  if (typeof url !== 'string' || !url.startsWith('/api/')) {
    return realFetch(url, options);
  }
  const call = `${options.method ?? 'GET'} ${url}`;
  for (const [pattern, handler] of routes) {
    const match = call.match(pattern);
    if (match) return handler(options, ...match.slice(1));
  }
  return json(404, { error: 'Route inconnue' });
};
