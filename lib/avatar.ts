export function buildAvatarUrl(seed: string) {
    const encoded = encodeURIComponent(seed.trim());
    return `https://api.dicebear.com/7.x/avataaars/png?seed=${encoded}&backgroundColor=0b0b0f`;
}
