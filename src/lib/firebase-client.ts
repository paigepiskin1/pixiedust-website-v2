// CLIENT-ONLY Firebase auth helpers. Do not import from server code
// (server token verification lives in firebase-verify.ts, no SDK needed).
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithRedirect,
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

/** Mobile browsers block or badly handle auth popups, so we use the redirect
 * flow there and popups on desktop. Redirect navigates away and the result is
 * picked up by completeRedirectSignIn() when the page reloads. */
function prefersRedirect(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|Opera Mini|Windows Phone/i.test(navigator.userAgent);
}

async function oauthSignIn(provider: GoogleAuthProvider | OAuthProvider): Promise<User | null> {
  const auth = getFirebaseAuth();
  if (prefersRedirect()) {
    await signInWithRedirect(auth, provider);
    return null; // page is navigating away; result handled on return
  }
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

/** Returns the signed-in user, or null when the redirect flow kicked in (the
 * page will navigate away and completeRedirectSignIn() finishes it on return). */
export async function signInWithGoogle(): Promise<User | null> {
  return oauthSignIn(new GoogleAuthProvider());
}

export async function signInWithApple(): Promise<User | null> {
  const provider = new OAuthProvider("apple.com");
  provider.addScope("email");
  provider.addScope("name");
  return oauthSignIn(provider);
}

/** On page load, resolve a pending redirect-based OAuth sign-in. Returns the
 * user if we just came back from one, or null otherwise. */
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
