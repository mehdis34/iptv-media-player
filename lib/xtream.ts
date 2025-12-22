import type { XtreamCategory, XtreamCredentials, XtreamStream } from './types';

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

export async function fetchLiveCategories(creds: XtreamCredentials) {
  const url = buildApiUrl(creds, { action: 'get_live_categories' });
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Impossible de charger les catégories live.");
  }
  return (await res.json()) as XtreamCategory[];
}

export async function fetchLiveStreams(creds: XtreamCredentials) {
  const url = buildApiUrl(creds, { action: 'get_live_streams' });
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Impossible de charger les chaînes.");
  }
  return (await res.json()) as XtreamStream[];
}
