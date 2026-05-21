import { signInWithPopup, signOut as firebaseSignOut } from "firebase/auth";
import { getFirebaseAuth, getGoogleProvider } from "./firebase";
import type { AuthBootstrapState, AuthSession, AuthUser, GoogleAuthProfile, LoginFormValues, RegisterFormValues } from "./types";

const AUTH_SESSION_KEY = "studyroom_auth_session";
const GOOGLE_PENDING_KEY = "studyroom_pending_google_profile";
const USERS_KEY = "studyroom_mock_accounts";

interface MockAccount extends AuthUser {
  password: string;
}

const SEED_ACCOUNTS: MockAccount[] = [
  {
    id: "user-demo",
    firstName: "Demo",
    lastName: "Usuario",
    username: "demo_study",
    email: "demo@studyroom.app",
    avatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=Demo%20Usuario",
    provider: "password",
    createdAt: new Date("2026-05-01T10:00:00Z").toISOString(),
    password: "Password123",
  },
  {
    id: "user-maria",
    firstName: "Maria",
    lastName: "Soto",
    username: "mariastudy",
    email: "maria@studyroom.app",
    avatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=Maria%20Soto",
    provider: "password",
    createdAt: new Date("2026-05-08T10:00:00Z").toISOString(),
    password: "Password123",
  },
  {
    id: "firebase-demo-uid",
    firstName: "Ana",
    lastName: "Rios",
    username: "anarios",
    email: "ana.rios@studyroom.app",
    avatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=Ana%20Rios",
    provider: "google",
    createdAt: new Date("2026-05-12T10:00:00Z").toISOString(),
    firestoreId: "firebase-demo-uid",
    password: "",
  },
];

export class AuthError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

function delay(ms = 600) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadAccounts(): MockAccount[] {
  const stored = readJson<MockAccount[]>(USERS_KEY);
  if (stored && stored.length > 0) {
    return stored;
  }

  writeJson(USERS_KEY, SEED_ACCOUNTS);
  return SEED_ACCOUNTS;
}

function saveAccounts(accounts: MockAccount[]) {
  writeJson(USERS_KEY, accounts);
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function splitDisplayName(displayName: string) {
  const [firstName = "", ...rest] = displayName.trim().split(/\s+/);
  return {
    firstName: firstName || "Usuario",
    lastName: rest.join(" ") || "Google",
  };
}

function displayNameFromUser(user: Pick<AuthUser, "firstName" | "lastName">) {
  return `${user.firstName} ${user.lastName}`.trim();
}

function createToken(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function toSession(account: MockAccount): AuthSession {
  return {
    token: createToken("access"),
    refreshToken: createToken("refresh"),
    user: {
      id: account.id,
      firstName: account.firstName,
      lastName: account.lastName,
      username: account.username,
      email: account.email,
      firestoreId: account.firestoreId,
      avatarUrl: account.avatarUrl,
      provider: account.provider,
      createdAt: account.createdAt,
    },
  };
}

function persistSession(session: AuthSession) {
  writeJson(AUTH_SESSION_KEY, session);
}

function persistPendingProfile(profile: GoogleAuthProfile | null) {
  if (profile) {
    writeJson(GOOGLE_PENDING_KEY, profile);
    return;
  }

  localStorage.removeItem(GOOGLE_PENDING_KEY);
}

function findAccountByEmail(email: string) {
  return loadAccounts().find((account) => account.email.toLowerCase() === email.trim().toLowerCase());
}

function findAccountByUsername(username: string, excludedId?: string) {
  const normalized = normalizeUsername(username);
  return loadAccounts().find(
    (account) => normalizeUsername(account.username) === normalized && account.id !== excludedId,
  );
}

function getApiBaseUrl() {
  const baseUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (!baseUrl) {
    throw new AuthError("missing_api_url", "Falta configurar VITE_API_URL para conectar con el backend.");
  }

  return baseUrl.replace(/\/$/, "");
}

async function readResponseBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as Record<string, unknown>;
  }

  const text = await response.text();
  return text ? { message: text } : {};
}

function buildGoogleProfile(email: string, displayName: string, photoURL: string | null, firestoreId: string): GoogleAuthProfile {
  return {
    email,
    displayName,
    avatarUrl: photoURL || `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(displayName || email)}`,
    firestoreId,
    provider: "google",
  };
}

function requireNonEmpty(value: string, message: string) {
  if (!value.trim()) {
    throw new AuthError("validation_error", message);
  }
}

export function bootstrapAuthState(): AuthBootstrapState {
  const session = readJson<AuthSession>(AUTH_SESSION_KEY);
  const pendingGoogleProfile = readJson<GoogleAuthProfile>(GOOGLE_PENDING_KEY);

  if (session) {
    return { session, pendingGoogleProfile: null };
  }

  return { session: null, pendingGoogleProfile };
}

export async function checkUsernameAvailability(username: string, excludedUserId?: string) {
  await delay(220);

  if (normalizeUsername(username).length < 3) {
    return { available: false, message: "El username debe tener al menos 3 caracteres." };
  }

  const taken = findAccountByUsername(username, excludedUserId);
  return taken
    ? { available: false, message: "Ese username ya existe. Prueba con otro." }
    : { available: true, message: "Username disponible." };
}

export async function signInWithEmail(values: LoginFormValues) {
  requireNonEmpty(values.email, "Ingresa tu correo electrónico.");
  requireNonEmpty(values.password, "Ingresa tu contraseña.");

  await delay();
  const account = findAccountByEmail(values.email);
  if (!account || account.password !== values.password) {
    throw new AuthError("invalid_credentials", "Correo o contraseña incorrectos.");
  }

  const session = toSession(account);
  persistSession(session);
  persistPendingProfile(null);
  return session;
}

export async function registerWithEmail(values: RegisterFormValues) {
  requireNonEmpty(values.firstName, "Ingresa tus nombres.");
  requireNonEmpty(values.lastName, "Ingresa tus apellidos.");
  requireNonEmpty(values.username, "El username es obligatorio.");
  requireNonEmpty(values.email, "Ingresa tu correo electrónico.");
  requireNonEmpty(values.password, "La contraseña es obligatoria.");

  if (values.password.length < 8) {
    throw new AuthError("validation_error", "La contraseña debe tener al menos 8 caracteres.");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    throw new AuthError("validation_error", "Ingresa un correo electrónico válido.");
  }

  await delay();
  const accounts = loadAccounts();

  if (findAccountByUsername(values.username)) {
    throw new AuthError("username_taken", "Ese username ya existe. Elige otro.");
  }

  if (findAccountByEmail(values.email)) {
    throw new AuthError("email_taken", "Ya existe una cuenta con ese correo.");
  }

  const nextAccount: MockAccount = {
    id: `user-${crypto.randomUUID()}`,
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    username: normalizeUsername(values.username),
    email: values.email.trim().toLowerCase(),
    avatarUrl:
      values.avatarUrl.trim() ||
      `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(
        displayNameFromUser({ firstName: values.firstName.trim(), lastName: values.lastName.trim() }),
      )}`,
    provider: "password",
    createdAt: new Date().toISOString(),
    password: values.password,
  };

  const session = toSession(nextAccount);
  saveAccounts([nextAccount, ...accounts]);
  persistSession(session);
  persistPendingProfile(null);
  return session;
}

export async function startGoogleSignIn() {
  try {
    const result = await signInWithPopup(getFirebaseAuth(), getGoogleProvider());
    const firebaseUser = result.user;
    const email = firebaseUser.email?.trim().toLowerCase();

    if (!email) {
      throw new AuthError("missing_email", "Google no devolvió un correo válido.");
    }

    const profile = buildGoogleProfile(
      email,
      firebaseUser.displayName?.trim() || splitDisplayName(email).firstName,
      firebaseUser.photoURL,
      firebaseUser.uid,
    );

    persistPendingProfile(profile);
    return { requiresUsername: true as const, profile };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }

    throw new AuthError("google_popup_failed", "No pudimos abrir el acceso con Google.");
  }
}

export async function completeGoogleUsername(username: string) {
  requireNonEmpty(username, "El username es obligatorio.");
  const pendingProfile = readJson<GoogleAuthProfile>(GOOGLE_PENDING_KEY);
  if (!pendingProfile) {
    throw new AuthError("missing_google_profile", "No hay un perfil de Google pendiente.");
  }

  const available = await checkUsernameAvailability(username);
  if (!available.available) {
    throw new AuthError("username_taken", available.message ?? "Ese username ya existe.");
  }

  const response = await fetch(`${getApiBaseUrl()}/api/users/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: pendingProfile.displayName,
      email: pendingProfile.email,
      username: normalizeUsername(username),
      firestoreid: pendingProfile.firestoreId,
    }),
  });

  if (!response.ok && response.status !== 201) {
    const body = await readResponseBody(response);
    const message = typeof body.message === "string" ? body.message : "No pudimos crear tu usuario con Google.";
    const code = response.status === 409 ? "username_taken" : "google_register_failed";
    throw new AuthError(code, message);
  }

  const body = await readResponseBody(response);
  const { firstName, lastName } = splitDisplayName(pendingProfile.displayName);

  const account: MockAccount = {
    id: (body.id as string | undefined) ?? pendingProfile.firestoreId,
    firstName,
    lastName,
    username: normalizeUsername(username),
    email: pendingProfile.email.toLowerCase(),
    avatarUrl: pendingProfile.avatarUrl,
    firestoreId: pendingProfile.firestoreId,
    provider: "google",
    createdAt: new Date().toISOString(),
    password: "",
  };

  const session = toSession(account);
  saveAccounts([account, ...loadAccounts().filter((existing) => existing.id !== account.id)]);
  persistSession(session);
  persistPendingProfile(null);
  return session;
}

export function signOut() {
  localStorage.removeItem(AUTH_SESSION_KEY);
  localStorage.removeItem(GOOGLE_PENDING_KEY);
  void firebaseSignOut(getFirebaseAuth()).catch(() => undefined);
}
