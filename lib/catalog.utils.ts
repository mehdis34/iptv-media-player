import {getActiveProfileId, getFavoriteItems, getResumeItems} from '@/lib/storage';
import type {FavoriteItem, ResumeItem} from '@/lib/types';

export const CATALOG_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export const getProfileCacheKey = (profileId?: string | null) => profileId ?? 'default';

export const getActiveProfileKey = async () => {
    const profileId = await getActiveProfileId();
    return getProfileCacheKey(profileId);
};

type RefValue<T> = { current: T };

export const getProfileReloadState = async (options: {
    lastProfileKey: RefValue<string | null>;
    hasLoadedOnce?: RefValue<boolean>;
}) => {
    const profileKey = await getActiveProfileKey();
    const profileChanged = options.lastProfileKey.current !== profileKey;
    if (options.hasLoadedOnce?.current && !profileChanged) {
        return {profileKey, profileChanged, shouldReload: false};
    }
    options.lastProfileKey.current = profileKey;
    return {profileKey, profileChanged, shouldReload: true};
};

export const shouldReloadForProfile = async (options: {
    lastProfileKey: RefValue<string | null>;
    hasLoadedOnce?: RefValue<boolean>;
}) => {
    const {shouldReload} = await getProfileReloadState(options);
    return shouldReload;
};

export const getFavoritesAndResumes = async (): Promise<{
    favorites: FavoriteItem[];
    resumes: ResumeItem[];
}> => {
    const [favorites, resumes] = await Promise.all([getFavoriteItems(), getResumeItems()]);
    return {favorites, resumes};
};

export const applyFavoritesAndResumes = async (options: {
    setFavorites: (items: FavoriteItem[]) => void;
    setResumes: (items: ResumeItem[]) => void;
    isMounted?: () => boolean;
}) => {
    const {favorites, resumes} = await getFavoritesAndResumes();
    if (options.isMounted && !options.isMounted()) return false;
    options.setFavorites(favorites);
    options.setResumes(resumes);
    return true;
};
