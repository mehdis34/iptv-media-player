import {createContext, type ReactNode, useCallback, useContext, useMemo, useState} from 'react';

type TvNavScrollContextValue = {
    isScrolled: boolean;
    setScrolled: (value: boolean) => void;
};

const TvNavScrollContext = createContext<TvNavScrollContextValue | null>(null);

export function TVNavScrollProvider({children}: {children: ReactNode}) {
    const [isScrolled, setIsScrolled] = useState(false);
    const setScrolled = useCallback((value: boolean) => {
        setIsScrolled((prev) => (prev === value ? prev : value));
    }, []);
    const value = useMemo(() => ({isScrolled, setScrolled}), [isScrolled, setScrolled]);

    return <TvNavScrollContext.Provider value={value}>{children}</TvNavScrollContext.Provider>;
}

export function useTvNavScroll() {
    const ctx = useContext(TvNavScrollContext);
    if (!ctx) {
        return {isScrolled: false, setScrolled: () => {}};
    }
    return ctx;
}
