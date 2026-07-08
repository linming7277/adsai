import { initializeApp, getApps } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut } from 'firebase/auth'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

export function ensureFirebase() {
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig as any)
  const auth = getAuth(app)
  return { app, auth }
}

export async function googleLoginAndPersistSession() {
  const { auth } = ensureFirebase()
  const provider = new GoogleAuthProvider()
  const res = await signInWithPopup(auth, provider)
  const token = await res.user.getIdToken()
  const r = await fetch('/api/auth/firebase/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) })
  if (!r.ok) throw new Error('会话写入失败')
  return res.user
}

export async function signOut() {
  const { auth } = ensureFirebase()
  await fbSignOut(auth)
  await fetch('/api/auth/firebase/session', { method: 'DELETE' })
}

