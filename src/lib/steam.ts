export interface SteamProfile {
    steamId: string;
    personaName: string;
    profileUrl: string;
    avatarUrl?: string;
    visibilityState?: number;
    gameCount?: number;
    topGames: Array<{ name: string; minutes: number }>;
    lastLogoff?: number;
}

interface SteamPlayerSummary {
    steamid: string;
    personaname: string;
    profileurl: string;
    avatarfull?: string;
    communityvisibilitystate?: number;
    lastlogoff?: number;
}

export function parseSteamLookupInput(input: string): { type: "steamid" | "vanity"; value: string } {
    const trimmed = input.trim();
    const urlMatch = trimmed.match(/steamcommunity\.com\/(id|profiles)\/([^/?#]+)/i);
    if (urlMatch) {
        return {
            type: urlMatch[1].toLowerCase() === "profiles" ? "steamid" : "vanity",
            value: decodeURIComponent(urlMatch[2]),
        };
    }

    if (/^\d{17}$/.test(trimmed)) {
        return { type: "steamid", value: trimmed };
    }

    return { type: "vanity", value: trimmed.replace(/^@/, "") };
}

export async function lookupSteamProfile(input: string, apiKey = process.env.STEAM_API_KEY): Promise<SteamProfile> {
    if (!apiKey?.trim()) {
        throw new Error("STEAM_API_KEY is not configured.");
    }

    const parsed = parseSteamLookupInput(input);
    const steamId = parsed.type === "steamid"
        ? parsed.value
        : await resolveVanityUrl(parsed.value, apiKey);

    const [summary, ownedGames] = await Promise.all([
        fetchPlayerSummary(steamId, apiKey),
        fetchOwnedGames(steamId, apiKey),
    ]);

    return {
        steamId,
        personaName: summary.personaname,
        profileUrl: summary.profileurl,
        avatarUrl: summary.avatarfull,
        visibilityState: summary.communityvisibilitystate,
        lastLogoff: summary.lastlogoff,
        gameCount: ownedGames?.game_count,
        topGames: (ownedGames?.games ?? [])
            .filter((game: any) => game.name && game.playtime_forever > 0)
            .sort((a: any, b: any) => b.playtime_forever - a.playtime_forever)
            .slice(0, 5)
            .map((game: any) => ({ name: game.name, minutes: game.playtime_forever })),
    };
}

async function resolveVanityUrl(vanityUrl: string, apiKey: string): Promise<string> {
    const url = new URL("https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("vanityurl", vanityUrl);
    url.searchParams.set("url_type", "1");

    const data = await fetchJson(url);
    if (data.response?.success !== 1 || !data.response?.steamid) {
        throw new Error(`Could not resolve Steam vanity URL "${vanityUrl}".`);
    }

    return data.response.steamid;
}

async function fetchPlayerSummary(steamId: string, apiKey: string): Promise<SteamPlayerSummary> {
    const url = new URL("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("steamids", steamId);

    const data = await fetchJson(url);
    const player = data.response?.players?.[0];
    if (!player) {
        throw new Error(`No Steam profile found for ${steamId}.`);
    }

    return player;
}

async function fetchOwnedGames(steamId: string, apiKey: string): Promise<{ game_count?: number; games?: any[] } | null> {
    const url = new URL("https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("steamid", steamId);
    url.searchParams.set("include_appinfo", "true");
    url.searchParams.set("include_played_free_games", "true");

    const data = await fetchJson(url);
    return data.response ?? null;
}

async function fetchJson(url: URL): Promise<any> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Steam API returned HTTP ${response.status}.`);
    }

    return response.json();
}

export function formatSteamMinutes(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}
