/** The shared account form is independent of where the account session lives. */
export interface AccountSettings {
  user: { email: string | null; metadata?: { creationTime?: string; lastSignInTime?: string } } | null
  displayName: string | null
  photoURL: string | null
  hasPassword: boolean
  updateDisplayName(name: string): Promise<void>
  updateUserEmail(email: string, currentPassword?: string): Promise<void>
  updateUserPassword(password: string, currentPassword: string): Promise<void>
  resetPassword(email: string): Promise<void>
  deleteAccount(currentPassword?: string): Promise<void>
}
