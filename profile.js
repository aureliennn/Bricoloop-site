import { errorMessage, readJson } from './api-errors.js?v=296a098';
import { refreshAccount } from './auth.js?v=296a098';

const form = document.querySelector('#profile-form');
const select = document.querySelector('#profile');
const button = form.querySelector('button');
const message = document.querySelector('#profile-message');

async function loadProfiles() {
  try {
    const response = await fetch('/api/auth/profiles');
    const body = await readJson(response);
    if (!response.ok) throw new Error(errorMessage(response.status, body));
    body.forEach(({ id, firstName, district }) => {
      select.add(new Option(`${firstName} (${district})`, id));
    });
  } catch {
    message.textContent = 'Impossible de charger les profils. Recharge la page.';
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = '';
  button.disabled = true;

  try {
    const response = await fetch('/api/auth/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: select.value === '' ? null : Number(select.value) }),
    });
    const body = await readJson(response);

    if (!response.ok) {
      message.textContent = errorMessage(response.status, body);
      select.focus();
      return;
    }

    form.reset();
    await refreshAccount();
    location.hash = '#catalogue';
  } catch {
    message.textContent = 'Le serveur ne répond pas. Vérifie qu’il est lancé, puis réessaie.';
  } finally {
    button.disabled = false;
  }
});

loadProfiles();
