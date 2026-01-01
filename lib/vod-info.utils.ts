import type {XtreamVodInfo} from '@/lib/types';

const normalizeText = (value?: string) => {
    if (!value) return '';
    return value.replace(/\s+/g, ' ').trim();
};

export const getVodReleaseYear = (info?: XtreamVodInfo | null) => {
    if (!info) return '';
    const details = info.info ?? {};
    const release =
        details.releasedate ??
        details.releaseDate ??
        (info.movie_data as {releasedate?: string | number} | undefined)?.releasedate ??
        '';
    if (!release) return '';
    const year = String(release).slice(0, 4);
    return /\d{4}/.test(year) ? year : '';
};

export const getVodCategoryLabel = (
    info?: XtreamVodInfo | null,
    fallbackCategory?: string
) => {
    const details = info?.info ?? {};
    const genre = normalizeText(details.genre);
    if (genre) return genre;
    return normalizeText(fallbackCategory);
};

export const getVodSynopsis = (info?: XtreamVodInfo | null, maxLength = 200) => {
    const details = info?.info ?? {};
    const plot = normalizeText(details.plot ?? details.description);
    if (!plot) return '';
    if (plot.length <= maxLength) return plot;
    const trimmed = plot.slice(0, maxLength).trimEnd();
    return `${trimmed}...`;
};

export const buildVodMetaLine = (
    info?: XtreamVodInfo | null,
    fallbackCategory?: string
) => {
    const category = getVodCategoryLabel(info, fallbackCategory);
    const year = getVodReleaseYear(info);
    return [category, year].filter(Boolean).join(' \u2022 ');
};
