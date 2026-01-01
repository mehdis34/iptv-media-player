import {useCallback, useEffect, useMemo, useRef, useState, type ElementRef, type Ref} from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    Image,
    type PressableProps,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';

import TVFocusPressable from '@/components/tv/TVFocusPressable';
import {safeImageUri} from '@/lib/media';
import {getVodInfoWithCache, setVodInfoCache} from '@/lib/vod-info-cache';
import {buildVodMetaLine, getVodSynopsis} from '@/lib/vod-info.utils';
import type {XtreamVodInfo} from '@/lib/types';
import {getActiveProfileId, getCredentials} from '@/lib/storage';
import {fetchVodInfo} from '@/lib/xtream';

export const TV_POSTER_ROW_WIDTH = 180;
export const TV_POSTER_GRID_WIDTH = 200;

type TVPosterCardProps = {
    title: string;
    image?: string;
    streamId?: number;
    categoryName?: string;
    onPress?: () => void;
    progress?: number;
    showTitle?: boolean;
    size?: 'row' | 'grid';
    expandedWidth?: number;
    loadDetailsOnFocus?: boolean;
    onFocus?: PressableProps['onFocus'];
    onBlur?: PressableProps['onBlur'];
    pressableRef?: Ref<ElementRef<typeof TVFocusPressable>>;
    nextFocusUp?: number;
    nextFocusDown?: number;
    nextFocusLeft?: number;
    nextFocusRight?: number;
};

const focusBaseStyle = {borderWidth: 2, borderColor: 'transparent'};

export default function TVPosterCard({
    title,
    image,
    streamId,
    categoryName,
    onPress,
    progress,
    showTitle = true,
    size = 'row',
    expandedWidth: expandedWidthProp,
    loadDetailsOnFocus = false,
    onFocus,
    onBlur,
    pressableRef,
    nextFocusUp,
    nextFocusDown,
    nextFocusLeft,
    nextFocusRight,
}: TVPosterCardProps) {
    const safeImage = safeImageUri(image);
    const [hasError, setHasError] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [vodInfo, setVodInfo] = useState<XtreamVodInfo | null>(null);
    const [isLoadingInfo, setIsLoadingInfo] = useState(false);
    const requestedStreamRef = useRef<number | null>(null);
    const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const vodInfoRef = useRef<XtreamVodInfo | null>(null);
    const synopsisRef = useRef('');
    const metaOpacity = useRef(new Animated.Value(0)).current;
    const widthAnim = useRef(new Animated.Value(TV_POSTER_ROW_WIDTH)).current;
    const windowWidth = useWindowDimensions().width;
    const fallbackWidth =
        Dimensions.get('window').width || Dimensions.get('screen').width || windowWidth;
    const screenWidth = windowWidth || fallbackWidth;
    const width = size === 'grid' ? TV_POSTER_GRID_WIDTH : TV_POSTER_ROW_WIDTH;
    const computedExpandedWidth = Math.max(width, Math.round(screenWidth * 0.4));
    const expandedWidth = Math.max(width, expandedWidthProp ?? computedExpandedWidth);
    const targetWidth = isFocused && size === 'row' ? expandedWidth : width;
    const clampedProgress =
        typeof progress === 'number' && Number.isFinite(progress)
            ? Math.max(0, Math.min(1, progress))
            : 0;
    const metaLine = useMemo(() => buildVodMetaLine(vodInfo), [vodInfo]);
    const synopsis = useMemo(() => getVodSynopsis(vodInfo, 200), [vodInfo]);
    const showDetails = isFocused && (metaLine || synopsis || isLoadingInfo);
    const shouldShowTitle = showTitle && !showDetails;
    const posterHeight = useMemo(() => Math.round(width * 1.5), [width]);
    const focusRingStyle = useMemo(
        () => ({
            borderWidth: 2,
            borderColor: '#ffffff',
            shadowColor: '#ffffff',
            shadowOpacity: 0.35,
            shadowRadius: 10,
            shadowOffset: {width: 0, height: 0},
        }),
        []
    );
    const wrapperStyle = useMemo(
        () => ({
            zIndex: isFocused ? 3 : 1,
            overflow: 'visible' as const,
            alignSelf: 'flex-start' as const,
            flexGrow: 0,
            flexShrink: 0,
        }),
        [isFocused]
    );

    const handleFocus = useCallback(
        (event: any) => {
            setIsFocused(true);
            onFocus?.(event);
        },
        [onFocus]
    );

    const handleBlur = useCallback(
        (event: any) => {
            setIsFocused(false);
            if (focusTimeoutRef.current) {
                clearTimeout(focusTimeoutRef.current);
                focusTimeoutRef.current = null;
            }
            if (isLoadingInfo) {
                setIsLoadingInfo(false);
                requestedStreamRef.current = null;
            }
            onBlur?.(event);
        },
        [isLoadingInfo, onBlur]
    );

    useEffect(() => {
        setHasError(false);
    }, [safeImage]);

    useEffect(() => {
        setVodInfo(null);
        setIsLoadingInfo(false);
        requestedStreamRef.current = null;
        metaOpacity.setValue(0);
        if (focusTimeoutRef.current) {
            clearTimeout(focusTimeoutRef.current);
            focusTimeoutRef.current = null;
        }
    }, [streamId]);

    useEffect(() => {
        vodInfoRef.current = vodInfo;
        synopsisRef.current = getVodSynopsis(vodInfo, 200);
    }, [vodInfo]);

    useEffect(() => {
        const shouldShowMeta = isFocused && !!(metaLine || synopsis);
        Animated.timing(metaOpacity, {
            toValue: shouldShowMeta ? 1 : 0,
            duration: 220,
            useNativeDriver: true,
        }).start();
    }, [isFocused, metaLine, synopsis, metaOpacity]);

    useEffect(() => {
        widthAnim.setValue(targetWidth);
    }, [targetWidth, widthAnim]);

    useEffect(() => {
        if (!loadDetailsOnFocus || !isFocused || !streamId) return;
        if (isLoadingInfo) return;
        if (vodInfoRef.current && synopsisRef.current) return;
        if (requestedStreamRef.current === streamId) return;
        let active = true;
        if (focusTimeoutRef.current) {
            clearTimeout(focusTimeoutRef.current);
        }
        focusTimeoutRef.current = setTimeout(() => {
            requestedStreamRef.current = streamId;
            setIsLoadingInfo(true);
            (async () => {
                const cached = await getVodInfoWithCache(streamId);
                if (!active) return;
                if (cached) {
                    setVodInfo(cached);
                    if (getVodSynopsis(cached, 200)) {
                        return;
                    }
                }
                const creds = await getCredentials();
                if (!active || !creds) return;
                const fresh = await fetchVodInfo(creds, streamId);
                if (!active) return;
                setVodInfo(fresh);
                const profileId = await getActiveProfileId();
                await setVodInfoCache(profileId, streamId, fresh);
            })()
                .catch(() => {})
                .finally(() => {
                    if (!active) return;
                    setIsLoadingInfo(false);
                    requestedStreamRef.current = null;
                });
        }, 250);
        return () => {
            active = false;
            if (focusTimeoutRef.current) {
                clearTimeout(focusTimeoutRef.current);
                focusTimeoutRef.current = null;
            }
        };
    }, [isFocused, loadDetailsOnFocus, streamId]);

    return (
        <Animated.View style={[wrapperStyle, {width: widthAnim}]}>
            <TVFocusPressable
                ref={pressableRef}
                onPress={onPress ?? undefined}
                onFocus={handleFocus}
                onBlur={handleBlur}
                disabled={false}
                nextFocusUp={nextFocusUp}
                nextFocusDown={nextFocusDown}
                nextFocusLeft={nextFocusLeft}
                nextFocusRight={nextFocusRight}
                className="relative overflow-hidden rounded-2xl bg-ash/70"
                style={[focusBaseStyle, {width: '100%'}]}
                focusedStyle={focusRingStyle}
            >
                {safeImage && !hasError ? (
                    <Image
                        source={{uri: safeImage}}
                        style={{width: '100%', height: posterHeight}}
                        resizeMode="cover"
                        onError={() => setHasError(true)}
                    />
                ) : (
                    <View
                        style={{width: '100%', height: posterHeight}}
                        className="items-center justify-center bg-slate px-3"
                    >
                        <Text className="text-center font-bodySemi text-sm text-white" numberOfLines={3}>
                            {title}
                        </Text>
                    </View>
                )}
                {clampedProgress > 0 ? (
                    <View className="absolute bottom-0 left-0 right-0 h-1 bg-black/60">
                        <View
                            className="h-full bg-ember"
                            style={{width: `${clampedProgress * 100}%`}}
                        />
                    </View>
                ) : null}
            </TVFocusPressable>
            <Text className="mt-3 font-bodySemi text-sm text-white" numberOfLines={1}>
                {title}
            </Text>
            {showDetails ? (
                <Animated.View className="mt-3" style={{opacity: metaOpacity}}>
                    {metaLine ? (
                        <Text className="font-bodySemi text-xs text-white/70" numberOfLines={2}>
                            {metaLine}
                        </Text>
                    ) : null}
                    {synopsis ? (
                        <Text className="mt-2 font-body text-xs text-white/65" numberOfLines={4}>
                            {synopsis}
                        </Text>
                    ) : null}
                    {!metaLine && !synopsis && isLoadingInfo ? (
                        <View className="mt-2">
                            <ActivityIndicator size="small" color="#ffffff" />
                        </View>
                    ) : null}
                </Animated.View>
            ) : null}
        </Animated.View>
    );
}
