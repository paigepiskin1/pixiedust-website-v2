// CLIENT-ONLY Firebase auth helpers. Do not import from server code
// (server token verification lives in firebase-verify.ts, no SDK needed).
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signInWithCredential,
  getRedirectResult,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";
import { firebaseConfig } from "./firebase-config";

let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;

export function getFirebaseAuth(): Auth {
  if (!app) app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
  if (!authInstance) authInstance = getAuth(app);
  return authInstance;
}

/** Exchange a freshly signed-in Firebase user for a server session cookie. */
export async function establishSession(user: User): Promise<void> {
  const idToken = await user.getIdToken(/* forceRefresh */ true);
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; needVerify?: boolean };
    const err = new Error(data.error || "Could not start session") as Error & { needVerify?: boolean };
    err.needVerify = !!data.needVerify;
    throw err;
  }
}

/** Send our OWN branded verification email (Mailgun) via the server, using the
 * user's Firebase ID token. Replaces Firebase's default verification email so
 * the message comes from our domain. */
export async function sendVerification(user: User): Promise<void> {
  try {
    const idToken = await user.getIdToken();
    await fetch("/api/auth/send-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
  } catch {
    /* best-effort */
  }
}

export async function signUpWithEmail(email: string, password: string, name?: string): Promise<User> {
  const auth = getFirebaseAuth();
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (name) await updateProfile(cred.user, { displayName: name });
  await sendVerification(cred.user);
  return cred.user;
}

export async function signInWithEmailPassword(email: string, password: string): Promise<User> {
  const auth = getFirebaseAuth();
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

// ── Google sign-in ───────────────────────────────────────────────────────────
// Firebase's own popup/redirect helpers both round-trip through the authDomain
// origin, whose storage/messaging mobile browsers partition or block — users
// bounced back to the login page signed out. So Google uses a DIRECT OAuth
// redirect instead: out to accounts.google.com and straight back to our own
// origin (the site root is a registered redirect URI), then the returned
// id_token signs into Firebase via signInWithCredential — no popup, no
// second origin, works on every browser. (This web client id is public by
// design; it appears in every OAuth URL.)
const GOOGLE_WEB_CLIENT_ID = "676166394107-rnfdthjdkfgljfh9i67mt9ogianlonnv.apps.googleusercontent.com";
const G_STATE_KEY = "pd_g_state";
const G_NONCE_KEY = "pd_g_nonce";
const G_DEST_KEY = "pd_g_dest";

function randomToken(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Kick off the full-page Google sign-in. Navigates away; the sign-in page
 * finishes it via completeGoogleRedirect() when Google sends the user back. */
export function startGoogleSignIn(dest: string): void {
  const state = "pdg1." + randomToken();
  const nonce = randomToken();
  sessionStorage.setItem(G_STATE_KEY, state);
  sessionStorage.setItem(G_NONCE_KEY, nonce);
  sessionStorage.setItem(G_DEST_KEY, dest);
  // The registered redirect URI is the bare production origin. pixydust.com is
  // the new primary; pixiedustapp.com is kept for the transition. On any other
  // host (previews, local) fall back to that host's origin — OAuth there is
  // unregistered anyway, and prod is what matters.
  // NOTE: https://pixydust.com must be an authorized redirect URI on the Google
  // OAuth client (and pixydust.com an authorized domain in Firebase) for sign-in
  // to work on the new domain.
  const redirectUri = location.hostname.endsWith("pixydust.com")
    ? "https://pixydust.com"
    : location.hostname.endsWith("pixiedustapp.com")
      ? "https://pixiedustapp.com"
      : location.origin;
  const q = new URLSearchParams({
    client_id: GOOGLE_WEB_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "id_token",
    scope: "openid email profile",
    state,
    nonce,
    prompt: "select_account",
  });
  location.assign("https://accounts.google.com/o/oauth2/v2/auth?" + q.toString());
}

/** Complete a Google sign-in round-trip. The site root forwards Google's
 * response fragment to the sign-in page; this parses + validates it and signs
 * into Firebase. Returns null when the URL carries no Google response. */
export async function completeGoogleRedirect(): Promise<{ user: User; dest: string } | null> {
  const h = location.hash.startsWith("#") ? location.hash.slice(1) : "";
  if (!h.includes("id_token=") || !h.includes("state=pdg1.")) return null;
  const frag = new URLSearchParams(h);
  const idToken = frag.get("id_token") || "";
  const state = frag.get("state") || "";
  // Scrub the credential from the URL/history immediately.
  history.replaceState(null, "", location.pathname + location.search);
  const wantState = sessionStorage.getItem(G_STATE_KEY);
  const wantNonce = sessionStorage.getItem(G_NONCE_KEY);
  const dest = sessionStorage.getItem(G_DEST_KEY) || "/";
  sessionStorage.removeItem(G_STATE_KEY);
  sessionStorage.removeItem(G_NONCE_KEY);
  sessionStorage.removeItem(G_DEST_KEY);
  const stale = new Error("That sign-in attempt expired — tap Continue with Google again.");
  if (!idToken || !wantState || state !== wantState) throw stale;
  try {
    const payload = JSON.parse(atob(idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.nonce !== wantNonce) throw stale;
  } catch {
    throw stale;
  }
  const res = await signInWithCredential(getFirebaseAuth(), GoogleAuthProvider.credential(idToken));
  return { user: res.user, dest };
}

export async function signInWithGoogle(dest: string): Promise<User | null> {
  startGoogleSignIn(dest);
  return null; // page is navigating away
}

// ── Apple sign-in ────────────────────────────────────────────────────────────
export async function signInWithApple(): Promise<User | null> {
  const auth = getFirebaseAuth();
  const provider = new OAuthProvider("apple.com");
  provider.addScope("email");
  provider.addScope("name");
  try {
    const cred = await signInWithPopup(auth, provider);
    return cred.user;
  } catch (err) {
    const code = (err as { code?: string })?.code || "";
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
      await signInWithRedirect(auth, provider);
      return null; // completed by completeRedirectSignIn() on return
    }
    throw err;
  }
}

/** On page load, resolve a pending redirect-based OAuth sign-in (Apple path).
 * Returns the user if we just came back from one, or null otherwise. */
export async function completeRedirectSignIn(): Promise<User | null> {
  const res = await getRedirectResult(getFirebaseAuth());
  return res?.user ?? null;
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseAuth(), email);
}

export async function firebaseSignOut(): Promise<void> {
  await signOut(getFirebaseAuth()).catch(() => {});
}

/** Map Firebase error codes to friendly messages for the auth form. */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code || "";
  switch (code) {
    case "auth/invalid-email": return "That email doesn't look right.";
    case "auth/email-already-in-use": return "An account already exists for that email — try signing in.";
    case "auth/weak-password": return "Use at least 6 characters for your password.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found": return "Email or password is incorrect.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request": return "Sign-in was cancelled.";
    case "auth/popup-blocked": return "Your browser blocked the sign-in popup — try again and we'll redirect you instead.";
    case "auth/unauthorized-domain": return "This site isn't authorized for social sign-in yet. Contact support.";
    case "auth/operation-not-allowed": return "That sign-in method isn't enabled yet.";
    case "auth/too-many-requests": return "Too many attempts — try again in a bit.";
    default: return (err as Error)?.message || "Something went wrong. Try again.";
  }
}
