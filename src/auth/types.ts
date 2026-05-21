export interface LoginFormValues {
  email: string;
  password: string;
}

export interface RegisterFormValues {
  firstName: string;
  lastName: string;
  username: string;
  avatarUrl: string;
  email: string;
  password: string;
}

export interface GoogleAuthProfile {
  email: string;
  displayName: string;
  avatarUrl: string;
  firestoreId: string;
  provider: "google";
}

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  firestoreId?: string;
  avatarUrl?: string;
  provider: "password" | "google";
  createdAt: string;
}

export interface AuthSession {
  token: string;
  refreshToken: string;
  user: AuthUser;
}

export interface AuthBootstrapState {
  session: AuthSession | null;
  pendingGoogleProfile: GoogleAuthProfile | null;
}

export type AuthScreen = "login" | "register" | "username-selection" | "dashboard";