const form = document.querySelector('#tool-form');
const button = form.querySelector('button');
const message = document.querySelector('#form-message');
const count = document.querySelector('#description-count');
const FIELDS = ['name', 'category', 'description'];

const input = (field) => form.querySelector(`#${field}`);
const value = (field) => input(field).value;

function updateCount() {
  count.textContent = `${value('description').trim().length} / 300 caractères`;
}

function showError(field, text) {
  form.querySelector(`#${field}-error`).textContent = text;
  if (text) input(field).setAttribute('aria-invalid', 'true');
  else input(field).removeAttribute('aria-invalid');
}

function showMessage(className, text) {
  const paragraph = document.createElement('p');
  paragraph.className = className;
  paragraph.textContent = text;
  message.replaceChildren(paragraph);
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Erreur ${response.status}`);
  return response.json();
}

async function fillLists() {
  try {
    const [categories, accountResponse] = await Promise.all([
      getJson('/api/tools/categories'),
      fetch('/api/auth/me'),
    ]);

    categories.forEach((category) => {
      input('category').add(new Option(category, category));
    });

    if (!accountResponse.ok) {
      showMessage('error-message', 'Connecte-toi pour pouvoir proposer un outil.');
      button.disabled = true;
    } else {
      button.disabled = false;
    }
  } catch {
    showMessage('error-message', 'Impossible de charger le formulaire. Recharge la page.');
    button.disabled = true;
  }
}

async function sendTool() {
  const response = await fetch('/api/tools', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: value('name'),
      category: value('category'),
      description: value('description'),
    }),
  });
  return { status: response.status, body: await response.json() };
}

function showResult({ status, body }) {
  if (status === 201) {
    showMessage('success-message', `« ${body.name} » est maintenant disponible dans le catalogue.`);
    form.reset();
    updateCount();
  } else if (status === 401) {
    showMessage('error-message', 'Connecte-toi avant de proposer un outil.');
    button.disabled = true;
  } else if (body.errors) {
    body.errors.forEach((error) => showError(error.field, error.message));
    input(body.errors[0].field).focus();
  } else {
    showMessage('error-message', body.error ?? 'Une erreur est survenue.');
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  FIELDS.forEach((field) => showError(field, ''));
  message.replaceChildren();
  button.disabled = true;

  try {
    showResult(await sendTool());
  } catch {
    showMessage('error-message', 'Le serveur ne répond pas. Vérifie qu’il est lancé, puis réessaie.');
  } finally {
    const account = await fetch('/api/auth/me').catch(() => null);
    button.disabled = !account?.ok;
  }
});

input('description').addEventListener('input', updateCount);
window.addEventListener('bricoloop:page', (event) => {
  if (event.detail === 'proposer') fillLists();
});
fillLists();