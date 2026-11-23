const form = document.querySelector('#tool-form');
const button = form.querySelector('button');
const message = document.querySelector('#form-message');
const count = document.querySelector('#description-count');
const FIELDS = ['user', 'name', 'category', 'description'];

const input = (field) => form.querySelector(`#${field}`);
const value = (field) => input(field).value;

function updateCount() {
  count.textContent = `${value('description').trim().length} / 300 caractères`;
}

function showError(field, text) {
  form.querySelector(`#${field}-error`).textContent = text;
  if (text) {
    input(field).setAttribute('aria-invalid', 'true');
  } else {
    input(field).removeAttribute('aria-invalid');
  }
}

function showMessage(className, text) {
  const paragraph = document.createElement('p');
  paragraph.className = className;
  paragraph.textContent = text;
  message.replaceChildren(paragraph);
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Erreur ${response.status}`);
  }
  return response.json();
}

async function fillLists() {
  try {
    const [users, categories] = await Promise.all([
      getJson('/api/users'),
      getJson('/api/tools/categories'),
    ]);

    users.forEach(({ id, firstName, district }) => {
      input('user').add(new Option(`${firstName} (${district})`, id));
    });
    categories.forEach((category) => {
      input('category').add(new Option(category, category));
    });
  } catch {
    showMessage('error-message', 'Impossible de charger le formulaire. Recharge la page.');
  }
}

async function sendTool() {
  const response = await fetch('/api/tools', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User-Id': value('user') },
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
    const user = value('user');
    form.reset();
    input('user').value = user;
    updateCount();
  } else if (status === 401) {
    showError('user', body.error);
    input('user').focus();
  } else if (body.errors) {
    body.errors.forEach((error) => showError(error.field, error.message));
    input(body.errors[0].field).focus();
  } else {
    showMessage('error-message', body.error);
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
    button.disabled = false;
  }
});

input('description').addEventListener('input', updateCount);
fillLists();
