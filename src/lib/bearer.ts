// Bearer sign-in for the PixyDust iPhone app. The app sends its Firebase ID
// token as `Authorization: Bearer <token>`; Firebase refreshes it hourly, so
// the app keeps no session of ours. A bearer token isn't sent automatically
// by a browser, so this path carries no CSRF risk.
import { verifyIdToken, type FirebaseClaims } from "./firebase-verify";

/** The raw token, if the header holds something shaped like a JWT. Other
 *  bearer values (the admin API token) are left for their own checks. */
export function bearerJwt(request: Request): string | null {
  const m = /^Bearer\s+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(request.headers.get("authorization") || "");
  return m ? m[1] : null;
}

/** Verified claims from the Authorization header, or null when there is no
 *  JWT there or it fails verification. */
export async function bearerClaims(request: Request): Promise<FirebaseClaims | null> {
  const token = bearerJwt(request);
  if (!token) return null;
  try {
    return await verifyIdToken(token);
  } catch {
    return null;
  }
}
