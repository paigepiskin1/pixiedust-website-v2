# PixyDust iPhone app: sign-in and backend API

For the developer (or AI agent) building the PixyDust iPhone (AR) app. It covers how the app signs users in with Firebase and talks to the PixyDust backend at `https://pixydust.com`.

Nothing here is secret. The Firebase client config is public by design: it ships inside every app and web page. **Never put any server credential in the app.** That means no Firebase service account, no SyncNode, Stripe, Mailgun, Bunny or Cloudflare keys, and no admin token. The app only ever sends the signed-in user's own Firebase ID token.

## 1. Firebase

The app uses the same Firebase project as the website, so one account works on both.

| | |
| --- | --- |
| Firebase project ID | `pixie-dust-apps` |
| Auth domain (web) | `auth.pixydust.com` |
| Messaging sender ID | `676166394107` |

**iOS configuration file.** In the [Firebase console](https://console.firebase.google.com/project/pixie-dust-apps/settings/general), go to Project settings → Your apps:

- If an iOS app with your bundle ID is already listed (the earlier PixieDust Creator Studio iOS app was in this project), download its `GoogleService-Info.plist`.
- Otherwise click **Add app → iOS**, enter the app's bundle ID, and download the `GoogleService-Info.plist` it creates.

Add the plist to the Xcode project and call `FirebaseApp.configure()` at launch. Use the Firebase iOS SDK (`FirebaseAuth`) through Swift Package Manager.

**Sign-in methods.** The website offers Google and email/password. App Store guideline 4.8 requires **Sign in with Apple** in any app that offers Google sign-in. Enable the Apple provider in Firebase → Authentication → Sign-in method; this needs an Apple Developer Services ID and key. For Google sign-in, add the `REVERSED_CLIENT_ID` from the plist as a URL scheme.

For reference only, the website's public web config is below. The iOS app uses its plist, not this.

```
apiKey: "AIzaSyDd_K8qbm6MOiTlXpFiH4OwqTnUNoKIjrA"
authDomain: "auth.pixydust.com"
projectId: "pixie-dust-apps"
storageBucket: "pixie-dust-apps.firebasestorage.app"
messagingSenderId: "676166394107"
```

## 2. How sign-in works

1. The user signs in with Firebase in the app (Apple, Google or email/password).
2. The app gets a Firebase **ID token**: `try await Auth.auth().currentUser?.getIDToken()`.
3. The app calls `POST /api/app/v1/session` with `Authorization: Bearer <ID token>`. The first call creates the PixyDust account and records it as an iPhone app signup. Later calls record app use.
4. Every later API call sends the same header. The Firebase SDK refreshes the ID token every hour; always call `getIDToken()` right before a request rather than storing the token.

There are no cookies and no PixyDust session token. The Firebase ID token is the only credential.

```swift
func pixydust(_ path: String, method: String = "GET", body: [String: Any]? = nil) async throws -> (Int, [String: Any]) {
    guard let user = Auth.auth().currentUser else { throw URLError(.userAuthenticationRequired) }
    let token = try await user.getIDToken()
    var req = URLRequest(url: URL(string: "https://pixydust.com" + path)!)
    req.httpMethod = method
    req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    if let body { req.httpBody = try JSONSerialization.data(withJSONObject: body) }
    let (data, resp) = try await URLSession.shared.data(for: req)
    let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
    return ((resp as? HTTPURLResponse)?.statusCode ?? 0, json)
}

// After every successful Firebase sign-in:
let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?"
let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "?"
let (status, json) = try await pixydust("/api/app/v1/session", method: "POST", body: ["appVersion": "\(version) (\(build))"])
```

## 3. Endpoints

All responses are JSON. Errors look like `{ "error": "Human-readable message", "code": "machine_code" }`. Show `error` to the user and branch on `code`.

### `POST /api/app/v1/session`: register or sign in

Call it after every Firebase sign-in.

```
Authorization: Bearer <Firebase ID token>
Content-Type: application/json

{ "appVersion": "1.0.0 (12)", "referralCode": "optional invite code" }
```

`200`:

```json
{
  "user": { "uid": "…", "email": "…", "name": "…", "username": null, "avatarUrl": "…", "credits": 5, "isAdmin": false, "isAdult": false },
  "plan": { "id": "free", "name": "Free" },
  "isNew": true
}
```

`isNew: true` means the account was created just now. New accounts get the standard 5 free credits and the welcome email.

| Status | `code` | What to do |
| --- | --- | --- |
| 401 | `missing_token` / `invalid_token` | Get a fresh ID token (`getIDToken(forcingRefresh: true)`) and retry once; if it fails again, sign the user out. |
| 403 | `email_not_verified` | New email/password account. See [Email verification](#email-verification). |
| 403 | `account_deleted` / `account_disabled` | Sign out and show the message. |
| 429 | `rate_limited` | Wait a minute. |

### `GET /api/app/v1/me`: current user

Returns the same `user` and `plan` as above. Use it to refresh the credit balance.

| Status | `code` | Meaning |
| --- | --- | --- |
| 401 | `invalid_token` | Refresh the ID token. |
| 404 | `not_registered` | Call `POST /api/app/v1/session` first. |
| 403 | `account_disabled` / `account_deleted` | Sign out. |

### `DELETE /api/app/v1/account`: delete the account

Apple requires apps that create accounts to let users delete them in the app (guideline 5.1.1(v)). The deletion is permanent: the account, credits, generations and the Firebase login are removed, and the user can't sign in with it again.

The ID token must come from a sign-in in the **last 5 minutes**:

1. Ask the user to confirm.
2. Re-authenticate: `user.reauthenticate(with: credential)` for Apple, Google or password.
3. Call `DELETE /api/app/v1/account` with a fresh `getIDToken(forcingRefresh: true)`.
4. On `200 { "ok": true, "deleted": true }`, sign out locally. The server has already deleted the Firebase user; if you also call `user.delete()`, a "user not found" error is expected and fine.

| Status | `code` | Meaning |
| --- | --- | --- |
| 401 | `reauth_required` | The sign-in is older than 5 minutes. Re-authenticate, then retry. |
| 409 | `active_subscription` | The user has a paid subscription from the website. They must cancel it at pixydust.com/credits first. |
| 403 | `admin_account` | Admin accounts can't be deleted from the app. |

### Email verification

New **email/password** accounts must verify their email before `POST /api/app/v1/session` succeeds. Apple and Google sign-ins don't need this. Use either option:

- **Recommended: the PixyDust email.** `POST https://pixydust.com/api/auth/send-verification` with body `{ "idToken": "<Firebase ID token>" }`. The user gets a branded email and taps the link, which opens pixydust.com. Then the app calls `POST /api/app/v1/session` again. At most one email is sent per minute.
- **Or Firebase's own email.** Call `user.sendEmailVerification()`. Once the user has verified, call `user.reload()` and `getIDToken(forcingRefresh: true)`, then retry the session call.

### The other PixyDust APIs

The website's API routes accept the same `Authorization: Bearer <ID token>` header as a signed-in user. For example:

- `POST /api/generate`: start a generation, body `{ templateId, inputs, quality?, quantity?, aspect?, duration? }`
- `GET /api/generate/status?id=…`: poll it
- `POST /api/upload`: multipart `file` (images and videos)

These were built for the website and aren't versioned for the app yet. If the app depends on one, ask for a `/api/app/v1/` version so it can't change underneath the app. Admin routes (`/api/admin/*`) never accept app tokens.

## 4. How app users are tracked

The app doesn't need to do anything beyond calling `POST /api/app/v1/session`:

- Accounts created through the app get `signup_source = "pixydust_ar_app"` and `signup_platform = "ios"`.
- Website accounts keep their original source and also get `app_first_seen_at`, `app_last_seen_at` and `app_version` once they use the app.
- Admin → Users shows an "AR app signup" or "uses AR app" badge, with a filter for app users.

## 5. Testing

With a real ID token from a test build:

```bash
curl -s -X POST https://pixydust.com/api/app/v1/session -H "Authorization: Bearer $ID_TOKEN" -H "Content-Type: application/json" -d '{"appVersion":"dev"}'
curl -s https://pixydust.com/api/app/v1/me -H "Authorization: Bearer $ID_TOKEN"
```

Create a dedicated test account in the app for this. Don't use a real customer's account.
