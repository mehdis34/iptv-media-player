import Ionicons from '@expo/vector-icons/Ionicons';
import {LinearGradient} from 'expo-linear-gradient';
import {Image, Text, View} from 'react-native';
import {useEffect, useMemo, useState} from 'react';

import TVFocusPressable from '@/components/tv/TVFocusPressable';
import {safeImageUri} from '@/lib/media';
import {getVodInfoWithCache, setVodInfoCache} from '@/lib/vod-info-cache';
import {buildVodMetaLine, getVodSynopsis} from '@/lib/vod-info.utils';
import {getActiveProfileId, getCredentials} from '@/lib/storage';
import {fetchVodInfo} from '@/lib/xtream';
import type {XtreamVodInfo} from '@/lib/types';

type TVFeaturedMovieProps = {
    title: string;
    image?: string;
    backdrop?: string;
    streamId?: number;
    badge?: string;
    subtitle?: string;
    playLabel?: string;
    progress?: number;
    isFavorite?: boolean;
    onPlay?: () => void;
    onToggleFavorite?: () => void;
    fullBleed?: boolean;
    height?: number;
    autoFocusPlay?: boolean;
};

const focusBaseStyle = {borderWidth: 2};

export default function TVFeaturedMovie({
    title,
    image,
    backdrop,
    streamId,
    badge = 'Film',
    subtitle,
    playLabel = 'Lecture',
    progress,
    isFavorite = false,
    onPlay,
    onToggleFavorite,
    fullBleed = false,
    height,
    autoFocusPlay = false,
}: TVFeaturedMovieProps) {
    const safeImage = safeImageUri(image);
    const fallbackBackdrop = safeImageUri(backdrop);
    const [isPlayFocused, setIsPlayFocused] = useState(false);
    const [backdropError, setBackdropError] = useState(false);
    const [vodInfo, setVodInfo] = useState<XtreamVodInfo | null>(null);
    const posterImage = safeImageUri(image);
    const clampedProgress =
        typeof progress === 'number' && Number.isFinite(progress)
            ? Math.max(0, Math.min(1, progress))
            : 0;
    const containerStyle = fullBleed && height ? {height} : undefined;
    const imageClassName = fullBleed ? 'w-full' : 'h-[65vh] w-full';
    const imageStyle = fullBleed && height ? {height} : undefined;
    const containerClassName = fullBleed
        ? 'overflow-hidden'
        : 'overflow-hidden rounded-[28px] border border-white/10 bg-ash/60';
    const posterHeight = height ? Math.round(height * 0.36) : 280;
    const posterWidth = Math.round(posterHeight * 0.62);
    const focusRingStyle = {
        transform: [{scale: 1.1}],
        backgroundColor: '#ed0341',
        borderColor: '#ed0341',
        shadowColor: '#ed0341',
        shadowOpacity: 0.4,
        shadowRadius: 10,
        shadowOffset: {width: 0, height: 0},
    };

    const vodBackdrop = useMemo(
        () => safeImageUri(vodInfo?.info?.backdrop_path?.[0]),
        [vodInfo]
    );
    const backdropImage = useMemo(
        () => vodBackdrop ?? fallbackBackdrop,
        [fallbackBackdrop, vodBackdrop]
    );
    const resolvedBackdrop = useMemo(() => {
        if (backdropError) {
            return safeImage;
        }
        if (backdropImage) {
            return backdropImage;
        }
        return vodInfo ? safeImage : undefined;
    }, [backdropError, backdropImage, safeImage, vodInfo]);
    const metaLine = useMemo(() => buildVodMetaLine(vodInfo), [vodInfo]);
    const synopsis = useMemo(() => getVodSynopsis(vodInfo, 300), [vodInfo]);

    useEffect(() => {
        let active = true;
        if (!streamId) {
            setBackdropError(false);
            setVodInfo(null);
            return () => {
                active = false;
            };
        }
        (async () => {
            const cached = await getVodInfoWithCache(streamId);
            if (!active) return;
            if (cached) {
                setVodInfo(cached);
            }
            const creds = await getCredentials();
            if (!active || !creds) return;
            const fresh = await fetchVodInfo(creds, streamId);
            if (!active) return;
            setVodInfo(fresh);
            const profileId = await getActiveProfileId();
            await setVodInfoCache(profileId, streamId, fresh);
        })();
        return () => {
            active = false;
        };
    }, [streamId]);

    useEffect(() => {
        setBackdropError(false);
    }, [resolvedBackdrop, streamId]);

    return (
        <View className={containerClassName} style={containerStyle}>
            <View className="relative h-full">
                {resolvedBackdrop ? (
                    <Image
                        source={{uri: resolvedBackdrop}}
                        className={imageClassName}
                        style={[imageStyle, {opacity: 0.5}]}
                        resizeMode="cover"
                        onError={() => setBackdropError(true)}
                    />
                ) : (
                    <LinearGradient
                        colors={['#1b1b24', '#0b0b0f']}
                        className={imageClassName}
                        style={imageStyle}
                    />
                )}
                <LinearGradient
                    colors={['rgba(0,0,0,0.85)', 'transparent']}
                    start={{x: 0, y: 0.5}}
                    end={{x: 1, y: 0.5}}
                    style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: '50%',
                    }}
                />
                <View className="absolute inset-0 bg-black/35"/>
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.85)']}
                    locations={[0.35, 1]}
                    className="absolute inset-0"
                />
                <View className="absolute inset-x-0 bottom-0 px-10 pb-10">
                    <View className="flex-row items-center gap-8">
                        {fullBleed && posterImage ? (
                            <View
                                className="overflow-hidden rounded-lg bg-ash/40"
                                style={{width: posterWidth, height: posterHeight}}
                            >
                                <Image
                                    source={{uri: posterImage}}
                                    style={{width: posterWidth, height: posterHeight}}
                                    resizeMode="cover"
                                />
                            </View>
                        ) : null}
                        <View className="flex-1">
                            <Text className="font-display text-4xl text-white" numberOfLines={2}>
                                {title}
                            </Text>
                            {subtitle || metaLine ? (
                                <Text className="mt-2 font-body text-base text-white/70">
                                    {subtitle || metaLine}
                                </Text>
                            ) : (
                                <Text className="mt-2 font-body text-base text-white/70">{badge}</Text>
                            )}
                            {synopsis ? (
                                <View className="mt-3 max-w-[48%]">
                                    <Text className="font-body text-sm text-white/70" numberOfLines={3}>
                                        {synopsis}
                                    </Text>
                                </View>
                            ) : null}
                            <View className="mt-6 flex-row gap-4">
                                <TVFocusPressable
                                    onPress={onPlay}
                                    disabled={!onPlay}
                                    hasTVPreferredFocus={autoFocusPlay}
                                    onFocus={() => setIsPlayFocused(true)}
                                    onBlur={() => setIsPlayFocused(false)}
                                    className={`flex-row items-center justify-center gap-2 rounded-lg px-6 py-3 ${
                                        onPlay ? 'bg-white' : 'bg-white/40'
                                    }`}
                                    focusedStyle={focusRingStyle}
                                >
                                    <Ionicons name="play" size={20} color={isPlayFocused ? '#ffffff' : '#111111'}/>
                                    <Text
                                        className={`font-bodySemi text-base ${
                                            isPlayFocused ? 'text-white' : 'text-black'
                                        }`}
                                    >
                                        {playLabel}
                                    </Text>
                                </TVFocusPressable>
                                <TVFocusPressable
                                    onPress={onToggleFavorite}
                                    disabled={!onToggleFavorite}
                                    className={`flex-row items-center justify-center gap-2 rounded-lg border border-white/15 px-6 py-3 ${
                                        onToggleFavorite ? 'bg-white/10' : 'bg-white/5'
                                    }`}
                                    style={focusBaseStyle}
                                    focusedStyle={{
                                        transform: [{scale: 1.10}],
                                        borderColor: '#ffffff',
                                        shadowColor: '#ffffff',
                                        shadowOpacity: 0.35,
                                        shadowRadius: 8,
                                        shadowOffset: {width: 0, height: 0},
                                    }}
                                >
                                    <Ionicons
                                        name={isFavorite ? 'checkmark' : 'add'}
                                        size={20}
                                        color="#ffffff"
                                    />
                                    <Text className="font-bodySemi text-base text-white">
                                        {isFavorite ? 'Dans ma liste' : 'Ma liste'}
                                    </Text>
                                </TVFocusPressable>
                            </View>
                        </View>
                    </View>
                </View>
                {clampedProgress > 0 ? (
                    <View className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/60">
                        <View
                            className="h-full bg-ember"
                            style={{width: `${clampedProgress * 100}%`}}
                        />
                    </View>
                ) : null}
            </View>
        </View>
    );
}
