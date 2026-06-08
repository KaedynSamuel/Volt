export type AppRole = "creator" | "business_owner" | "admin" | "employee"

export type AppDashboardMembership = {
  userId: number
  companyId: number
  fullName: string
  email: string
  role: AppRole
  status: string
  company: {
    id: number
    name: string
    dashboardName: string
    logoUrl: string | null
    primaryColor: string
    accentColor: string
    ownerName?: string
    ownerEmail?: string
  }
}

export type AppSession = {
  userId: number
  companyId: number
  fullName: string
  email: string
  role: AppRole
  dashboards?: AppDashboardMembership[]
}

export const SESSION_STORAGE_KEY = "volt_session"

export function getStoredSession(): AppSession | null {
  if (typeof window === "undefined") return null

  try {
    const value = window.localStorage.getItem(SESSION_STORAGE_KEY)
    return value ? (JSON.parse(value) as AppSession) : null
  } catch {
    return null
  }
}

export function storeSession(session: AppSession) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
}

export function updateStoredSession(values: Partial<AppSession>) {
  const current = getStoredSession()
  if (!current) return

  storeSession({
    ...current,
    ...values,
  })
}

export function clearSession() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(SESSION_STORAGE_KEY)
}

export function getActiveRole() {
  return getStoredSession()?.role || null
}

/**
 * General admin-like access.
 * Use this for things that business owners are allowed to see.
 */
export function isAdminLike(role?: string | null) {
  return role === "creator" || role === "business_owner" || role === "admin"
}

/**
 * Team page access.
 * This is strict because you said only admins must see the Team page.
 */
export function canAccessTeamPage(role?: string | null) {
  return role === "creator" || role === "business_owner" || role === "admin"
}