export interface LoginFormValues {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  names: string;
  lastNames: string;
  username: string;
  avatar: string;
  email: string;
  password: string;
}

export interface User {
  uid: string;
  names: string;
  lastNames: string;
  username: string;
  email: string;
  avatar: string;
  provider: "password" | "google";
  createdAt: string;
}

export interface RegisterFormValues {
  names: string;
  lastNames: string;
  username: string;
  avatar: string;
  email: string;
  password: string;
}

export interface GoogleAuthProfile {
  email: string;
  displayName: string;
  avatar: string;
  firestoreId: string;
  provider: "google";
}

export interface AuthUser {
  uid: string;
  id: string;
  names: string;
  lastNames: string;
  username: string;
  email: string;
  firestoreId?: string;
  avatar?: string;
  provider: "password" | "google";
  createdAt: string;
  updatedAt?: string;
}

export interface ProfileFormValues {
  names: string;
  lastNames: string;
  username: string;
  email: string;
  avatar: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface AuthBootstrapState {
  session: AuthSession | null;
  pendingGoogleProfile: GoogleAuthProfile | null;
}

export type AuthScreen = "login" | "register" | "username-selection" | "dashboard";