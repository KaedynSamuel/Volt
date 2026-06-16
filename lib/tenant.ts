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

/**
 * Given a hex colour, returns either a near-black or near-white colour
 * depending on which gives better contrast (readable text on top of it).
 * This keeps "Create" buttons, badges, and gradients legible no matter
 * which brand colours a company picks during setup.
 */
export function getReadableForeground(hexColor: string): string {
  const hex = hexColor.replace("#", "").trim()

  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(hex)) {
    return "#ffffff"
  }

  const normalized =
    hex.length === 3
      ? hex
          .split("")
          .map((char) => char + char)
          .join("")
      : hex

  const r = parseInt(normalized.slice(0, 2), 16) / 255
  const g = parseInt(normalized.slice(2, 4), 16) / 255
  const b = parseInt(normalized.slice(4, 6), 16) / 255

  // Relative luminance (WCAG formula)
  const channel = (value: number) =>
    value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)

  const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)

  // Light backgrounds get dark text, dark backgrounds get white text
  return luminance > 0.55 ? "#10131c" : "#ffffff"
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

  const primaryForeground = getReadableForeground(VOLT_THEME.primaryColor)
  const accentForeground = getReadableForeground(VOLT_THEME.accentColor)
  root.style.setProperty("--primary-foreground", primaryForeground)
  root.style.setProperty("--sidebar-primary-foreground", primaryForeground)
  root.style.setProperty("--accent-foreground", accentForeground)
  root.style.setProperty("--sidebar-accent-foreground", accentForeground)
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

    const primaryForeground = getReadableForeground(company.primaryColor)
    root.style.setProperty("--primary-foreground", primaryForeground)
    root.style.setProperty("--sidebar-primary-foreground", primaryForeground)
  }

  if (company.accentColor) {
    root.style.setProperty("--accent", company.accentColor)
    root.style.setProperty("--chart-3", company.accentColor)
    root.style.setProperty("--gradient-end", company.accentColor)

    const accentForeground = getReadableForeground(company.accentColor)
    root.style.setProperty("--accent-foreground", accentForeground)
    root.style.setProperty("--sidebar-accent-foreground", accentForeground)
  }
}
