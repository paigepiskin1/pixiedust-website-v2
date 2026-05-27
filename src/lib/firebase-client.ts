// CLIENT-ONLY Firebase auth helpers. Do not import from server code
// (server token verification lives in firebase-verify.ts, no SDK needed).
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
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
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Could not start session");
  }
}

export async function signUpWithEmail(email: string, password: string, name?: string): Promise<User> {
  const auth = getFirebaseAuth();
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (name) await updateProfile(cred.user, { displayName: name });
  await sendEmailVerification(cred.user).catch(() => {});
  return cred.user;
}

export async function signInWithEmailPassword(email: string, password: string): Promise<User> {
  const auth = getFirebaseAuth();
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function signInWithGoogle(): Promise<User> {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

export async function signInWithApple(): Promise<User> {
  const auth = getFirebaseAuth();
  const provider = new OAuthProvider("apple.com");
  provider.addScope("email");
  provider.addScope("name");
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
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
    case "auth/popup-closed-by-user": return "Sign-in was cancelled.";
    case "auth/operation-not-allowed": return "That sign-in method isn't enabled yet.";
    case "auth/too-many-requests": return "Too many attempts — try again in a bit.";
    default: return (err as Error)?.message || "Something went wrong. Try again.";
  }
}
