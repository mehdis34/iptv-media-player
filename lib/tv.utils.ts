import {decodeEpgText, parseEpgDate, resolveXmltvChannelId} from '@/lib/epg.utils';
import {formatClock} from '@/lib/date.utils';
import {safeImageUri} from '@/lib/media';
import type {XtreamEpgListing, XtreamStream} from '@/lib/types';

type TvNowInfo = {
    image?: string;
    title: string;
    subtitle: string;
    metaLabel: string;
    progress: number | null;
};

export const getTvNowInfo = ({
    stream,
    channelIdByName,
    listingsByChannel,
    isLoading = false,
}: {
    stream: XtreamStream;
    channelIdByName: Record<string, string>;
    listingsByChannel: Record<string, XtreamEpgListing[]>;
    isLoading?: boolean;
}): TvNowInfo => {
    const rawIcon = stream.stream_icon?.trim();
    const image = safeImageUri(rawIcon) ?? (rawIcon ? rawIcon : undefined);
    const channelId = resolveXmltvChannelId(stream, channelIdByName);
    const listings = listingsByChannel[channelId] ?? [];
    const now = new Date();
    const listing =
        listings.find((candidate) => {
            const start = parseEpgDate(candidate, 'start');
            const end = parseEpgDate(candidate, 'end');
            return !!start && !!end && start <= now && end >= now;
        }) ?? listings[0] ?? null;
    const start = listing ? parseEpgDate(listing, 'start') : null;
    const end = listing ? parseEpgDate(listing, 'end') : null;
    const progress =
        start && end
            ? Math.min(
                1,
                Math.max(0, (Date.now() - start.getTime()) / (end.getTime() - start.getTime()))
            )
            : null;
    const subtitle =
        start && end
            ? `${formatClock(start)} - ${formatClock(end)}`
            : isLoading
                ? 'Chargement...'
                : '';
    const title = listing?.title ? decodeEpgText(listing.title) : stream.name;
    const meta = listing?.category
        ? decodeEpgText(listing.category)
        : stream.stream_type ?? 'Divertissement';
    const metaLabel = meta && meta.toLowerCase() === 'live' ? '' : meta;
    return {image, title, subtitle, metaLabel, progress};
};
