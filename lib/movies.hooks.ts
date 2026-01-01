import {useCallback, useEffect, useRef, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';

import type {XtreamCategory, XtreamVod} from '@/lib/types';
import {useFavoritesAndResumesState} from '@/lib/catalog.hooks';
import {applyFavoritesAndResumes, CATALOG_CACHE_TTL_MS, shouldReloadForProfile} from '@/lib/catalog.utils';
import {getCatalogCache, getCredentials, setCatalogCache} from '@/lib/storage';
import {fetchVodCategories, fetchVodStreams} from '@/lib/xtream';

type UseMoviesCatalogOptions = {
    onMissingCredentials?: () => void;
};

export function useMoviesCatalog(options: UseMoviesCatalogOptions = {}) {
    const {onMissingCredentials} = options;
    const onMissingCredentialsRef = useRef(onMissingCredentials);
    const [vodCategories, setVodCategories] = useState<XtreamCategory[]>([]);
    const [vodStreams, setVodStreams] = useState<XtreamVod[]>([]);
    const {favorites, setFavorites, resumeItems, setResumeItems} = useFavoritesAndResumesState();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showInitialLoader, setShowInitialLoader] = useState(false);
    const [initialLoadingMessage, setInitialLoadingMessage] = useState('Chargement en cours...');
    const lastProfileKey = useRef<string | null>(null);
    const hasLoadedOnce = useRef(false);

    useEffect(() => {
        onMissingCredentialsRef.current = onMissingCredentials;
    }, [onMissingCredentials]);

    const loadData = useCallback(() => {
        let mounted = true;

        async function load() {
            try {
                if (
                    !(await shouldReloadForProfile({
                        lastProfileKey,
                        hasLoadedOnce,
                    }))
                ) {
                    return;
                }
                setLoading(true);
                setShowInitialLoader(false);
                setError('');
                const creds = await getCredentials();
                if (!creds) {
                    if (mounted) setLoading(false);
                    onMissingCredentialsRef.current?.();
                    return;
                }
                const cache = await getCatalogCache(['vodCategories', 'vodStreams']);
                const now = Date.now();
                const cacheFresh =
                    cache.updatedAt.vodCategories &&
                    cache.updatedAt.vodStreams &&
                    now - cache.updatedAt.vodCategories < CATALOG_CACHE_TTL_MS &&
                    now - cache.updatedAt.vodStreams < CATALOG_CACHE_TTL_MS;

                if (cache.data.vodCategories) setVodCategories(cache.data.vodCategories);
                if (cache.data.vodStreams) setVodStreams(cache.data.vodStreams);

                const applied = await applyFavoritesAndResumes({
                    setFavorites,
                    setResumes: setResumeItems,
                    isMounted: () => mounted,
                });
                if (!applied) return;

                if (cacheFresh) {
                    hasLoadedOnce.current = true;
                    setLoading(false);
                    return;
                }

                setShowInitialLoader(true);
                setInitialLoadingMessage('Chargement du catalogue...');

                const [vodCats, vod] = await Promise.all([
                    fetchVodCategories(creds),
                    fetchVodStreams(creds),
                ]);
                if (!mounted) return;
                setVodCategories(vodCats);
                setVodStreams(vod);
                await setCatalogCache({
                    vodCategories: vodCats,
                    vodStreams: vod,
                });
                hasLoadedOnce.current = true;
            } catch (err) {
                if (!mounted) return;
                setError(err instanceof Error ? err.message : 'Chargement impossible.');
            } finally {
                if (mounted) {
                    setLoading(false);
                    setShowInitialLoader(false);
                }
            }
        }

        load();
        return () => {
            mounted = false;
        };
    }, [setFavorites, setResumeItems]);

    useFocusEffect(loadData);

    return {
        vodCategories,
        vodStreams,
        favorites,
        setFavorites,
        resumeItems,
        setResumeItems,
        loading,
        error,
        showInitialLoader,
        initialLoadingMessage,
    };
}
