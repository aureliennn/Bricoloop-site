import { toolImage } from './images.js?v=68b5db8';

const dialog = document.querySelector('#reservation');
const form = dialog.querySelector('form');
const grid = dialog.querySelector('#calendar-days');
const message = dialog.querySelector('#reservation-message');
const previous = dialog.querySelector('#previous-month');
const submit = dialog.querySelector('#reservation-submit');
const inputs = {
  startDate: dialog.querySelector('#start-date'),
  endDate: dialog.querySelector('#end-date'),
};

const DAY_LABELS = {
  free: 'disponible',
  reserved: 'déjà réservé',
  selected: 'sélectionné',
  closed: 'non réservable',
};
const monthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const dayFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeZone: 'UTC' });

let tool = null;
let reserved = [];
let today = '';
let year = 0;
let month = 0;

const toIso = (y, m, d) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);

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

function isSelected(date) {
  const start = inputs.startDate.value;
  const end = inputs.endDate.value;
  return date === start || date === end || (start !== '' && start <= date && date <= end);
}

function dayState(date) {
  if (reserved.some(({ startDate, endDate }) => startDate <= date && date <= endDate)) return 'reserved';
  if (date < today || tool.status === 'unavailable') return 'closed';
  return isSelected(date) ? 'selected' : 'free';
}

function renderCalendar() {
  const focused = grid.contains(document.activeElement) ? document.activeElement.dataset.date : null;
  dialog.querySelector('#calendar-month').textContent = monthFormat.format(Date.UTC(year, month, 1));
  previous.disabled = toIso(year, month, 1) <= today;

  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const days = Array.from({ length: lastDay }, (_, index) => {
    const date = toIso(year, month, index + 1);
    const state = dayState(date);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `day day-${state}`;
    button.dataset.date = date;
    button.textContent = index + 1;
    button.disabled = state === 'reserved' || state === 'closed';
    button.setAttribute('aria-label', `${dayFormat.format(new Date(`${date}T00:00:00Z`))}, ${DAY_LABELS[state]}`);
    button.setAttribute('aria-pressed', String(state === 'selected'));
    return button;
  });

  // La semaine commence le lundi.
  days[0].style.gridColumnStart = ((new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7) + 1;
  grid.replaceChildren(...days);
  if (focused) {
    grid.querySelector(`[data-date="${focused}"]`)?.focus();
  }
}

function showMonthOf(date) {
  year = Number(date.slice(0, 4));
  month = Number(date.slice(5, 7)) - 1;
}

function moveMonth(step) {
  showMonthOf(toIso(year, month + step, 1));
  renderCalendar();
}

// Premier clic : début. Deuxième clic : fin. Un clic plus tôt ou un troisième clic recommence.
function pickDay(date) {
  const start = inputs.startDate.value;
  if (start === '' || inputs.endDate.value !== '' || date < start) {
    inputs.startDate.value = date;
    inputs.endDate.value = '';
  } else {
    inputs.endDate.value = date;
  }
  message.replaceChildren();
  renderCalendar();
}

export async function openReservation(selectedTool, statusLabel) {
  const now = new Date();
  tool = selectedTool;
  reserved = [];
  today = toIso(now.getFullYear(), now.getMonth(), now.getDate());
  showMonthOf(today);
  inputs.startDate.value = '';
  inputs.endDate.value = '';
  message.replaceChildren();

  dialog.querySelector('#reservation-title').textContent = tool.name;
  dialog.querySelector('#reservation-details').textContent = `${tool.category} · ${statusLabel}`;
  const image = dialog.querySelector('#reservation-image');
  image.src = toolImage(tool);
  image.alt = `Illustration : ${tool.name}`;

  // Le formulaire reste bloqué tant que les dates réservées ne sont pas connues.
  submit.disabled = true;
  grid.replaceChildren();
  dialog.querySelector('#calendar-month').textContent = 'Chargement...';
  dialog.showModal();

  try {
    const periods = await getJson(`/api/tools/${selectedTool.id}/reservations`);
    if (tool !== selectedTool) return;
    reserved = periods;
    renderCalendar();
    if (tool.status === 'unavailable') {
      showMessage('error-message', 'Cet outil est indisponible pour le moment.');
    } else {
      submit.disabled = false;
    }
  } catch {
    if (tool === selectedTool) {
      showMessage('error-message', 'Impossible de charger les disponibilités. Ferme ce menu et réessaie.');
    }
  }
}

async function sendRequest() {
  const response = await fetch('/api/loans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      toolId: tool.id,
      startDate: inputs.startDate.value,
      endDate: inputs.endDate.value,
    }),
  });
  return { status: response.status, body: await response.json() };
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const requestedTool = tool;
  message.replaceChildren();
  submit.disabled = true;

  try {
    const { status, body } = await sendRequest();
    if (tool !== requestedTool) return;
    if (status === 201) {
      inputs.startDate.value = '';
      inputs.endDate.value = '';
      renderCalendar();
      showMessage('success-message', 'Demande envoyée. Elle est en attente de réponse du propriétaire.');
    } else {
      showMessage('error-message', body.error);
    }
  } catch {
    if (tool === requestedTool) {
      showMessage('error-message', 'Le serveur ne répond pas. Vérifie qu’il est lancé, puis réessaie.');
    }
  } finally {
    if (tool === requestedTool) {
      submit.disabled = false;
    }
  }
});

Object.values(inputs).forEach((input) => {
  input.addEventListener('change', () => {
    message.replaceChildren();
    if (input.value >= today) {
      showMonthOf(input.value);
    }
    renderCalendar();
  });
});

grid.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (button) pickDay(button.dataset.date);
});
previous.addEventListener('click', () => moveMonth(-1));
dialog.querySelector('#next-month').addEventListener('click', () => moveMonth(1));
dialog.querySelector('#reservation-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => {
  // Un clic sur le fond sombre vise la boîte elle-même.
  if (event.target === dialog) dialog.close();
});

