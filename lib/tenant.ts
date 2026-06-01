export type CompanySettings = {
  id: number
  name: string
  dashboardName: string
  logoUrl: string | null
  primaryColor: string
  accentColor: string
  ownerName?: string
  ownerEmail?: string
}

export const COMPANY_ID_STORAGE_KEY = "volt_company_id"
export const COMPANY_STORAGE_KEY = "volt_company"

export const VOLT_THEME = {
  primaryColor: "#22c55e",
  accentColor: "#8b5cf6",
}

export function applyVoltTheme() {
  if (typeof document === "undefined") return
  const root = document.documentElement
  root.style.setProperty("--primary", VOLT_THEME.primaryColor)
  root.style.setProperty("--sidebar-primary", VOLT_THEME.primaryColor)
  root.style.setProperty("--ring", VOLT_THEME.primaryColor)
  root.style.setProperty("--chart-1", VOLT_THEME.primaryColor)
  root.style.setProperty("--gradient-start", VOLT_THEME.primaryColor)
  root.style.setProperty("--accent", VOLT_THEME.accentColor)
  root.style.setProperty("--chart-3", VOLT_THEME.accentColor)
  root.style.setProperty("--gradient-end", VOLT_THEME.accentColor)
}

export function getStoredCompanyId() {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(COMPANY_ID_STORAGE_KEY)
}

export function getStoredCompany(): CompanySettings | null {
  if (typeof window === "undefined") return null

  try {
    const value = window.localStorage.getItem(COMPANY_STORAGE_KEY)
    return value ? (JSON.parse(value) as CompanySettings) : null
  } catch {
    return null
  }
}

export function storeCompanyId(companyId: number | string) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(COMPANY_ID_STORAGE_KEY, String(companyId))
}

export function storeCompany(company: CompanySettings) {
  if (typeof window === "undefined") return
  storeCompanyId(company.id)
  window.localStorage.setItem(COMPANY_STORAGE_KEY, JSON.stringify(company))
  applyCompanyTheme(company)
}

export function clearStoredCompanyId() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(COMPANY_ID_STORAGE_KEY)
  window.localStorage.removeItem(COMPANY_STORAGE_KEY)
}

export function applyCompanyTheme(company?: Partial<CompanySettings> | null) {
  if (typeof document === "undefined" || !company) return

  const root = document.documentElement

  if (company.primaryColor) {
    root.style.setProperty("--primary", company.primaryColor)
    root.style.setProperty("--sidebar-primary", company.primaryColor)
    root.style.setProperty("--ring", company.primaryColor)
    root.style.setProperty("--chart-1", company.primaryColor)
    root.style.setProperty("--gradient-start", company.primaryColor)
  }

  if (company.accentColor) {
    root.style.setProperty("--accent", company.accentColor)
    root.style.setProperty("--chart-3", company.accentColor)
    root.style.setProperty("--gradient-end", company.accentColor)
  }
}
