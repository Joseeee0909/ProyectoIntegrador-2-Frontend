import { signInWithCustomToken, signInWithEmailAndPassword, signInWithPopup, signOut as firebaseSignOut } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { getApiBaseUrl } from "../config/env";
import { getFirebaseAuth, getGoogleProvider, getFirestoreDb } from "./firebase";
import type { AuthBootstrapState, AuthSession, AuthUser, GoogleAuthProfile, LoginFormValues, LoginRequest, ProfileFormValues, RegisterFormValues, RegisterRequest, User } from "./types";

const AUTH_SESSION_KEY = "studyroom_auth_session";
const GOOGLE_PENDING_KEY = "studyroom_pending_google_profile";
const USERS_KEY = "studyroom_mock_accounts";

interface MockAccount extends AuthUser {
  password: string;
}

const SEED_ACCOUNTS: MockAccount[] = [
  {
    uid: "user-demo",
    id: "user-demo",
    names: "Demo",
    lastNames: "Usuario",
    username: "demo_study",
    email: "demo@studyroom.app",
    avatar: "https://api.dicebear.com/9.x/initials/svg?seed=Demo%20Usuario",
    provider: "password",
    createdAt: new Date("2026-05-01T10:00:00Z").toISOString(),
    password: "Password123",
  },
  {
    uid: "user-maria",
    id: "user-maria",
    names: "Maria",
    lastNames: "Soto",
    username: "mariastudy",
    email: "maria@studyroom.app",
    avatar: "https://api.dicebear.com/9.x/initials/svg?seed=Maria%20Soto",
    provider: "password",
    createdAt: new Date("2026-05-08T10:00:00Z").toISOString(),
    password: "Password123",
  },
  {
    uid: "firebase-demo-uid",
    id: "firebase-demo-uid",
    names: "Ana",
    lastNames: "Rios",
    username: "anarios",
    email: "ana.rios@studyroom.app",
    avatar: "https://api.dicebear.com/9.x/initials/svg?seed=Ana%20Rios",
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
  const [names = "", ...rest] = displayName.trim().split(/\s+/);
  return {
    names: names || "Usuario",
    lastNames: rest.join(" ") || "Google",
  };
}

function createToken(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function capitalize(value: string) {
  if (!value) {
    return value;
  }

  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function buildUserFromEmail(email: string, names?: string, lastNames?: string): AuthUser {
  const normalizedEmail = email.trim().toLowerCase();
  const localPart = normalizedEmail.split("@")[0] || "usuario";
  const readableName = localPart.replace(/[._-]+/g, " ").trim();
  const nameParts = readableName ? readableName.split(/\s+/) : ["usuario"];
  const derivednames = names?.trim() || capitalize(nameParts[0] || "usuario");
  const derivedLastNames = lastNames?.trim() || nameParts.slice(1).map(capitalize).join(" ");

  return {
    uid: normalizedEmail,
    id: normalizedEmail,
    names: derivednames,
    lastNames: derivedLastNames,
    username: normalizeUsername(localPart),
    email: normalizedEmail,
    avatar: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(`${derivednames} ${derivedLastNames}`.trim() || normalizedEmail)}`,
    provider: "password",
    createdAt: new Date().toISOString(),
  };
}

function buildAvatarUrl(names: string, lastNames: string, email: string, avatar?: string) {
  const trimmedavatar = avatar?.trim() ?? "";
  if (trimmedavatar) {
    return trimmedavatar;
  }

  const seed = `${names} ${lastNames}`.trim() || email.trim().toLowerCase();
  return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seed)}`;
}

function buildRegisterUser(values: RegisterFormValues, uid: string, firestoreId?: string): MockAccount {
  const normalizedEmail = values.email.trim().toLowerCase();
  const names = values.names.trim();
  const lastNames = getFormLastNames(values);

  return {
    uid,
    id: uid,
    names,
    lastNames,
    username: normalizeUsername(values.username),
    email: normalizedEmail,
    avatar: buildAvatarUrl(names, lastNames, normalizedEmail, values.avatar),
    firestoreId,
    provider: "password",
    createdAt: new Date().toISOString(),
    password: values.password,
  };
}

function buildRegisterRequest(values: RegisterFormValues): RegisterRequest {
  return {
    names: values.names.trim(),
    lastNames: getFormLastNames(values),
    username: normalizeUsername(values.username),
    avatar: buildAvatarUrl(values.names, getFormLastNames(values), values.email, values.avatar),
    email: values.email.trim().toLowerCase(),
    password: values.password,
  };
}

function getFormLastNames(values: { lastNames?: string; lastName?: string; lastnames?: string }) {
  return values.lastNames?.trim() || values.lastName?.trim() || values.lastnames?.trim() || "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBackendUser(value: unknown): value is User {
  return isRecord(value)
    && typeof value.uid === "string"
    && typeof value.names === "string"
    && typeof value.lastNames === "string"
    && typeof value.username === "string"
    && typeof value.email === "string"
    && typeof value.avatar === "string"
    && typeof value.provider === "string"
    && typeof value.createdAt === "string";
}

function extractBackendUser(body: Record<string, unknown>) {
  const data = body.data;
  const nested = body.user ?? (isRecord(data) ? data.user ?? data : undefined) ?? body.result;
  return isBackendUser(nested) ? nested : null;
}

function backendUserToAuthUser(user: User | AuthUser, firestoreId?: string): AuthUser {
  return {
    uid: user.uid,
    id: user.uid,
    names: user.names,
    lastNames: user.lastNames,
    username: user.username,
    email: user.email.trim().toLowerCase(),
    avatar: user.avatar ?? "",
    provider: user.provider,
    createdAt: user.createdAt,
    firestoreId: firestoreId ?? ("firestoreId" in user ? user.firestoreId : undefined) ?? user.uid,
  };
}

function authUserToMockAccount(user: AuthUser, password = ""): MockAccount {
  return {
    ...user,
    password,
  };
}

function extractAccessToken(body: Record<string, unknown>) {
  const candidate = body.accessToken ?? body.access_token ?? body.token ?? body.jwt;
  return typeof candidate === "string" ? candidate.trim() : "";
}

function isJwtExpired(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return false;
  }

  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
    if (typeof payload.exp !== "number") {
      return false;
    }

    return payload.exp * 1000 <= Date.now();
  } catch {
    return false;
  }
}

export function isSessionValid(session: AuthSession | null) {
  if (!session?.accessToken) {
    return false;
  }

  return !isJwtExpired(session.accessToken);
}

function persistSession(session: AuthSession) {
  writeJson(AUTH_SESSION_KEY, session);
}

function updateSessionUser(user: AuthUser) {
  const session = readJson<AuthSession>(AUTH_SESSION_KEY);
  if (!session) {
    return;
  }

  persistSession({ ...session, user });
}

function persistPendingProfile(profile: GoogleAuthProfile | null) {
  if (profile) {
    writeJson(GOOGLE_PENDING_KEY, profile);
    return;
  }

  localStorage.removeItem(GOOGLE_PENDING_KEY);
}

function findAccountByEmail(email: string, excludedId?: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return loadAccounts().find(
    (account) => account.email.trim().toLowerCase() === normalizedEmail && account.id !== excludedId,
  );
}

const AUTH_ROUTE_CANDIDATES = {
  // Prefer the canonical routes implemented by the backend first.
  googleAuth: ["/api/auth/google"],
  completeGoogleProfile: ["/api/auth/google/complete"],
  updateProfile: ["/api/users/me"],
} as const;

async function fetchAuthenticatedBackendUser(accessToken: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/users/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const body = await readResponseBody(response);
  const backendUser = extractBackendUser(body);
  return backendUser ? backendUserToAuthUser(backendUser) : null;
}

async function fetchJsonFromCandidates(pathCandidates: readonly string[], init: RequestInit) {
  const baseUrl = getApiBaseUrl();
  let lastResponse: Response | null = null;

  for (const path of pathCandidates) {
    try {
      const response = await fetch(`${baseUrl}${path}`, init);
      lastResponse = response;

      if (response.status !== 404) {
        return response;
      }
    } catch (err) {
      // Network error or CORS; skip to next candidate instead of throwing
      // so other candidates can be tried.
      // Keep going — lastResponse remains the latest successful Response if any.
      // eslint-disable-next-line no-console
      console.warn(`fetchJsonFromCandidates: request to ${baseUrl}${path} failed:`, err);
      continue;
    }
  }

  return lastResponse;
}

async function getCurrentFirebaseIdToken() {
  const currentUser = getFirebaseAuth().currentUser;
  if (!currentUser) {
    throw new AuthError("unauthorized", "No hay una sesión activa en Firebase.");
  }

  return currentUser.getIdToken();
}

function getUserFirestoreId(user: AuthUser) {
  return user.firestoreId || user.uid;
}

function getUserDocumentRef(user: AuthUser) {
  return doc(getFirestoreDb(), "users", getUserFirestoreId(user));
}

async function persistUserToFirestore(user: AuthUser) {
  const payload = {
    uid: user.uid,
    id: user.id,
    names: user.names,
    lastNames: user.lastNames,
    username: user.username,
    email: user.email,
    avatar: user.avatar ?? null,
    provider: user.provider,
    firestoreId: user.firestoreId ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt ?? new Date().toISOString(),
  };

  await setDoc(getUserDocumentRef(user), payload, { merge: true });
}

export async function checkEmailAvailability(email: string) {
  await delay(220);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return { available: false, message: "Ingresa un correo electrónico válido." };
  }

  const normalizedEmail = email.trim().toLowerCase();
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/auth/check-email?email=${encodeURIComponent(normalizedEmail)}`);
    const body = (await readResponseBody(response)) as { available?: boolean; error?: string; message?: string };

    if (!response.ok) {
      const message = body.error || body.message || "No pudimos validar el correo.";
      return { available: false, message };
    }

    return body.available
      ? { available: true, message: "Correo disponible." }
      : { available: false, message: "Ese correo ya existe. Prueba con otro." };
  } catch {
    return { available: false, message: "No pudimos validar el correo ahora." };
  }
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
    avatar: photoURL || "",
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

  if (session && isSessionValid(session)) {
    return { session, pendingGoogleProfile: null };
  }

  if (session) {
    localStorage.removeItem(AUTH_SESSION_KEY);
  }

  return { session: null, pendingGoogleProfile };
}

export async function checkUsernameAvailability(username: string) {
  await delay(220);

  if (normalizeUsername(username).length < 3) {
    return { available: false, message: "El username debe tener al menos 3 caracteres." };
  }

  const normalizedUsername = normalizeUsername(username);

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/auth/check-username?username=${encodeURIComponent(normalizedUsername)}`);
    const body = (await readResponseBody(response)) as { available?: boolean; error?: string; message?: string };

    if (!response.ok) {
      const message = body.error || body.message || "No pudimos validar el username.";
      return { available: false, message };
    }

    return body.available
      ? { available: true, message: "Username disponible." }
      : { available: false, message: "Ese username ya existe. Prueba con otro." };
  } catch {
    return { available: false, message: "No pudimos validar el username ahora." };
  }
}

export async function signInWithEmail(values: LoginFormValues) {
  requireNonEmpty(values.email, "Ingresa tu correo electrónico.");
  requireNonEmpty(values.password, "Ingresa tu contraseña.");

  const request: LoginRequest = {
    email: values.email.trim().toLowerCase(),
    password: values.password,
  };

  const response = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  const body = await readResponseBody(response);
  if (!response.ok) {
    const message = typeof body.message === "string" ? body.message : "No pudimos iniciar sesión.";

    if (response.status === 400) {
      throw new AuthError("validation_error", message);
    }

    if (response.status === 401) {
      throw new AuthError("invalid_credentials", message);
    }

    throw new AuthError("login_failed", message);
  }

  const accessToken = extractAccessToken(body);
  if (!accessToken) {
    throw new AuthError("login_failed", "El backend no devolvió un access token válido.");
  }

  const firebaseAuth = getFirebaseAuth();
  await signInWithCustomToken(firebaseAuth, accessToken);
  const firebaseIdToken = await getCurrentFirebaseIdToken();
  const hydratedBackendUser = await fetchAuthenticatedBackendUser(firebaseIdToken).catch(() => null);

  const backendUser = hydratedBackendUser ?? extractBackendUser(body);
  if (backendUser) {
    const authUser = backendUserToAuthUser(backendUser as User | AuthUser);
    const account = authUserToMockAccount(authUser, findAccountByEmail(authUser.email)?.password ?? values.password);
    saveAccounts([account, ...loadAccounts().filter((existing) => existing.id !== account.id)]);

    const session = {
      accessToken: firebaseIdToken,
      refreshToken: createToken("refresh"),
      user: authUser,
    } satisfies AuthSession;

    persistSession(session);
    persistPendingProfile(null);
    return session;
  }

  const existingAccount = findAccountByEmail(values.email);
  if (existingAccount) {
    const session = {
      accessToken: firebaseIdToken,
      refreshToken: createToken("refresh"),
      user: {
        uid: existingAccount.uid,
        id: existingAccount.id,
        names: existingAccount.names,
        lastNames: existingAccount.lastNames,
        username: existingAccount.username,
        email: existingAccount.email,
        firestoreId: existingAccount.firestoreId,
        avatar: existingAccount.avatar,
        provider: existingAccount.provider,
        createdAt: existingAccount.createdAt,
        updatedAt: existingAccount.updatedAt,
      },
    } satisfies AuthSession;

    persistSession(session);
    persistPendingProfile(null);
    return session;
  }

  const session = {
    accessToken: firebaseIdToken,
    refreshToken: createToken("refresh"),
    user: buildUserFromEmail(values.email),
  } satisfies AuthSession;

  persistSession(session);
  persistPendingProfile(null);
  return session;
}

export async function registerWithEmail(values: RegisterFormValues) {
  requireNonEmpty(values.names, "Ingresa tus nombres.");
  requireNonEmpty(getFormLastNames(values), "Ingresa tus apellidos.");
  requireNonEmpty(values.username, "El username es obligatorio.");
  requireNonEmpty(values.email, "Ingresa tu correo electrónico.");
  requireNonEmpty(values.password, "La contraseña es obligatoria.");

  const usernameAvailability = await checkUsernameAvailability(values.username);
  if (!usernameAvailability.available) {
    throw new AuthError("username_taken", usernameAvailability.message ?? "Ese username ya existe.");
  }

  const emailAvailability = await checkEmailAvailability(values.email);
  if (!emailAvailability.available) {
    throw new AuthError("email_taken", emailAvailability.message ?? "Ese correo ya existe.");
  }

  const normalizedEmail = values.email.trim().toLowerCase();
  const normalizedUsername = normalizeUsername(values.username);
  const registerRequest = buildRegisterRequest(values);

  const response = await fetch(`${getApiBaseUrl()}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(registerRequest),
  });

  const body = await readResponseBody(response);
  if (!response.ok && response.status !== 201) {
    const message = typeof body.message === "string" ? body.message : "No pudimos completar el registro.";

    if (response.status === 400) {
      throw new AuthError("validation_error", message);
    }

    if (response.status === 409) {
      throw new AuthError("email_taken", message);
    }

    throw new AuthError("register_failed", message);
  }

  const firebaseAuth = getFirebaseAuth();
  await signInWithEmailAndPassword(firebaseAuth, normalizedEmail, values.password);
  const firebaseIdToken = await getCurrentFirebaseIdToken();
  const hydratedBackendUser = await fetchAuthenticatedBackendUser(firebaseIdToken).catch(() => null);

  const backendUser = hydratedBackendUser ?? extractBackendUser(body);
  const authUser = backendUser
    ? backendUserToAuthUser(backendUser as User | AuthUser)
    : {
        uid: normalizedEmail,
        id: normalizedEmail,
        names: values.names.trim(),
        lastNames: getFormLastNames(values),
        username: normalizedUsername,
        email: normalizedEmail,
        avatar: buildAvatarUrl(values.names, getFormLastNames(values), normalizedEmail, values.avatar),
        provider: "password" as const,
        createdAt: new Date().toISOString(),
      } satisfies AuthUser;

  const session = {
    accessToken: firebaseIdToken,
    refreshToken: createToken("refresh"),
    user: authUser,
  } satisfies AuthSession;

  const account = buildRegisterUser(values, authUser.uid, authUser.firestoreId || authUser.uid);
  saveAccounts([account, ...loadAccounts().filter((existing) => existing.id !== account.id)]);
  persistSession(session);
  persistPendingProfile(null);
  await persistUserToFirestore(session.user).catch(() => undefined);
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
      firebaseUser.displayName?.trim() || splitDisplayName(email).names,
      firebaseUser.photoURL,
      firebaseUser.uid,
    );

    const idToken = await firebaseUser.getIdToken();
    const response = await fetchJsonFromCandidates(AUTH_ROUTE_CANDIDATES.googleAuth, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ idToken }),
    });

    const body = response ? await readResponseBody(response) : {};
    if (!response || !response.ok) {
      const message = typeof body.message === "string" ? body.message : "No pudimos iniciar sesión con Google.";
      throw new AuthError(response?.status === 401 ? "invalid_token" : "google_login_failed", message);
    }

    const hydratedBackendUser = await fetchAuthenticatedBackendUser(idToken).catch(() => null);

    const requiresUsername = Boolean((body as { needsUsername?: boolean; requiresUsername?: boolean }).needsUsername ?? (body as { needsUsername?: boolean; requiresUsername?: boolean }).requiresUsername);
    if (requiresUsername) {
      const uid = typeof body.uid === "string" ? body.uid : firebaseUser.uid;
      const pendingProfile = buildGoogleProfile(
        typeof body.email === "string" && body.email ? body.email : email,
        firebaseUser.displayName?.trim() || splitDisplayName(email).names,
        firebaseUser.photoURL,
        uid,
      );
      persistPendingProfile(pendingProfile);
      return { requiresUsername: true as const, profile: pendingProfile };
    }

    const backendUser = hydratedBackendUser ?? extractBackendUser(body);
    const authUser = backendUser ? backendUserToAuthUser(backendUser as User | AuthUser, firebaseUser.uid) : {
      uid: firebaseUser.uid,
      id: firebaseUser.uid,
      names: firebaseUser.displayName?.trim() ? splitDisplayName(firebaseUser.displayName.trim()).names : splitDisplayName(email).names,
      lastNames: firebaseUser.displayName?.trim() ? splitDisplayName(firebaseUser.displayName.trim()).lastNames : splitDisplayName(email).lastNames,
      username: normalizeUsername(email.split("@")[0] || "usuario"),
      email,
      firestoreId: firebaseUser.uid,
      avatar: firebaseUser.photoURL || buildAvatarUrl(profile.displayName, "", email, profile.avatar),
      provider: "google" as const,
      createdAt: new Date().toISOString(),
    } satisfies AuthUser;

    const session = {
      accessToken: idToken,
      refreshToken: createToken("refresh"),
      user: authUser,
    } satisfies AuthSession;

    saveAccounts([authUserToMockAccount(authUser), ...loadAccounts().filter((account) => account.id !== authUser.id)]);
    persistSession(session);
    persistPendingProfile(null);
    return { requiresUsername: false as const, session };
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

  const idToken = await getCurrentFirebaseIdToken();
  const response = await fetchJsonFromCandidates(AUTH_ROUTE_CANDIDATES.completeGoogleProfile, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ username: normalizeUsername(username) }),
  });

  const body = response ? await readResponseBody(response) : {};
  if (!response || !response.ok) {
    const message = typeof body.message === "string" ? body.message : "No pudimos completar el perfil de Google.";
    throw new AuthError(response?.status === 409 ? "username_taken" : "register_failed", message);
  }

  const hydratedBackendUser = await fetchAuthenticatedBackendUser(idToken).catch(() => null);
  const backendUser = hydratedBackendUser ?? extractBackendUser(body);
  const { names, lastNames } = splitDisplayName(pendingProfile.displayName);
  const authUser = backendUser ? backendUserToAuthUser(backendUser as User | AuthUser, pendingProfile.firestoreId) : {
    uid: pendingProfile.firestoreId,
    id: pendingProfile.firestoreId,
    names,
    lastNames,
    username: normalizeUsername(username),
    email: pendingProfile.email.toLowerCase(),
    avatar: pendingProfile.avatar,
    firestoreId: pendingProfile.firestoreId,
    provider: "google" as const,
    createdAt: new Date().toISOString(),
  } satisfies AuthUser;

  const session = {
    accessToken: idToken,
    refreshToken: createToken("refresh"),
    user: authUser,
  } satisfies AuthSession;

  saveAccounts([authUserToMockAccount(authUser), ...loadAccounts().filter((existing) => existing.id !== authUser.id)]);
  persistSession(session);
  persistPendingProfile(null);
  await persistUserToFirestore(session.user).catch(() => undefined);
  return session;
}

export async function updateProfile(values: ProfileFormValues) {
  requireNonEmpty(values.names, "Ingresa tus nombres.");
  requireNonEmpty(getFormLastNames(values), "Ingresa tus apellidos.");
  requireNonEmpty(values.username, "El username es obligatorio.");
  requireNonEmpty(values.email, "Ingresa tu correo electrónico.");

  const session = readJson<AuthSession>(AUTH_SESSION_KEY);
  if (!session || !isSessionValid(session)) {
    throw new AuthError("unauthorized", "Tu sesión expiró. Vuelve a iniciar sesión.");
  }

  const currentUser = session.user;
  const normalizedUsername = normalizeUsername(values.username);
  const normalizedEmail = values.email.trim().toLowerCase();
  const currentUsername = normalizeUsername(currentUser.username);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new AuthError("validation_error", "Ingresa un correo electrónico válido.");
  }

  const accounts = loadAccounts();
  const usernameChanged = normalizedUsername !== currentUsername;
  if (usernameChanged) {
    const usernameAvailability = await checkUsernameAvailability(normalizedUsername);
    if (!usernameAvailability.available) {
      throw new AuthError("username_taken", usernameAvailability.message ?? "Ese username ya existe. Prueba con otro.");
    }
  }

  const updatedUser: AuthUser = {
    ...currentUser,
    names: values.names.trim(),
    lastNames: getFormLastNames(values),
    username: normalizedUsername,
    email: normalizedEmail,
    avatar: values.avatar.trim() || currentUser.avatar,
    updatedAt: new Date().toISOString(),
  };

  const idToken = session.accessToken || (await getCurrentFirebaseIdToken());
  const response = await fetchJsonFromCandidates(AUTH_ROUTE_CANDIDATES.updateProfile, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      names: values.names.trim(),
      lastNames: getFormLastNames(values),
      username: normalizedUsername,
      avatar: values.avatar.trim(),
    }),
  });

  const body = response ? await readResponseBody(response) : {};
  if (!response || !response.ok) {
    const message = typeof body.message === "string" ? body.message : "No pudimos actualizar tu perfil.";
    if (response?.status === 409) {
      throw new AuthError("username_taken", message);
    }
    throw new AuthError("profile_update_failed", message);
  }

  const hydratedBackendUser = await fetchAuthenticatedBackendUser(idToken).catch(() => null);
  const backendUser = hydratedBackendUser ?? extractBackendUser(body);
  const persistedUser = backendUser ? backendUserToAuthUser(backendUser as User | AuthUser, currentUser.firestoreId || currentUser.id) : updatedUser;
  const updatedAccount: MockAccount = {
    ...(accounts.find((account) => account.id === currentUser.id) ?? authUserToMockAccount(currentUser)),
    ...persistedUser,
    password: accounts.find((account) => account.id === currentUser.id)?.password ?? "",
  };

  saveAccounts([updatedAccount, ...accounts.filter((account) => account.id !== currentUser.id)]);
  updateSessionUser(persistedUser);
  return persistedUser;
}

export function signOut() {
  localStorage.removeItem(AUTH_SESSION_KEY);
  localStorage.removeItem(GOOGLE_PENDING_KEY);
  void firebaseSignOut(getFirebaseAuth()).catch(() => undefined);
}

export function cancelGoogleSignIn() {
  localStorage.removeItem(GOOGLE_PENDING_KEY);
}
