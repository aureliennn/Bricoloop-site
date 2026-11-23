// Version en ligne seulement : GitHub Pages n'a pas de serveur.
// Ce fichier répond à la place de l'API, avec les données et la validation du projet.
// Les outils, les demandes et les réponses sont gardés dans le navigateur de chaque visiteur.
import * as seed from './src/seed.js?v=d8a5b87';
import { overlaps, reservedPeriods, validateLoanDates } from './src/validation/loan.js?v=d8a5b87';
import { CREATION_CATEGORIES, validateTool } from './src/validation/tool.js?v=d8a5b87';

const STATUS_ORDER = { available: 0, lent: 1, unavailable: 2 };

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
const answers = savedList('bricoloop-reponses');

function allLoans() {
  const saved = answers.all();
  return [...seed.loans, ...addedLoans.all()].map((loan) => {
    const answer = saved.find(({ loanId }) => loanId === loan.id);
    return answer ? { ...loan, status: answer.status } : loan;
  });
}

// Un outil dont une demande est acceptée est prêté.
function allTools() {
  const accepted = allLoans().filter(({ status }) => status === 'accepted');
  return [...seed.tools, ...addedTools.all()].map((tool) => {
    return accepted.some(({ toolId }) => toolId === tool.id) ? { ...tool, status: 'lent' } : tool;
  });
}

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

function listReceived(options) {
  const user = currentUser(options);
  if (!user) return json(401, { error: 'Choisis ton profil pour voir les demandes reçues.' });

  const myTools = allTools().filter(({ ownerId }) => ownerId === user.id);
  const received = allLoans()
    .filter((loan) => myTools.some(({ id }) => id === loan.toolId))
    .sort((a, b) => {
      return (b.status === 'pending') - (a.status === 'pending') || a.startDate.localeCompare(b.startDate);
    })
    .map(({ id, toolId, borrowerId, startDate, endDate, status }) => {
      const tool = myTools.find((item) => item.id === toolId);
      const { firstName, district } = seed.users.find((item) => item.id === borrowerId);
      return { id, startDate, endDate, status, tool: { id: tool.id, name: tool.name }, borrower: { firstName, district } };
    });
  return json(200, received);
}

function answerLoan(options, id, action) {
  const user = currentUser(options);
  if (!user) return json(401, { error: 'Choisis ton profil avant de répondre à une demande.' });

  const loan = allLoans().find((item) => item.id === Number(id));
  if (!loan) return json(404, { error: 'Cette demande n\'existe pas.' });
  if (findTool(loan.toolId).ownerId !== user.id) {
    return json(403, { error: 'Seul le propriétaire de l\'outil peut répondre à cette demande.' });
  }
  if (loan.status !== 'pending') return json(409, { error: 'Cette demande a déjà reçu une réponse.' });

  const status = action === 'accept' ? 'accepted' : 'refused';
  answers.add({ loanId: loan.id, status });
  return json(200, { ...loan, status });
}

const routes = [
  [/^GET \/api\/tools$/, listTools],
  [/^POST \/api\/tools$/, createTool],
  [/^GET \/api\/tools\/categories$/, () => json(200, CREATION_CATEGORIES)],
  [/^GET \/api\/tools\/(\d+)\/reservations$/, listReservations],
  [/^POST \/api\/loans$/, createLoan],
  [/^GET \/api\/loans\/received$/, listReceived],
  [/^POST \/api\/loans\/(\d+)\/(accept|refuse)$/, answerLoan],
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
