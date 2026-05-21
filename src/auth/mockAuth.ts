import { createUserWithEmailAndPassword, signInWithPopup, signOut as firebaseSignOut, updateProfile as firebaseUpdateProfile } from "firebase/auth";
import { collection, doc, getDocs, query, setDoc, where } from "firebase/firestore";
import { getFirebaseAuth, getGoogleProvider, getFirestoreDb } from "./firebase";
import type { AuthBootstrapState, AuthSession, AuthUser, GoogleAuthProfile, LoginFormValues, ProfileFormValues, RegisterFormValues } from "./types";

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

function createToken(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function capitalize(value: string) {
  if (!value) {
    return value;
  }

  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function buildUserFromEmail(email: string, firstName?: string, lastName?: string): AuthUser {
  const normalizedEmail = email.trim().toLowerCase();
  const localPart = normalizedEmail.split("@")[0] || "usuario";
  const readableName = localPart.replace(/[._-]+/g, " ").trim();
  const nameParts = readableName ? readableName.split(/\s+/) : ["usuario"];
  const derivedFirstName = firstName?.trim() || capitalize(nameParts[0] || "usuario");
  const derivedLastName = lastName?.trim() || nameParts.slice(1).map(capitalize).join(" ");

  return {
    id: normalizedEmail,
    firstName: derivedFirstName,
    lastName: derivedLastName,
    username: normalizeUsername(localPart),
    email: normalizedEmail,
    avatarUrl: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(`${derivedFirstName} ${derivedLastName}`.trim() || normalizedEmail)}`,
    provider: "password",
    createdAt: new Date().toISOString(),
  };
}

function buildAvatarUrl(firstName: string, lastName: string, email: string, avatarUrl?: string) {
  const trimmedAvatarUrl = avatarUrl?.trim() ?? "";
  if (trimmedAvatarUrl) {
    return trimmedAvatarUrl;
  }

  const seed = `${firstName} ${lastName}`.trim() || email.trim().toLowerCase();
  return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seed)}`;
}

function buildRegisterUser(values: RegisterFormValues, id: string, firestoreId?: string): MockAccount {
  const normalizedEmail = values.email.trim().toLowerCase();
  const firstName = values.firstName.trim();
  const lastName = values.lastName.trim();

  return {
    id,
    firstName,
    lastName,
    username: normalizeUsername(values.username),
    email: normalizedEmail,
    avatarUrl: buildAvatarUrl(firstName, lastName, normalizedEmail, values.avatarUrl),
    firestoreId,
    provider: "password",
    createdAt: new Date().toISOString(),
    password: values.password,
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

function toSession(account: MockAccount): AuthSession {
  return {
    accessToken: createToken("access"),
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

function findAccountByUsername(username: string, excludedId?: string) {
  const normalized = normalizeUsername(username);
  return loadAccounts().find(
    (account) => normalizeUsername(account.username) === normalized && account.id !== excludedId,
  );
}

function findAccountByEmail(email: string, excludedId?: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return loadAccounts().find(
    (account) => account.email.trim().toLowerCase() === normalizedEmail && account.id !== excludedId,
  );
}

function getApiBaseUrl() {
  const baseUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (!baseUrl) {
    throw new AuthError("missing_api_url", "Falta configurar VITE_API_URL para conectar con el backend.");
  }

  return baseUrl.replace(/\/$/, "");
}

function getUserFirestoreId(user: AuthUser) {
  return user.firestoreId || user.id;
}

function getUserDocumentRef(user: AuthUser) {
  return doc(getFirestoreDb(), "users", getUserFirestoreId(user));
}

async function persistUserToFirestore(user: AuthUser) {
  const payload = {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl ?? null,
    provider: user.provider,
    firestoreId: user.firestoreId ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt ?? new Date().toISOString(),
  };

  await setDoc(getUserDocumentRef(user), payload, { merge: true });
}

async function syncUserProfileToFirestore(user: AuthUser, profile: ProfileFormValues) {
  const payload = {
    firstName: profile.firstName,
    lastName: profile.lastName,
    username: profile.username,
    email: profile.email,
    avatarUrl: profile.avatarUrl,
    updatedAt: new Date().toISOString(),
  };

  await setDoc(getUserDocumentRef(user), payload, { merge: true });
}

async function emailExistsInFirestore(email: string, excludedUserId?: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const snapshot = await getDocs(query(collection(getFirestoreDb(), "users"), where("email", "==", normalizedEmail)));
  return snapshot.docs.some((item) => item.id !== excludedUserId && String(item.data().email ?? "").trim().toLowerCase() === normalizedEmail);
}

async function usernameExistsInFirestore(username: string, excludedUserId?: string) {
  const normalized = normalizeUsername(username);
  const snapshot = await getDocs(query(collection(getFirestoreDb(), "users"), where("username", "==", normalized)));
  return snapshot.docs.some((item) => item.id !== excludedUserId && normalizeUsername(String(item.data().username ?? "")) === normalized);
}

export async function checkEmailAvailability(email: string, excludedUserId?: string) {
  await delay(220);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return { available: false, message: "Ingresa un correo electrónico válido." };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const taken = findAccountByEmail(normalizedEmail, excludedUserId) || (await emailExistsInFirestore(normalizedEmail, excludedUserId));
  return taken
    ? { available: false, message: "Ese correo ya existe. Prueba con otro." }
    : { available: true, message: "Correo disponible." };
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
    avatarUrl: photoURL || "",
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

  const response = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: values.email.trim().toLowerCase(),
      password: values.password,
    }),
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

  const existingAccount = findAccountByEmail(values.email);
  if (existingAccount) {
    const session = {
      accessToken,
      refreshToken: createToken("refresh"),
      user: {
        id: existingAccount.id,
        firstName: existingAccount.firstName,
        lastName: existingAccount.lastName,
        username: existingAccount.username,
        email: existingAccount.email,
        firestoreId: existingAccount.firestoreId,
        avatarUrl: existingAccount.avatarUrl,
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
    accessToken,
    refreshToken: createToken("refresh"),
    user: buildUserFromEmail(values.email),
  } satisfies AuthSession;

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
  const displayName = `${values.firstName.trim()} ${values.lastName.trim()}`.trim();

  const firebaseAuth = getFirebaseAuth();
  const firebaseResult = await createUserWithEmailAndPassword(firebaseAuth, normalizedEmail, values.password);
  await firebaseUpdateProfile(firebaseResult.user, {
    displayName,
    photoURL: buildAvatarUrl(values.firstName, values.lastName, normalizedEmail, values.avatarUrl),
  });

  const response = await fetch(`${getApiBaseUrl()}/api/users/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      name: displayName,
      username: normalizedUsername,
      avatarUrl: buildAvatarUrl(values.firstName, values.lastName, normalizedEmail, values.avatarUrl),
      email: normalizedEmail,
      password: values.password,
    }),
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

  const accessToken = extractAccessToken(body);
  if (!accessToken) {
    throw new AuthError("register_failed", "El backend no devolvió un access token válido.");
  }

  const session = {
    accessToken,
    refreshToken: createToken("refresh"),
    user: {
      id: firebaseResult.user.uid,
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      username: normalizedUsername,
      email: normalizedEmail,
      firestoreId: firebaseResult.user.uid,
      avatarUrl: buildAvatarUrl(values.firstName, values.lastName, normalizedEmail, values.avatarUrl),
      provider: "password",
      createdAt: new Date().toISOString(),
    },
  } satisfies AuthSession;

  const account = buildRegisterUser(values, firebaseResult.user.uid, firebaseResult.user.uid);
  saveAccounts([account, ...loadAccounts().filter((existing) => existing.id !== account.id)]);
  persistSession(session);
  persistPendingProfile(null);
  await persistUserToFirestore(session.user);
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

    const existingAccount = findAccountByEmail(email);
    if (existingAccount) {
      const { firstName, lastName } = splitDisplayName(profile.displayName);
      const updatedAccount: MockAccount = {
        ...existingAccount,
        firstName,
        lastName,
        avatarUrl: profile.avatarUrl,
        provider: "google",
        firestoreId: profile.firestoreId,
      };

      saveAccounts([updatedAccount, ...loadAccounts().filter((account) => account.id !== updatedAccount.id)]);
      const session = toSession(updatedAccount);
      persistSession(session);
      persistPendingProfile(null);
      return { requiresUsername: false as const, session };
    }

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

  await persistUserToFirestore(session.user);
  return session;
}

export async function updateProfile(values: ProfileFormValues) {
  requireNonEmpty(values.firstName, "Ingresa tus nombres.");
  requireNonEmpty(values.lastName, "Ingresa tus apellidos.");
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
  const currentEmail = currentUser.email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new AuthError("validation_error", "Ingresa un correo electrónico válido.");
  }

  const accounts = loadAccounts();
  const usernameChanged = normalizedUsername !== currentUsername;
  const emailChanged = normalizedEmail !== currentEmail;

  if (usernameChanged) {
    const usernameTaken = accounts.find((account) => normalizeUsername(account.username) === normalizedUsername && account.id !== currentUser.id)
      || (await usernameExistsInFirestore(normalizedUsername, currentUser.firestoreId || currentUser.id));
    if (usernameTaken) {
      throw new AuthError("username_taken", "Ese username ya existe. Prueba con otro.");
    }
  }

  if (emailChanged) {
    const emailTaken = accounts.find((account) => account.email.toLowerCase() === normalizedEmail && account.id !== currentUser.id)
      || (await emailExistsInFirestore(normalizedEmail, currentUser.firestoreId || currentUser.id));
    if (emailTaken) {
      throw new AuthError("email_taken", "Ese correo ya existe. Prueba con otro.");
    }
  }

  const updatedUser: AuthUser = {
    ...currentUser,
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    username: normalizedUsername,
    email: normalizedEmail,
    avatarUrl: values.avatarUrl.trim() || currentUser.avatarUrl,
    updatedAt: new Date().toISOString(),
  };

  const updatedAccount: MockAccount = {
    ...(accounts.find((account) => account.id === currentUser.id) ?? {
      id: currentUser.id,
      firstName: currentUser.firstName,
      lastName: currentUser.lastName,
      username: currentUser.username,
      email: currentUser.email,
      avatarUrl: currentUser.avatarUrl,
      provider: currentUser.provider,
      createdAt: currentUser.createdAt,
      firestoreId: currentUser.firestoreId,
      password: "",
    }),
    ...updatedUser,
    password: accounts.find((account) => account.id === currentUser.id)?.password ?? "",
  };

  saveAccounts([updatedAccount, ...accounts.filter((account) => account.id !== currentUser.id)]);
  updateSessionUser(updatedUser);
  await syncUserProfileToFirestore(updatedUser, values);
  return updatedUser;
}

export function signOut() {
  localStorage.removeItem(AUTH_SESSION_KEY);
  localStorage.removeItem(GOOGLE_PENDING_KEY);
  void firebaseSignOut(getFirebaseAuth()).catch(() => undefined);
}

export function cancelGoogleSignIn() {
  localStorage.removeItem(GOOGLE_PENDING_KEY);
}
