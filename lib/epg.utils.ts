import {Buffer} from 'buffer';

import type {XtreamEpgListing, XtreamStream} from '@/lib/types';

export const normalizeXmltvName = (value?: string | null) => {
    if (!value) return '';
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
};

export const parseXmltvDate = (value?: string | null): Date | null => {
    if (!value) return null;
    const match = value.match(/^(\d{14})/);
    if (match) {
        const compact = match[1];
        const year = Number(compact.slice(0, 4));
        const month = Number(compact.slice(4, 6)) - 1;
        const day = Number(compact.slice(6, 8));
        const hour = Number(compact.slice(8, 10));
        const minute = Number(compact.slice(10, 12));
        const second = Number(compact.slice(12, 14));
        return new Date(year, month, day, hour, minute, second);
    }
    if (/^\d{14}$/.test(value)) {
        const year = Number(value.slice(0, 4));
        const month = Number(value.slice(4, 6)) - 1;
        const day = Number(value.slice(6, 8));
        const hour = Number(value.slice(8, 10));
        const minute = Number(value.slice(10, 12));
        const second = Number(value.slice(12, 14));
        return new Date(year, month, day, hour, minute, second);
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const parseEpgDate = (
    listing: XtreamEpgListing,
    kind: 'start' | 'end'
): Date | null => {
    const timestampKey = kind === 'start' ? 'start_timestamp' : 'stop_timestamp';
    const rawTimestamp = listing[timestampKey];
    if (typeof rawTimestamp === 'number' || /^\d+$/.test(String(rawTimestamp ?? ''))) {
        const numeric = Number(rawTimestamp);
        if (Number.isFinite(numeric)) {
            const ms = numeric > 1e12 ? numeric : numeric * 1000;
            return new Date(ms);
        }
    }
    const raw = kind === 'start' ? listing.start : listing.end;
    return parseXmltvDate(raw);
};

export const decodeEpgText = (value?: string | null) => {
    if (!value) return '';
    const trimmed = value.trim();
    if (!/^[A-Za-z0-9+/=]+$/.test(trimmed) || trimmed.length % 4 !== 0) {
        return value;
    }
    try {
        const decoded = Buffer.from(trimmed, 'base64').toString('utf8').trim();
        if (!decoded) return value;
        const nonPrintableRatio =
            decoded.replace(/[\x20-\x7E\u00A0-\u00FF]/g, '').length / decoded.length;
        return nonPrintableRatio > 0.3 ? value : decoded;
    } catch {
        return value;
    }
};

export const resolveXmltvChannelId = (
    stream: XtreamStream,
    channelIdByName: Record<string, string>
) => {
    if (stream.epg_channel_id) return stream.epg_channel_id;
    if (stream.epg_id) return stream.epg_id;
    const normalized = normalizeXmltvName(stream.name);
    return channelIdByName[normalized] ?? String(stream.stream_id);
};
