/**
 * Firebase Admin SDK initialization for server-side operations
 * Used in API routes for secure database access
 *
 * Credentials come from environment variables. NEVER commit a service account
 * key file to the repository — Google scans public repos and will disable any
 * key it finds there, which breaks every server-side Firebase call.
 *
 * Required env vars (set these in Vercel and in your local .env):
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY      (the full PEM block; \n escapes are handled)
 *
 * The project id is read from FIREBASE_PROJECT_ID, falling back to the existing
 * NEXT_PUBLIC_FIREBASE_PROJECT_ID, so it does not need to be set twice.
 *
 * Alternatively, set FIREBASE_SERVICE_ACCOUNT_KEY to the whole service account
 * JSON (raw or base64-encoded) as a single env var.
 */

import { initializeApp, getApps, cert, App, ServiceAccount } from "firebase-admin/app"
import { getFirestore, Firestore } from "firebase-admin/firestore"

let app: App | undefined
let db: Firestore | undefined

function loadServiceAccount(): ServiceAccount {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY

  if (rawJson) {
    // Accept either raw JSON or a base64-encoded blob (easier to paste into
    // dashboards that mangle multi-line values).
    const decoded = rawJson.trim().startsWith("{")
      ? rawJson
      : Buffer.from(rawJson, "base64").toString("utf8")

    let parsed: Record<string, string>
    try {
      parsed = JSON.parse(decoded)
    } catch {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is set but is not valid JSON (or valid base64-encoded JSON)")
    }

    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key?.replace(/\\n/g, "\n"),
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  // Env var values often carry literal "\n" sequences instead of real newlines.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")

  if (!projectId || !clientEmail || !privateKey) {
    const missing = [
      !projectId && "FIREBASE_PROJECT_ID (or NEXT_PUBLIC_FIREBASE_PROJECT_ID)",
      !clientEmail && "FIREBASE_CLIENT_EMAIL",
      !privateKey && "FIREBASE_PRIVATE_KEY",
    ].filter(Boolean)

    throw new Error(
      `Firebase Admin credentials are not configured. Missing: ${missing.join(", ")}. ` +
      "Set them in your environment (Vercel project settings and local .env), " +
      "or set FIREBASE_SERVICE_ACCOUNT_KEY to the full service account JSON."
    )
  }

  return { projectId, clientEmail, privateKey }
}

function getFirebaseAdmin() {
  if (!app) {
    const apps = getApps()

    if (apps.length === 0) {
      const serviceAccount = loadServiceAccount()

      app = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.projectId,
      })
    } else {
      app = apps[0]
    }
  }

  if (!db) {
    db = getFirestore(app)
  }

  return { app, db }
}

export function getAdminFirestore(): Firestore {
  return getFirebaseAdmin().db
}

export { getFirebaseAdmin }
