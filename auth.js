const loginForm = document.querySelector('#login-form');
const registerForm = document.querySelector('#register-form');
const loginMessage = document.querySelector('#login-message');
const registerMessage = document.querySelector('#register-message');
const accountStatus = document.querySelector('#account-status');
const logoutButton = document.querySelector('#logout-button');
window.bricoloopAuthReady = false;
window.bricoloopAuthenticated = false;

function setErrors(prefix, fields) {
  document.querySelectorAll(`#${prefix}-form .field-error`).forEach((item) => {
    item.textContent = '';
  });

  for (const error of fields ?? []) {
    const target = document.querySelector(`#${prefix}-${error.field}-error`);
    if (target) target.textContent = error.message;
  }
}

function showAuthTab() {
  const registration = location.hash === '#inscription';
  loginForm.hidden = registration;
  registerForm.hidden = !registration;
  document.querySelector('#profile-form').hidden = registration;

  document.querySelector('#login-tab').setAttribute('aria-selected', String(!registration));
  document.querySelector('#register-tab').setAttribute('aria-selected', String(registration));
}

export async function refreshAccount() {
  try {
    const response = await fetch('/api/auth/me');
    if (!response.ok) {
      window.bricoloopAuthReady = true;
      window.bricoloopAuthenticated = false;
      document.body.classList.remove('authenticated');
      window.dispatchEvent(new Event('bricoloop:auth'));
      accountStatus.textContent = 'Visiteur';
      logoutButton.hidden = true;
      return null;
    }

    const { user } = await response.json();
    window.bricoloopAuthReady = true;
    window.bricoloopAuthenticated = true;
    document.body.classList.add('authenticated');
    window.dispatchEvent(new Event('bricoloop:auth'));
    accountStatus.textContent = `Connecté : ${user.username}`;
    logoutButton.hidden = false;
    return user;
  } catch {
    window.bricoloopAuthReady = true;
    window.bricoloopAuthenticated = false;
    document.body.classList.remove('authenticated');
    window.dispatchEvent(new Event('bricoloop:auth'));
    accountStatus.textContent = 'Connexion au serveur impossible';
    logoutButton.hidden = true;
    return null;
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginMessage.textContent = '';
  setErrors('login', []);

  const button = loginForm.querySelector('button');
  button.disabled = true;

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: document.querySelector('#login-username').value,
        password: document.querySelector('#login-password').value,
      }),
    });

    const body = await response.json();
    if (!response.ok) {
      loginMessage.textContent = body.error ?? 'Connexion impossible.';
      return;
    }

    loginForm.reset();
    await refreshAccount();
    location.hash = '#catalogue';
  } catch {
    loginMessage.textContent = 'Le serveur ne répond pas. Réessaie.';
  } finally {
    button.disabled = false;
  }
});


// Autocomplétion des villes françaises
const cityInput = document.querySelector('#register-district');
const citySuggestions = document.createElement('div');
citySuggestions.className = 'city-suggestions';
citySuggestions.setAttribute('role', 'listbox');
cityInput.insertAdjacentElement('afterend', citySuggestions);

let cityTimer;

cityInput.addEventListener('input', () => {
  clearTimeout(cityTimer);
  citySuggestions.replaceChildren();

  const query = cityInput.value.trim();
  if (query.length < 2) return;

  cityTimer = setTimeout(async () => {
    try {
      const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&type=municipality&autocomplete=1&limit=8`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Recherche indisponible');

      const data = await response.json();

      data.features.forEach((feature) => {
        const properties = feature.properties;
        const context = (properties.context ?? '').split(',').map((part) => part.trim());
        const departmentCode = context[0] ?? '';
        const departmentName = context[1] ?? '';
        const city = properties.city ?? properties.name;
        const postcode = properties.postcode ?? '';

        if (!city || !postcode) return;

        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'city-suggestion';
        option.setAttribute('role', 'option');
        option.textContent = `${city} (${postcode}) — ${departmentName} (${departmentCode})`;

        option.addEventListener('click', () => {
          cityInput.value = option.textContent;
          citySuggestions.replaceChildren();
        });

        citySuggestions.append(option);
      });

      if (!citySuggestions.children.length) {
        const empty = document.createElement('p');
        empty.textContent = 'Aucune commune trouvée.';
        citySuggestions.append(empty);
      }
    } catch {
      citySuggestions.textContent = 'Suggestions temporairement indisponibles.';
    }
  }, 300);
});

document.addEventListener('click', (event) => {
  if (!citySuggestions.contains(event.target) && event.target !== cityInput) {
    citySuggestions.replaceChildren();
  }
});

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  registerMessage.textContent = '';
  setErrors('register', []);

  const button = registerForm.querySelector('button');
  button.disabled = true;

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: document.querySelector('#register-email').value,
        username: document.querySelector('#register-username').value,
        password: document.querySelector('#register-password').value,
        district: document.querySelector('#register-district').value,
      }),
    });

    const body = await response.json();
    if (!response.ok) {
      registerMessage.textContent = body.error ?? 'Création du compte impossible.';
      setErrors('register', body.errors);
      return;
    }

    registerForm.reset();
    await refreshAccount();
    location.hash = '#catalogue';
  } catch {
    registerMessage.textContent = 'Le serveur ne répond pas. Réessaie.';
  } finally {
    button.disabled = false;
  }
});

logoutButton.addEventListener('click', async () => {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    await refreshAccount();
    location.hash = '#connexion';
  } catch {
    accountStatus.textContent = 'Déconnexion impossible. Réessaie.';
  }
});

window.addEventListener('hashchange', showAuthTab);
window.addEventListener('bricoloop:page', showAuthTab);
refreshAccount();
showAuthTab();