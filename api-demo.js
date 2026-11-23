// Version en ligne seulement : GitHub Pages n'a pas de serveur.
// Ce fichier répond à la place de l'API, avec les données et la validation du projet.
// Les comptes, les outils, les demandes et les réponses restent dans le navigateur de chaque visiteur.
// Les mots de passe y sont hachés et ne sont jamais envoyés.
import * as seed from './src/seed.js?v=296a098';
import { overlaps, reservedPeriods, validateLoanDates } from './src/validation/loan.js?v=296a098';
import { CREATION_CATEGORIES, validateTool } from './src/validation/tool.js?v=296a098';

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
const accounts = savedList('bricoloop-comptes');
const allUsers = () => [...seed.users, ...accounts.all()];

const SESSION_KEY = 'bricoloop-session';
let memorySession = null;

function getSession() {
  try {
    return Number(localStorage.getItem(SESSION_KEY)) || memorySession;
  } catch {
    return memorySession;
  }
}

function setSession(userId) {
  memorySession = userId;
  try {
    if (userId === null) localStorage.removeItem(SESSION_KEY);
    else localStorage.setItem(SESSION_KEY, String(userId));
  } catch {
    // La session reste en mémoire jusqu'au rechargement.
  }
}

const toHex = (bytes) => [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const params = { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 210000 };
  return toHex(await crypto.subtle.deriveBits(params, key, 256));
}

function allLoans() {
  const saved = answers.all();
  return [...seed.loans, ...addedLoans.all()].map((loan) => {
    const answer = saved.findLast(({ loanId }) => loanId === loan.id);
    return answer ? { ...loan, status: answer.status } : loan;
  });
}

// Comme sur le serveur : accepter prête l'outil, déclarer le retour le rend disponible.
function allTools() {
  const toolOf = new Map([...seed.loans, ...addedLoans.all()].map(({ id, toolId }) => [id, toolId]));
  const events = answers.all().filter(({ status }) => status === 'accepted' || status === 'returned');
  return [...seed.tools, ...addedTools.all()].map((tool) => {
    const last = events.findLast(({ loanId }) => toolOf.get(loanId) === tool.id);
    return last ? { ...tool, status: last.status === 'accepted' ? 'lent' : 'available' } : tool;
  });
}

const nextId = (items) => Math.max(0, ...items.map(({ id }) => id)) + 1;
const findTool = (toolId) => allTools().find(({ id }) => id === toolId);

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const invalid = (errors) => json(400, { error: errors.map(({ message }) => message).join(' '), errors });

const currentUser = () => allUsers().find(({ id }) => id === getSession());

function publicUser(user) {
  return { id: user.id, username: user.username ?? user.firstName, email: user.email ?? null, district: user.district };
}

// Mêmes règles que src/routes/auth.js, qui ne peut pas tourner dans un navigateur.
function validateRegistration(body) {
  const errors = [];
  const text = (value) => (typeof value === 'string' ? value.trim() : '');
  const email = text(body.email).toLowerCase();
  const username = text(body.username);
  const password = typeof body.password === 'string' ? body.password : '';
  const district = text(body.district);

  if (!email) errors.push({ field: 'email', message: 'L’adresse e-mail est obligatoire.' });
  else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push({ field: 'email', message: 'L’adresse e-mail est invalide.' });

  if (!username) errors.push({ field: 'username', message: 'Le nom d’utilisateur est obligatoire.' });
  else if (!/^[a-zA-Z0-9_-]{3,24}$/.test(username)) errors.push({ field: 'username', message: 'Le nom d’utilisateur doit contenir 3 à 24 caractères : lettres, chiffres, tirets ou underscores.' });

  if (!password) errors.push({ field: 'password', message: 'Le mot de passe est obligatoire.' });
  else if (password.length < 8 || password.length > 128) errors.push({ field: 'password', message: 'Le mot de passe doit contenir entre 8 et 128 caractères.' });

  if (!district) errors.push({ field: 'district', message: 'Le quartier est obligatoire.' });
  else if (district.length < 2 || district.length > 80) errors.push({ field: 'district', message: 'Le quartier doit contenir entre 2 et 80 caractères.' });

  return { errors, email, username, password, district };
}

const sameName = (user, username) => (user.username ?? user.firstName).toLowerCase() === username.toLowerCase();

async function register(options) {
  const { errors, email, username, password, district } = validateRegistration(JSON.parse(options.body));
  if (errors.length > 0) return json(400, { error: 'Certains champs sont invalides.', errors });

  const duplicates = [];
  if (allUsers().some((user) => user.email === email)) duplicates.push({ field: 'email', message: 'Cette adresse e-mail est déjà utilisée.' });
  if (allUsers().some((user) => sameName(user, username))) duplicates.push({ field: 'username', message: 'Ce nom d’utilisateur est déjà utilisé.' });
  if (duplicates.length > 0) return json(409, { error: 'Un compte utilise déjà ces informations.', errors: duplicates });

  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const passwordHash = await hashPassword(password, salt);
  const user = { id: nextId(allUsers()), username, firstName: username, email, district, salt, passwordHash };
  accounts.add(user);
  setSession(user.id);
  return json(201, { message: 'Ton compte a été créé avec succès.', user: publicUser(user) });
}

async function login(options) {
  const { username, password } = JSON.parse(options.body);
  if (!username?.trim() || !password) return json(400, { error: 'Renseigne ton nom d’utilisateur et ton mot de passe.' });

  const user = allUsers().find((item) => sameName(item, username.trim()));
  if (!user?.passwordHash || (await hashPassword(password, user.salt)) !== user.passwordHash) {
    return json(401, { error: 'Nom d’utilisateur ou mot de passe incorrect.' });
  }
  setSession(user.id);
  return json(200, { message: 'Connexion réussie.', user: publicUser(user) });
}

function me() {
  const user = currentUser();
  return user ? json(200, { user: publicUser(user) }) : json(401, { error: 'Tu n’es pas connecté.' });
}

function logout() {
  setSession(null);
  return json(200, { message: 'Tu es maintenant déconnecté.' });
}

function showTool(options, id) {
  const tool = findTool(Number(id));
  if (!tool) return json(404, { error: 'Outil introuvable.' });
  const { name, category, description, status } = tool;
  const owner = allUsers().find((user) => user.id === tool.ownerId);
  return json(200, {
    id: tool.id, name, category, description, status,
    owner: owner ? { firstName: owner.firstName, lastName: owner.lastName ?? null, district: owner.district } : null,
  });
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
      const { firstName, district } = allUsers().find((item) => item.id === borrowerId);
      return { id, startDate, endDate, status, tool: { id: tool.id, name: tool.name }, borrower: { firstName, district } };
    });
  return json(200, received);
}

function listMine() {
  const user = currentUser();
  if (!user) return json(401, { error: 'Connecte-toi pour voir tes emprunts.' });

  const mine = allLoans()
    .filter(({ borrowerId }) => borrowerId === user.id)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map(({ id, toolId, startDate, endDate, status }) => {
      const tool = findTool(toolId);
      const { firstName, district } = allUsers().find((item) => item.id === tool.ownerId);
      return { id, startDate, endDate, status, tool: { id: tool.id, name: tool.name }, owner: { firstName, district } };
    });
  return json(200, mine);
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

  if (action === 'accept' && reservedPeriods(allLoans(), loan.toolId).some((period) => overlaps(period, loan))) {
    return json(409, { error: 'L\'outil est déjà réservé sur une partie de ces dates. Tu peux refuser cette demande.' });
  }

  const status = action === 'accept' ? 'accepted' : 'refused';
  answers.add({ loanId: loan.id, status });
  return json(200, { ...loan, status });
}

function returnLoan(options, id) {
  const user = currentUser();
  if (!user) return json(401, { error: 'Connecte-toi pour déclarer le retour d’un outil.' });

  const loan = allLoans().find((item) => item.id === Number(id));
  if (!loan) return json(404, { error: 'Ce prêt n’existe pas.' });
  if (findTool(loan.toolId).ownerId !== user.id) return json(403, { error: 'Seul le propriétaire de l’outil peut déclarer son retour.' });
  if (loan.status !== 'accepted') return json(409, { error: 'Seul un prêt accepté peut être déclaré rendu.' });

  answers.add({ loanId: loan.id, status: 'returned' });
  return json(200, { ...loan, status: 'returned' });
}

function listProfiles() {
  return json(200, allUsers()
    .filter(({ passwordHash }) => !passwordHash)
    .map(({ id, firstName, district }) => ({ id, firstName, district })));
}

function chooseProfile(options) {
  const { userId } = JSON.parse(options.body);
  if (!Number.isInteger(userId)) return json(400, { error: 'Choisis un profil.' });

  const user = allUsers().find(({ id }) => id === userId);
  if (!user) return json(404, { error: 'Ce profil n’existe pas.' });
  if (user.passwordHash) return json(403, { error: 'Ce compte demande un mot de passe. Utilise la connexion.' });

  setSession(user.id);
  return json(200, { message: 'Profil choisi.', user: publicUser(user) });
}

const routes = [
  [/^GET \/api\/tools$/, listTools],
  [/^POST \/api\/tools$/, createTool],
  [/^GET \/api\/tools\/categories$/, () => json(200, CREATION_CATEGORIES)],
  [/^GET \/api\/tools\/(\d+)$/, showTool],
  [/^GET \/api\/tools\/(\d+)\/reservations$/, listReservations],
  [/^POST \/api\/loans$/, createLoan],
  [/^GET \/api\/loans\/received$/, listReceived],
  [/^GET \/api\/loans\/mine$/, listMine],
  [/^POST \/api\/loans\/(\d+)\/(accept|refuse)$/, answerLoan],
  [/^GET \/api\/users$/, () => json(200, allUsers().map(({ id, firstName, district }) => ({ id, firstName, district })))],
  [/^POST \/api\/loans\/(\d+)\/return$/, returnLoan],
  [/^GET \/api\/auth\/profiles$/, listProfiles],
  [/^POST \/api\/auth\/profile$/, chooseProfile],
  [/^GET \/api\/auth\/me$/, me],
  [/^POST \/api\/auth\/register$/, register],
  [/^POST \/api\/auth\/login$/, login],
  [/^POST \/api\/auth\/logout$/, logout],
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
