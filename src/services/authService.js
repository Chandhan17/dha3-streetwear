import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateEmail,
  updatePassword,
  updateProfile,
} from 'firebase/auth'
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'

export async function getUserRole(userId) {
  const normalizedUserId = String(userId || '').trim()

  if (!normalizedUserId) {
    return null
  }

  let userSnapshot

  try {
    userSnapshot = await getDoc(doc(db, 'users', normalizedUserId))
  } catch (error) {
    const isPermissionDenied = error?.code === 'permission-denied'

    if (isPermissionDenied) {
      throw new Error('Permission denied while reading user role. Deploy latest Firestore rules and ensure your users/{uid} profile exists.')
    }

    throw error
  }

  if (!userSnapshot.exists()) {
    return null
  }

  return String(userSnapshot.data()?.role || '').trim() || null
}

export async function getCurrentUserRole() {
  const user = auth.currentUser

  if (!user) {
    return null
  }

  return getUserRole(user.uid)
}

export async function signupUser({ name, email, password }) {
  const normalizedName = String(name || '').trim()
  const normalizedEmail = String(email || '').trim()
  const normalizedPassword = String(password || '')

  if (!normalizedName || !normalizedEmail || !normalizedPassword) {
    throw new Error('Name, email, and password are required.')
  }

  const credential = await createUserWithEmailAndPassword(
    auth,
    normalizedEmail,
    normalizedPassword,
  )

  if (normalizedName) {
    await updateProfile(credential.user, { displayName: normalizedName })
  }

  await setDoc(
    doc(db, 'users', credential.user.uid),
    {
      uid: credential.user.uid,
      name: normalizedName,
      email: normalizedEmail,
      role: 'user',
      createdAt: serverTimestamp(),
    },
    { merge: true },
  )

  return credential.user
}

export function loginAdmin(email, password) {
  return signInWithEmailAndPassword(auth, email, password)
}

export function logoutAdmin() {
  return signOut(auth)
}

export function getCurrentAdmin() {
  return auth.currentUser
}

export async function updateAdminProfile({ displayName, email, currentPassword = '' }) {
  const user = auth.currentUser

  if (!user) {
    throw new Error('No authenticated admin user found.')
  }

  const normalizedDisplayName = String(displayName || '').trim()
  const normalizedEmail = String(email || '').trim()

  if (normalizedDisplayName && normalizedDisplayName !== user.displayName) {
    await updateProfile(user, { displayName: normalizedDisplayName })
  }

  if (normalizedEmail && normalizedEmail !== user.email) {
    try {
      await updateEmail(user, normalizedEmail)
    } catch (error) {
      const needsRecentLogin = error?.code === 'auth/requires-recent-login'

      if (!needsRecentLogin) {
        throw error
      }

      if (!currentPassword) {
        throw new Error('Please enter your current password to update email.')
      }

      const credential = EmailAuthProvider.credential(user.email || normalizedEmail, currentPassword)
      await reauthenticateWithCredential(user, credential)
      await updateEmail(user, normalizedEmail)
    }
  }

  return user
}

export async function updateAdminPasswordSecure({ currentPassword, newPassword }) {
  const user = auth.currentUser

  if (!user) {
    throw new Error('No authenticated admin user found.')
  }

  const normalizedCurrentPassword = String(currentPassword || '').trim()
  const normalizedNewPassword = String(newPassword || '').trim()

  if (!normalizedCurrentPassword || !normalizedNewPassword) {
    throw new Error('Current and new password are required.')
  }

  if (normalizedNewPassword.length < 6) {
    throw new Error('New password must be at least 6 characters.')
  }

  const credential = EmailAuthProvider.credential(user.email || '', normalizedCurrentPassword)
  await reauthenticateWithCredential(user, credential)
  await updatePassword(user, normalizedNewPassword)
}

export async function deleteUserProfile(userId) {
  const normalizedUserId = String(userId || '').trim()

  if (!normalizedUserId) {
    return
  }

  await deleteDoc(doc(db, 'users', normalizedUserId))
}