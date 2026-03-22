import type { TrackerId, UserListStatus } from "../../types";

export type AuthenticationResult<TMeta = any> = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string; // ISO
  meta?: TMeta;
};

export type TrackerSearchResult = {
  id: string;
  title: string;
  coverImage?: string;
  totalChapters?: number | null;
};

export type UserListEntry = {
  status: UserListStatus;
  progress: number;
  score: number;
  totalChapters?: number | null;
};

export type UpdateUserListPayload = Partial<{
  status: UserListStatus;
  progress: number;
  score: number;
}>;

export type Tracker<TMeta = any> = {
  id: TrackerId;
  name: string;
  authenticate: () => Promise<AuthenticationResult<TMeta>>;
  revalidate?: (auth: AuthenticationResult<TMeta>) => Promise<AuthenticationResult<TMeta>>;
  handleSearch: (
    search: string,
    auth: AuthenticationResult<TMeta>,
  ) => Promise<TrackerSearchResult[]>;
  getUserListEntry: (
    id: string,
    auth: AuthenticationResult<TMeta>,
  ) => Promise<UserListEntry>;
  updateUserListEntry: (
    id: string,
    payload: UpdateUserListPayload,
    auth: AuthenticationResult<TMeta>,
  ) => Promise<Pick<UserListEntry, "status" | "progress" | "score">>;
};

