import type {XtreamSeries, XtreamVod} from './types';
import {safeImageUri} from './media';

const getAdded = (value?: string | number) => {
    if (value === undefined || value === null) return 0;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
};

const getReleaseYear = (item: XtreamVod | XtreamSeries) => {
    const candidate = (item as {releaseDate?: string; releasedate?: string}).releaseDate ??
        (item as {releasedate?: string}).releasedate;
    const match = candidate?.match(/\d{4}/);
    if (match) return Number(match[0]);
    return 0;
};

const applyRecentYearFilter = <T extends XtreamVod | XtreamSeries>(
    items: T[],
    desiredCount: number
) => {
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;
    const current = items.filter((item) => getReleaseYear(item) === currentYear);
    if (current.length >= desiredCount) return current;
    const previous = items.filter((item) => getReleaseYear(item) === previousYear);
    const selected = [...current, ...previous];
    if (selected.length >= desiredCount) return selected;
    const selectedIds = new Set(
        selected.map((item) => ('stream_id' in item ? `movie-${item.stream_id}` : `series-${item.series_id}`))
    );
    const remaining = items.filter((item) => {
        const key = 'stream_id' in item ? `movie-${item.stream_id}` : `series-${item.series_id}`;
        return !selectedIds.has(key);
    });
    return [...selected, ...remaining];
};

const sortByAddedThenName = <T extends XtreamVod | XtreamSeries>(items: T[]) =>
    [...items].sort((a, b) => {
        const addedDiff =
            getAdded((b as {added?: string | number}).added) -
            getAdded((a as {added?: string | number}).added);
        if (addedDiff !== 0) return addedDiff;
        const nameA = (a as {name?: string}).name ?? '';
        const nameB = (b as {name?: string}).name ?? '';
        const nameDiff = nameA.localeCompare(nameB);
        if (nameDiff !== 0) return nameDiff;
        const idA = 'stream_id' in a ? a.stream_id : a.series_id;
        const idB = 'stream_id' in b ? b.stream_id : b.series_id;
        return idA - idB;
    });

const getLastModified = (value?: string | number) => {
    if (value === undefined || value === null) return 0;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
};

export const sortSeriesByReleaseAndModified = <T extends XtreamSeries>(items: T[]) =>
    [...items].sort((a, b) => {
        const yearDiff = getReleaseYear(b) - getReleaseYear(a);
        if (yearDiff !== 0) return yearDiff;
        const modifiedDiff =
            getLastModified((b as {last_modified?: string | number}).last_modified) -
            getLastModified((a as {last_modified?: string | number}).last_modified);
        if (modifiedDiff !== 0) return modifiedDiff;
        const nameDiff = (a.name ?? '').localeCompare(b.name ?? '');
        if (nameDiff !== 0) return nameDiff;
        return a.series_id - b.series_id;
    });

export const getRecentVod = (vod: XtreamVod[], limit: number) => {
    const candidates = vod.filter((item) => !!safeImageUri(item.cover ?? item.stream_icon));
    return sortByAddedThenName(applyRecentYearFilter(candidates, limit)).slice(0, limit);
};

export const getRecentSeries = (series: XtreamSeries[], limit: number) => {
    const candidates = series.filter((item) => !!safeImageUri(item.cover ?? item.backdrop_path?.[0]));
    return sortSeriesByReleaseAndModified(candidates).slice(0, limit);
};
