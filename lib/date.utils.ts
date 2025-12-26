export const formatDayLabel = (date: Date, today: Date) => {
    const startOfDay = (value: Date) =>
        new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
    const target = startOfDay(date);
    const base = startOfDay(today);
    const diffDays = Math.round((target - base) / (24 * 60 * 60 * 1000));
    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return 'Demain';
    if (diffDays === 2) return 'Après-demain';
    return date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    });
};
