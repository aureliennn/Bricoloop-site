// Vrai pour une date qui existe, au format AAAA-MM-JJ.
export function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function validateLoanDates(body) {
  const { startDate, endDate } = body ?? {};
  const errors = [];

  if (!isDate(startDate)) {
    errors.push({ field: 'startDate', message: 'Date de début : obligatoire, au format AAAA-MM-JJ.' });
  }
  if (!isDate(endDate)) {
    errors.push({ field: 'endDate', message: 'Date de fin : obligatoire, au format AAAA-MM-JJ.' });
  }
  if (errors.length === 0 && endDate < startDate) {
    errors.push({ field: 'endDate', message: 'Date de fin : elle ne peut pas être avant la date de début.' });
  }

  return errors;
}

// Les deux jours de bord sont compris dans le prêt.
export function overlaps(a, b) {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

// Périodes déjà réservées d'un outil : les prêts acceptés, pas les demandes en attente.
export function reservedPeriods(loans, toolId) {
  return loans
    .filter((loan) => loan.toolId === toolId && loan.status === 'accepted')
    .map(({ startDate, endDate }) => ({ startDate, endDate }));
}
