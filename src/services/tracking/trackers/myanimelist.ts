import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import type { Tracker } from "../types";
import type { UserListStatus } from "../../../types";

const baseOAuthUrl = "https://myanimelist.net/v1/oauth2/authorize";
const tokenUrl = "https://myanimelist.net/v1/oauth2/token";
const baseApiUrl = "https://api.myanimelist.net/v2";

const redirectUri = Linking.createURL("tracker/mal");

const getClientId = () =>
  String(
    (Constants.expoConfig as any)?.extra?.tracking?.myAnimeListClientId ||
      (Constants as any)?.manifest?.extra?.tracking?.myAnimeListClientId ||
      "",
  ).trim();

const pkceChallenger = () => {
  const MAX_LENGTH = 88;
  let code = "";
  const codes =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const randomPicker = () => Math.floor(Math.random() * codes.length);
  for (let index = 0; index < MAX_LENGTH; index++) {
    code += codes.charAt(randomPicker());
  }
  return code;
};

const decodePath = (path: string) => {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
};

export const malToNormalized: Record<string, UserListStatus> = {
  reading: "CURRENT",
  completed: "COMPLETED",
  on_hold: "PAUSED",
  dropped: "DROPPED",
  plan_to_read: "PLANNING",
};

const normalizedToMal: Record<UserListStatus, string> = {
  CURRENT: "reading",
  COMPLETED: "completed",
  PAUSED: "on_hold",
  DROPPED: "dropped",
  PLANNING: "plan_to_read",
  REPEATING: "reading;true",
};

const extractCodeFromUrl = (url: string): string => {
  const u = new URL(url);
  const code = u.searchParams.get("code");
  if (code) return decodePath(code);
  const m = url.match(/[?&]code=([^&]+)/);
  if (m?.[1]) return decodePath(m[1]);
  return "";
};

export const myAnimeListTracker: Tracker = {
  id: "myanimelist",
  name: "MyAnimeList",
  authenticate: async () => {
    const clientId = getClientId();
    if (!clientId) {
      throw new Error(
        "Missing MyAnimeList client ID. Configure expo.extra.tracking.myAnimeListClientId in app.json.",
      );
    }

    const challenge = pkceChallenger();
    const authUrl = `${baseOAuthUrl}?response_type=code&client_id=${encodeURIComponent(
      clientId,
    )}&code_challenge_method=plain&code_challenge=${encodeURIComponent(
      challenge,
    )}`;

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
    if (result.type !== "success" || !result.url) {
      throw new Error("Failed to authenticate with MyAnimeList.");
    }

    const code = extractCodeFromUrl(result.url);
    if (!code) throw new Error("Failed to extract authorization code.");

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: "authorization_code",
        code,
        code_verifier: challenge,
      }).toString(),
    });

    const tokenResponse = await response.json();
    if (!response.ok || !tokenResponse?.access_token) {
      throw new Error(tokenResponse?.message || "MAL token exchange failed.");
    }

    return {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString(),
    };
  },
  revalidate: async (auth) => {
    const clientId = getClientId();
    if (!clientId) throw new Error("Missing MyAnimeList client ID.");
    if (!auth.refreshToken) throw new Error("Missing MAL refresh token.");

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: auth.refreshToken,
        client_id: clientId,
      }).toString(),
    });

    const tokenResponse = await response.json();
    if (!response.ok || !tokenResponse?.access_token) {
      throw new Error(tokenResponse?.message || "MAL refresh failed.");
    }
    return {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token || auth.refreshToken,
      expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString(),
    };
  },
  handleSearch: async (search, auth) => {
    const searchUrl = `${baseApiUrl}/manga?q=${encodeURIComponent(
      search,
    )}&fields=id,title,main_picture,media_type`;
    const response = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    });
    if (response.status !== 200) return [];
    const { data } = await response.json();
    return (data || [])
      .filter((e: any) => e?.node?.media_type === "light_novel")
      .map((e: any) => ({
        id: String(e.node.id),
        title: String(e.node.title || ""),
        coverImage: e.node.main_picture?.large || undefined,
      }));
  },
  getUserListEntry: async (id, auth) => {
    const url = `${baseApiUrl}/manga/${encodeURIComponent(
      id,
    )}?fields=id,num_chapters,my_list_status{start_date,finish_date,score,num_chapters_read,status,is_rereading}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const data = await response.json();
    const rawStatus: string | undefined = data?.my_list_status?.status;
    let normalized: UserListStatus =
      (rawStatus && malToNormalized[rawStatus]) || "CURRENT";
    if (!malToNormalized[rawStatus || ""] && data?.my_list_status?.is_rereading) {
      normalized = "REPEATING";
    }
    return {
      status: normalized,
      score: data?.my_list_status?.score || 0,
      progress: data?.my_list_status?.num_chapters_read || 0,
      totalChapters: data?.num_chapters ?? null,
    };
  },
  updateUserListEntry: async (id, payload, auth) => {
    let status = payload.status ? normalizedToMal[payload.status] : normalizedToMal.CURRENT;
    let repeating = "false";
    if (status.includes(";")) {
      const split = status.split(";");
      status = split[0];
      repeating = split[1];
    }

    const url = `${baseApiUrl}/manga/${encodeURIComponent(id)}/my_list_status`;
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        status,
        is_rereading: repeating,
        num_chapters_read: "" + (payload.progress ?? 0),
        score: "" + (payload.score ?? 0),
      }).toString(),
    });

    const data = await res.json();
    let normalizedStatus = malToNormalized[data.status];
    if (!normalizedStatus && data.is_rereading) normalizedStatus = "REPEATING";
    return {
      status: normalizedStatus || "CURRENT",
      progress: data.num_chapters_read || 0,
      score: data.score || 0,
    };
  },
};

