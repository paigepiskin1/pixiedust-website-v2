// Firebase CLIENT config. These values are PUBLIC by design — Firebase web
// config ships in the browser bundle and is not a secret (security is enforced
// by Firebase Auth rules + authorized domains, not by hiding these). Sourced
// from the existing "pixie-dust-apps" project.
export const firebaseConfig = {
  apiKey: "AIzaSyDd_K8qbm6MOiTlXpFiH4OwqTnUNoKIjrA",
  authDomain: "auth.pixiedustapp.com",
  projectId: "pixie-dust-apps",
  storageBucket: "pixie-dust-apps.firebasestorage.app",
  messagingSenderId: "676166394107",
  appId: "1:676166394107:web:b1fc91abdd3c0e255d505e",
  measurementId: "G-9YKFESSF0D",
};

// Used server-side (Worker) to validate ID tokens: aud === projectId,
// iss === https://securetoken.google.com/<projectId>.
export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
