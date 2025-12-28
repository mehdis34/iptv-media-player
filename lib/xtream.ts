import type {
  XtreamCategory,
  XtreamCredentials,
  XtreamSeries,
  XtreamStream,
  XtreamVod,
  XtreamVodInfo,
  XtreamSeriesInfo,
  XtreamEpgListing,
  XtreamAccountInfo,
} from './types';
import {XMLParser} from 'fast-xml-parser';
import {normalizeXmltvName} from './epg.utils';

function normalizeHost(host: string) {
  return host.trim().replace(/\/+$/, '');
}

function buildApiUrl(creds: XtreamCredentials, params?: Record<string, string>) {
  const base = `${normalizeHost(creds.host)}/player_api.php`;
  const query = new URLSearchParams({
    username: creds.username,
    password: creds.password,
    ...(params ?? {}),
  });
  return `${base}?${query.toString()}`;
}

export function buildStreamUrl(creds: XtreamCredentials, streamId: number) {
  const base = normalizeHost(creds.host);
  return `${base}/live/${creds.username}/${creds.password}/${streamId}.m3u8`;
}

export function buildVodUrl(
  creds: XtreamCredentials,
  streamId: number,
  extension = 'mp4'
) {
  const base = normalizeHost(creds.host);
  return `${base}/movie/${creds.username}/${creds.password}/${streamId}.${extension}`;
}

export function buildSeriesEpisodeUrl(
  creds: XtreamCredentials,
  episodeId: number,
  extension = 'mp4'
) {
  const base = normalizeHost(creds.host);
  return `${base}/series/${creds.username}/${creds.password}/${episodeId}.${extension}`;
}

export async function validateCredentials(creds: XtreamCredentials) {
  const url = buildApiUrl(creds);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Impossible de joindre le serveur Xtream.');
  }
  const data = (await res.json()) as { user_info?: { auth?: number } };
  if (!data?.user_info || data.user_info.auth !== 1) {
    throw new Error("Identifiants invalides. Vérifiez l'hôte et le mot de passe.");
  }
  return data;
}

export async function fetchAccountInfo(creds: XtreamCredentials) {
  const url = buildApiUrl(creds);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Impossible de charger les informations du compte.');
  }
  return (await res.json()) as XtreamAccountInfo;
}

export async function fetchLiveCategories(creds: XtreamCredentials) {
  const url = buildApiUrl(creds, { action: 'get_live_categories' });
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Impossible de charger les catégories live.");
  }
  return (await res.json()) as XtreamCategory[];
}

export async function fetchLiveStreams(
  creds: XtreamCredentials,
  categoryId?: string
) {
  const params: Record<string, string> = { action: 'get_live_streams' };
  if (categoryId && categoryId !== 'all') {
    params.category_id = categoryId;
  }
  const url = buildApiUrl(creds, params);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Impossible de charger les chaînes.");
  }
  return (await res.json()) as XtreamStream[];
}

export async function fetchVodCategories(creds: XtreamCredentials) {
  const url = buildApiUrl(creds, { action: 'get_vod_categories' });
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Impossible de charger les categories films.');
  }
  return (await res.json()) as XtreamCategory[];
}

export async function fetchVodStreams(creds: XtreamCredentials) {
  const url = buildApiUrl(creds, { action: 'get_vod_streams' });
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Impossible de charger les films.');
  }
  return (await res.json()) as XtreamVod[];
}

export async function fetchVodInfo(creds: XtreamCredentials, streamId: number) {
  const url = buildApiUrl(creds, {
    action: 'get_vod_info',
    vod_id: String(streamId),
  });
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Impossible de charger les détails du film.');
  }
  return (await res.json()) as XtreamVodInfo;
}

export async function fetchSeriesCategories(creds: XtreamCredentials) {
  const url = buildApiUrl(creds, { action: 'get_series_categories' });
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Impossible de charger les categories series.');
  }
  return (await res.json()) as XtreamCategory[];
}

export async function fetchSeries(creds: XtreamCredentials) {
  const url = buildApiUrl(creds, { action: 'get_series' });
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Impossible de charger les series.');
  }
  return (await res.json()) as XtreamSeries[];
}

export async function fetchSeriesInfo(creds: XtreamCredentials, seriesId: number) {
  const url = buildApiUrl(creds, {
    action: 'get_series_info',
    series_id: String(seriesId),
  });
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Impossible de charger les détails de la série.');
  }
  return (await res.json()) as XtreamSeriesInfo;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: 'text',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
});

function getXmltvText(node: unknown): string {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) {
    return getXmltvText(node[0]);
  }
  if (typeof node === 'object' && 'text' in (node as Record<string, unknown>)) {
    const text = (node as Record<string, unknown>).text;
    return getXmltvText(text);
  }
  return '';
}

export async function fetchXmltvEpg(creds: XtreamCredentials) {
  const base = normalizeHost(creds.host);
  const url = `${base}/xmltv.php?username=${creds.username}&password=${creds.password}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Impossible de charger l'EPG.");
  }
  const xml = await res.text();
  const parsed = xmlParser.parse(xml) as {
    tv?: {
      channel?: Array<{ id?: string; ['display-name']?: unknown }>;
      programme?: Array<{
        start?: string;
        stop?: string;
        channel?: string;
        title?: unknown;
        desc?: unknown;
        category?: unknown;
      }>;
    };
  };
  const channels = Array.isArray(parsed.tv?.channel)
    ? parsed.tv?.channel ?? []
    : parsed.tv?.channel
      ? [parsed.tv.channel]
      : [];
  const programs = Array.isArray(parsed.tv?.programme)
    ? parsed.tv?.programme ?? []
    : parsed.tv?.programme
      ? [parsed.tv.programme]
      : [];

  const channelNameById = new Map<string, string>();
  const channelIdByName = new Map<string, string>();
  channels.forEach((channel) => {
    if (!channel?.id) return;
    const name = getXmltvText(channel['display-name']);
    channelNameById.set(channel.id, name);
    if (name) {
      channelIdByName.set(normalizeXmltvName(name), channel.id);
    }
  });

  const listingsByChannel: Record<string, XtreamEpgListing[]> = {};
  programs.forEach((program) => {
    if (!program?.channel) return;
    const listing: XtreamEpgListing = {
      title: getXmltvText(program.title),
      description: getXmltvText(program.desc),
      category: getXmltvText(program.category),
      start: program.start,
      end: program.stop,
    };
    const channelId = program.channel;
    if (!listingsByChannel[channelId]) {
      listingsByChannel[channelId] = [];
    }
    listingsByChannel[channelId].push(listing);
  });

  return {
    listingsByChannel,
    channelIdByName: Object.fromEntries(channelIdByName),
    channelNameById: Object.fromEntries(channelNameById),
  };
}
