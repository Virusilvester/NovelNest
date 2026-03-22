import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import type { AuthenticationResult, Tracker } from "../types";

const apiEndpoint = "https://graphql.anilist.co";

const redirectUri = Linking.createURL("tracker/anilist");

const getClientId = () =>
  String(
    (Constants.expoConfig as any)?.extra?.tracking?.anilistClientId ||
      (Constants as any)?.manifest?.extra?.tracking?.anilistClientId ||
      "",
  ).trim();

const authUrlFor = (clientId: string) =>
  `https://anilist.co/api/v2/oauth/authorize?client_id=${encodeURIComponent(
    clientId,
  )}&response_type=token`;

const searchQuery = `query($search: String) {
  Page {
    media(search: $search, type: MANGA, format: NOVEL, sort: POPULARITY_DESC) {
      id
      chapters
      title { userPreferred }
      coverImage { extraLarge }
    }
  }
}`;

const viewerQuery = `{ Viewer { id mediaListOptions { scoreFormat } } }`;

const getListEntryQuery = `query($userId: Int!, $mediaId: Int!) {
  MediaList(userId: $userId, mediaId: $mediaId) {
    id
    status
    progress
    score
    media { chapters }
  }
}`;

const updateListEntryMutation = `mutation($id: Int!, $status: MediaListStatus, $progress: Int, $score: Float) {
  SaveMediaListEntry(mediaId: $id, status: $status, progress: $progress, score: $score) {
    id
    status
    progress
    score
  }
}`;

const parseFragmentParams = (url: string): Record<string, string> => {
  const idx = url.indexOf("#");
  if (idx === -1) return {};
  const fragment = url.slice(idx + 1);
  const out: Record<string, string> = {};
  fragment.split("&").forEach((pair) => {
    const [k, v] = pair.split("=");
    if (!k) return;
    out[k] = decodeURIComponent(v || "");
  });
  return out;
};

async function queryAniList(
  query: string,
  variables: any,
  auth: Pick<AuthenticationResult, "accessToken">,
) {
  const res = await fetch(apiEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json?.errors) {
    const msg =
      json?.errors?.[0]?.message ||
      `AniList request failed (HTTP ${res.status})`;
    throw new Error(msg);
  }
  return json;
}

export const aniListTracker: Tracker<{ userId: number; scoreFormat: string }> = {
  id: "anilist",
  name: "AniList",
  authenticate: async () => {
    const clientId = getClientId();
    if (!clientId) {
      throw new Error(
        "Missing AniList client ID. Configure expo.extra.tracking.anilistClientId in app.json.",
      );
    }

    const result = await WebBrowser.openAuthSessionAsync(
      authUrlFor(clientId),
      redirectUri,
    );
    if (result.type !== "success" || !result.url) {
      throw new Error("Failed to authenticate with AniList.");
    }

    const params = parseFragmentParams(result.url);
    const accessToken = params.access_token;
    if (!accessToken) throw new Error("Failed to extract AniList access token.");

    // expires_at is sometimes provided as a unix timestamp in seconds (LNReader-style)
    const expiresAt =
      params.expires_at && String(params.expires_at).trim()
        ? new Date(Number(params.expires_at) * 1000).toISOString()
        : undefined;

    const { data } = await queryAniList(viewerQuery, {}, { accessToken });

    return {
      accessToken,
      refreshToken: undefined,
      expiresAt,
      meta: {
        userId: data.Viewer.id,
        scoreFormat: data.Viewer.mediaListOptions?.scoreFormat || "POINT_10",
      },
    };
  },
  revalidate: undefined,
  handleSearch: async (search, auth) => {
    const { data } = await queryAniList(searchQuery, { search }, auth);
    const media = data?.Page?.media || [];
    return media.map((m: any) => ({
      id: String(m.id),
      title: String(m.title?.userPreferred || ""),
      coverImage: m.coverImage?.extraLarge || undefined,
      totalChapters: m.chapters ?? null,
    }));
  },
  getUserListEntry: async (id, auth) => {
    const userId = auth.meta?.userId;
    if (!userId) throw new Error("AniList userId missing. Re-authenticate.");
    const { data } = await queryAniList(
      getListEntryQuery,
      { userId, mediaId: Number(id) },
      auth,
    );
    const entry = data?.MediaList;
    return {
      status: entry?.status || "CURRENT",
      progress: entry?.progress || 0,
      score: entry?.score || 0,
      totalChapters: entry?.media?.chapters ?? null,
    };
  },
  updateUserListEntry: async (id, payload, auth) => {
    const { data } = await queryAniList(
      updateListEntryMutation,
      {
        id: Number(id),
        status: payload.status,
        progress:
          payload.progress === undefined || payload.progress === null
            ? undefined
            : Math.round(payload.progress || 0),
        score: payload.score,
      },
      auth,
    );
    const saved = data?.SaveMediaListEntry;
    return {
      status: saved?.status || "CURRENT",
      progress: saved?.progress || 0,
      score: saved?.score || 0,
    };
  },
};

