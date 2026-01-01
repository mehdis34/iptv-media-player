import type {ResumeItem, XtreamCategory, XtreamVod} from '@/lib/types';
import {safeImageUri} from '@/lib/media';

export type MovieHero = {
    id: number;
    title: string;
    image?: string;
    extension?: string;
    badge: string;
};

export type MovieCategoryRow = {
    category: XtreamCategory;
    items: XtreamVod[];
};

export function buildResumeMovieMap(resumeItems: ResumeItem[]) {
    const map = new Map<number, ResumeItem>();
    resumeItems
        .filter((item) => item.type === 'movie')
        .forEach((item) => map.set(item.id, item));
    return map;
}

export function getResumePlaybackState(resume?: ResumeItem | null) {
    if (!resume) {
        return {label: 'Lecture', progress: undefined};
    }
    const progress =
        resume.durationSec && Number.isFinite(resume.durationSec)
            ? resume.positionSec / resume.durationSec
            : undefined;
    const label = resume.completed
        ? 'Déjà vu'
        : resume.positionSec > 30
            ? 'Reprendre'
            : 'Lecture';
    return {label, progress};
}

export function getSelectedCategoryItems(
    streams: XtreamVod[],
    selectedCategoryId: string | null
) {
    if (!selectedCategoryId) return [];
    return streams.filter((stream) => stream.category_id === selectedCategoryId);
}

export function buildMovieCategoryRows({
    categories,
    streams,
    selectedCategoryId,
    limit = 12,
}: {
    categories: XtreamCategory[];
    streams: XtreamVod[];
    selectedCategoryId?: string | null;
    limit?: number;
}): MovieCategoryRow[] {
    const filtered = selectedCategoryId
        ? categories.filter((category) => category.category_id === selectedCategoryId)
        : categories;
    return filtered.map((category) => ({
        category,
        items: streams
            .filter((stream) => stream.category_id === category.category_id)
            .slice(0, limit),
    }));
}

export function buildMovieHero({
    categories,
    streams,
    selectedCategoryId,
}: {
    categories: XtreamCategory[];
    streams: XtreamVod[];
    selectedCategoryId?: string | null;
}): MovieHero | null {
    const selectedItems = getSelectedCategoryItems(streams, selectedCategoryId ?? null);
    const firstSelected = selectedItems[0];
    if (firstSelected) {
        return {
            id: firstSelected.stream_id,
            title: firstSelected.name,
            image: safeImageUri(firstSelected.cover ?? firstSelected.stream_icon),
            extension: firstSelected.container_extension,
            badge: 'Film',
        };
    }
    const firstCategoryId = categories[0]?.category_id;
    const firstFromCategory = firstCategoryId
        ? streams.find((stream) => stream.category_id === firstCategoryId)
        : null;
    const fallback = firstFromCategory ?? streams[0];
    if (!fallback) return null;
    return {
        id: fallback.stream_id,
        title: fallback.name,
        image: safeImageUri(fallback.cover ?? fallback.stream_icon),
        extension: fallback.container_extension,
        badge: 'Film',
    };
}
