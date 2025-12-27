import {useState} from 'react';

import type {FavoriteItem, ResumeItem} from '@/lib/types';

export const useFavoritesAndResumesState = () => {
    const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
    const [resumeItems, setResumeItems] = useState<ResumeItem[]>([]);
    return {favorites, setFavorites, resumeItems, setResumeItems};
};
