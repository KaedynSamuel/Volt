export type UserRole = "employee" | "business-owner" | "admin"

export type VoltUser = {
  id: string
  name: string
  email?: string
  role: UserRole
  accessCode: string
  createdAt: string
}

export type VoltDashboard = {
  id: string
  name: string
  owner: string
  color: string
  createdAt: string
}

const USERS_KEY = "volt_access_users"
const CURRENT_USER_KEY = "volt_current_user_id"
const DASHBOARDS_KEY = "volt_custom_dashboards"
const CURRENT_DASHBOARD_KEY = "volt_current_dashboard_id"

export const roleLabels: Record<UserRole, string> = {
  employee: "Employee",
  "business-owner": "Business Owner",
  admin: "Admin",
}

const starterUsers: VoltUser[] = [
  {
    id: "admin-kaedyn",
    name: "Kaedyn Padayachee",
    email: "kaedyn@pkdashboards.com",
    role: "admin",
    accessCode: "VOLT-ADMIN-KAEDYN",
    createdAt: new Date().toISOString(),
  },
]

const starterDashboards: VoltDashboard[] = [
  {
    id: "personal",
    name: "My Dashboard",
    owner: "Personal workspace",
    color: "#8b5cf6",
    createdAt: new Date().toISOString(),
  },
]

function safeStorage() {
  if (typeof window === "undefined") return null
  return window.localStorage
}

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function generateAccessCode(role: UserRole) {
  const roleCode = role === "business-owner" ? "OWNER" : role.toUpperCase()
  const random = Math.random().toString(36).replace(/[^a-z0-9]/gi, "").slice(2, 8).toUpperCase()
  return `VOLT-${roleCode}-${random}`
}

export function getUsers(): VoltUser[] {
  const storage = safeStorage()
  if (!storage) return starterUsers

  const saved = storage.getItem(USERS_KEY)
  if (!saved) {
    storage.setItem(USERS_KEY, JSON.stringify(starterUsers))
    storage.setItem(CURRENT_USER_KEY, starterUsers[0].id)
    return starterUsers
  }

  try {
    const users = JSON.parse(saved) as VoltUser[]
    return users.length ? users : starterUsers
  } catch {
    storage.setItem(USERS_KEY, JSON.stringify(starterUsers))
    return starterUsers
  }
}

export function saveUsers(users: VoltUser[]) {
  const storage = safeStorage()
  if (!storage) return
  storage.setItem(USERS_KEY, JSON.stringify(users))
  window.dispatchEvent(new Event("volt-user-change"))
}

export function getCurrentUser() {
  const storage = safeStorage()
  const users = getUsers()
  const currentUserId = storage?.getItem(CURRENT_USER_KEY)

  return users.find((user) => user.id === currentUserId) || users[0]
}

export function createUserWithCode(input: {
  name: string
  email?: string
  role: UserRole
}) {
  const users = getUsers()
  const user: VoltUser = {
    id: makeId("user"),
    name: input.name.trim(),
    email: input.email?.trim() || undefined,
    role: input.role,
    accessCode: generateAccessCode(input.role),
    createdAt: new Date().toISOString(),
  }

  saveUsers([user, ...users])
  return user
}

export function joinWithAccessCode(code: string) {
  const storage = safeStorage()
  const users = getUsers()
  const cleanCode = code.trim().toUpperCase()
  const user = users.find((item) => item.accessCode.toUpperCase() === cleanCode)

  if (!user || !storage) return null

  storage.setItem(CURRENT_USER_KEY, user.id)
  window.dispatchEvent(new Event("volt-user-change"))
  return user
}

export function getDashboards(): VoltDashboard[] {
  const storage = safeStorage()
  if (!storage) return starterDashboards

  const saved = storage.getItem(DASHBOARDS_KEY)
  if (!saved) {
    storage.setItem(DASHBOARDS_KEY, JSON.stringify(starterDashboards))
    storage.setItem(CURRENT_DASHBOARD_KEY, "personal")
    return starterDashboards
  }

  try {
    const dashboards = JSON.parse(saved) as VoltDashboard[]
    return dashboards.some((dashboard) => dashboard.id === "personal")
      ? dashboards
      : [...starterDashboards, ...dashboards]
  } catch {
    storage.setItem(DASHBOARDS_KEY, JSON.stringify(starterDashboards))
    return starterDashboards
  }
}

export function createCustomDashboard(input: {
  name: string
  owner: string
  color: string
}) {
  const dashboards = getDashboards()
  const dashboard: VoltDashboard = {
    id: makeId("dashboard"),
    name: input.name.trim(),
    owner: input.owner.trim() || "Company workspace",
    color: input.color,
    createdAt: new Date().toISOString(),
  }

  const storage = safeStorage()
  storage?.setItem(DASHBOARDS_KEY, JSON.stringify([dashboard, ...dashboards]))
  window.dispatchEvent(new Event("volt-dashboard-change"))
  return dashboard
}

export function getCurrentDashboard() {
  const storage = safeStorage()
  const dashboards = getDashboards()
  const currentDashboardId = storage?.getItem(CURRENT_DASHBOARD_KEY)

  return dashboards.find((dashboard) => dashboard.id === currentDashboardId) || dashboards[0]
}

export function setCurrentDashboard(id: string) {
  const storage = safeStorage()
  if (!storage) return
  storage.setItem(CURRENT_DASHBOARD_KEY, id)
  window.dispatchEvent(new Event("volt-dashboard-change"))
}
