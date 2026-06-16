export type AppRole = "creator" | "business_owner" | "admin" | "manager" | "employee"

export type AppDashboardMembership = {
  userId: number
  companyId: number
  fullName: string
  email: string
  role: AppRole
  company: {
    id: number
    name: string
    dashboardName: string
    logoUrl: string | null
    primaryColor: string
    accentColor: string
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

const SESSION_KEY = "volt_session"

export function storeSession(session: AppSession) {
  if (typeof window === "undefined") return
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function getStoredSession(): AppSession | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearStoredSession() {
  if (typeof window === "undefined") return
  localStorage.removeItem(SESSION_KEY)
}

export const clearSession = clearStoredSession

export function isAdmin(role: AppRole | string) {
  return role === "admin" || role === "business_owner" || role === "creator"
}

export const isAdminLike = isAdmin

export function canAccessTeamPage(_role: AppRole | string) {
  return true
}

export function canAccessAdminPage(role: AppRole | string) {
  return isAdmin(role)
}

export function canAccessProjectsPage(_role: AppRole | string) {
  return true
}

export function getRoleLabel(role: AppRole | string) {
  const labels: Record<string, string> = {
    creator: "Creator",
    business_owner: "Business Owner",
    admin: "Admin",
    manager: "Manager",
    employee: "Employee",
  }
  return labels[role] || role
}
