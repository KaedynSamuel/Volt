"use client"

import { useEffect, useMemo, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import {
  Bell,
  Building2,
  CheckCircle2,
  Globe,
  HelpCircle,
  Mail,
  Monitor,
  Moon,
  Palette,
  Shield,
  Smartphone,
  Sun,
  User,
  WalletCards,
} from "lucide-react"

type ThemeMode = "dark" | "light" | "system"
type ButtonShape = "pill" | "rounded" | "soft"
type LanguageCode = "en" | "es" | "af" | "zu"

type ProfileSettings = {
  firstName: string
  lastName: string
  email: string
  phone: string
}


type StoredVoltSettings = {
  profile: ProfileSettings
  notifications: {
    emailNotifications: boolean
    ticketEmails: boolean
    assignedTaskEmails: boolean
    desktopNotifications: boolean
  }
  microsoftSecurity: boolean
}

const SETTINGS_STORAGE_KEY = "volt-user-settings"

const defaultProfile: ProfileSettings = {
  firstName: "Kaedyn",
  lastName: "Padayachee",
  email: "kaedyn@pkdashboards.com",
  phone: "+27 00 000 0000",
}


const settingsSections = [
  { id: "profile", title: "Profile", description: "Personal account details", icon: User },
  { id: "notifications", title: "Notifications", description: "Volt email and app alerts", icon: Bell },
  { id: "security", title: "Security", description: "Microsoft and cyber protection", icon: Shield },
  { id: "appearance", title: "Appearance", description: "Theme and button style", icon: Palette },
  { id: "language", title: "Language & Region", description: "Dashboard wording and region", icon: Globe },
  { id: "support", title: "Help & Support", description: "Support contacts and answers", icon: HelpCircle },
]

const languages: Array<{ code: LanguageCode; label: string; preview: string }> = [
  { code: "en", label: "English", preview: "Tasks, Tickets, Projects" },
  { code: "es", label: "Spanish", preview: "Tareas, Tickets, Proyectos" },
  { code: "af", label: "Afrikaans", preview: "Take, Kaartjies, Projekte" },
  { code: "zu", label: "Zulu", preview: "Imisebenzi, Amathikithi, Amaphrojekthi" },
]

const supportFaqs = [
  {
    question: "How do I get help with Volt?",
    answer: "Contact Volt technical support on +27 00 000 0000 or email support@voltapplication.local.",
  },
  {
    question: "Why are personal tasks not emailed?",
    answer: "Personal tasks stay inside Volt to avoid inbox spam. Assigned tasks and tickets can trigger Volt email notifications.",
  },
  {
    question: "What file types are safe for Team file share?",
    answer: "Images, Word, Excel, PDF, and XML files are checked before upload and encrypted before saving.",
  },
]

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement
  const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches

  root.classList.remove("dark", "light")
  root.classList.add(theme === "system" ? (systemPrefersDark ? "dark" : "light") : theme)
  localStorage.setItem("volt-theme", theme)
}

function applyButtonShape(shape: ButtonShape) {
  document.documentElement.dataset.voltButtonShape = shape
  localStorage.setItem("volt-button-shape", shape)
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("profile")
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark")
  const [buttonShape, setButtonShape] = useState<ButtonShape>("soft")
  const [language, setLanguage] = useState<LanguageCode>("en")
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [ticketEmails, setTicketEmails] = useState(true)
  const [assignedTaskEmails, setAssignedTaskEmails] = useState(true)
  const [desktopNotifications, setDesktopNotifications] = useState(true)
  const [microsoftSecurity, setMicrosoftSecurity] = useState(false)
  const [profile, setProfile] = useState<ProfileSettings>(defaultProfile)
  const [saveMessage, setSaveMessage] = useState("")

  const selectedLanguage = useMemo(
    () => languages.find((item) => item.code === language) || languages[0],
    [language],
  )

  useEffect(() => {
    const savedTheme = (localStorage.getItem("volt-theme") as ThemeMode | null) || "dark"
    const savedShape = (localStorage.getItem("volt-button-shape") as ButtonShape | null) || "soft"
    const savedLanguage = (localStorage.getItem("volt-language") as LanguageCode | null) || "en"

    try {
      const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY)
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings) as Partial<StoredVoltSettings>
        if (parsed.profile) setProfile({ ...defaultProfile, ...parsed.profile })
        if (parsed.notifications) {
          setEmailNotifications(parsed.notifications.emailNotifications ?? true)
          setTicketEmails(parsed.notifications.ticketEmails ?? true)
          setAssignedTaskEmails(parsed.notifications.assignedTaskEmails ?? true)
          setDesktopNotifications(parsed.notifications.desktopNotifications ?? true)
        }
        setMicrosoftSecurity(Boolean(parsed.microsoftSecurity))
      }
    } catch {
      localStorage.removeItem(SETTINGS_STORAGE_KEY)
    }

    setThemeMode(savedTheme)
    setButtonShape(savedShape)
    setLanguage(savedLanguage)
    applyTheme(savedTheme)
    applyButtonShape(savedShape)
    document.documentElement.lang = savedLanguage
  }, [])

  function handleThemeChange(theme: ThemeMode) {
    setThemeMode(theme)
    applyTheme(theme)
  }

  function handleButtonShape(shape: ButtonShape) {
    setButtonShape(shape)
    applyButtonShape(shape)
  }

  function handleLanguageChange(code: LanguageCode) {
    setLanguage(code)
    localStorage.setItem("volt-language", code)
    document.documentElement.lang = code
    window.dispatchEvent(new CustomEvent("volt-language-change", { detail: { language: code } }))
  }

  function showSaved(message = "Settings saved for this device.") {
    setSaveMessage(message)
    window.setTimeout(() => setSaveMessage(""), 2800)
  }

  function saveUserSettings(message = "Settings saved and will stay after refresh.") {
    const settings: StoredVoltSettings = {
      profile,
      notifications: {
        emailNotifications,
        ticketEmails,
        assignedTaskEmails,
        desktopNotifications,
      },
      microsoftSecurity,
    }

    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
    showSaved(message)
  }

  function updateProfileField(field: keyof ProfileSettings, value: string) {
    setProfile((current) => ({ ...current, [field]: value }))
  }


  const renderToggle = (enabled: boolean, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className={`relative h-6 w-11 rounded-full transition-all duration-300 ${
        enabled ? "bg-gradient-to-r from-[#d011c9] to-[#05a391] shadow-[0_0_18px_rgba(208,17,201,0.25)]" : "bg-muted"
      }`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ${enabled ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  )

  return (
    <DashboardLayout title="Settings" subtitle="Manage Volt account, security, appearance, and support preferences.">
      <style jsx global>{`
        html[data-volt-button-shape="pill"] button:not(.unstyled-button) { border-radius: 9999px; }
        html[data-volt-button-shape="rounded"] button:not(.unstyled-button) { border-radius: 0.75rem; }
        html[data-volt-button-shape="soft"] button:not(.unstyled-button) { border-radius: 1rem; }
      `}</style>

      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="h-fit w-full rounded-2xl border border-border bg-card/70 p-3 shadow-lg backdrop-blur-xl lg:w-72">
          <nav className="space-y-1">
            {settingsSections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all duration-300 ${
                  activeSection === section.id
                    ? "bg-gradient-to-r from-[#d011c9] to-[#05a391] text-white shadow-[0_12px_30px_rgba(208,17,201,0.22)]"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <section.icon className="h-4 w-4 shrink-0" />
                <div>
                  <span className="block font-medium">{section.title}</span>
                  <span className={`mt-0.5 block text-[11px] ${activeSection === section.id ? "text-white/75" : "text-muted-foreground"}`}>
                    {section.description}
                  </span>
                </div>
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 rounded-2xl border border-border bg-card/70 p-5 shadow-lg backdrop-blur-xl">
          {saveMessage && (
            <div className="mb-4 flex items-center gap-2 rounded-2xl border border-[#05a391]/30 bg-[#05a391]/10 px-4 py-3 text-sm text-[#05a391]">
              <CheckCircle2 className="h-4 w-4" /> {saveMessage}
            </div>
          )}

          {activeSection === "profile" && (
            <section className="max-w-3xl">
              <div className="mb-6">
                <span className="mb-3 inline-flex rounded-full border border-[#d011c9]/30 bg-[#d011c9]/10 px-3 py-1 text-xs font-semibold text-[#d011c9]">Account Settings</span>
                <h2 className="text-2xl font-bold text-foreground">Profile</h2>
                <p className="mt-1 text-sm text-muted-foreground">Manage your personal information and preferences.</p>
              </div>
              <div className="mb-6 flex flex-col gap-5 rounded-2xl border border-border bg-background/40 p-5 sm:flex-row sm:items-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#d011c9] to-[#05a391] text-2xl font-bold text-white shadow-[0_0_35px_rgba(208,17,201,0.25)]">KP</div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{profile.firstName} {profile.lastName}</h3>
                  <p className="text-sm text-muted-foreground">{profile.email}</p>
                  <span className="mt-3 inline-flex rounded-full border border-[#05a391]/30 bg-[#05a391]/10 px-3 py-1 text-xs font-semibold text-[#05a391]">Volt Admin</span>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <input value={profile.firstName} onChange={(event) => updateProfileField("firstName", event.target.value)} className="h-11 rounded-xl border border-border bg-input px-3 text-sm outline-none focus:border-[#05a391]" />
                <input value={profile.lastName} onChange={(event) => updateProfileField("lastName", event.target.value)} className="h-11 rounded-xl border border-border bg-input px-3 text-sm outline-none focus:border-[#05a391]" />
                <input value={profile.email} onChange={(event) => updateProfileField("email", event.target.value)} className="h-11 rounded-xl border border-border bg-input px-3 text-sm outline-none focus:border-[#05a391] md:col-span-2" />
                <input value={profile.phone} onChange={(event) => updateProfileField("phone", event.target.value)} className="h-11 rounded-xl border border-border bg-input px-3 text-sm outline-none focus:border-[#05a391] md:col-span-2" />
              </div>
              <button type="button" onClick={() => saveUserSettings("Profile saved and will stay after refresh.")} className="mt-5 h-10 rounded-xl bg-gradient-to-r from-[#d011c9] to-[#05a391] px-4 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(208,17,201,0.22)] transition-all hover:-translate-y-0.5">Save Profile</button>
            </section>
          )}

          {activeSection === "notifications" && (
            <section className="max-w-3xl">
              <div className="mb-6">
                <span className="mb-3 inline-flex rounded-full border border-[#05a391]/30 bg-[#05a391]/10 px-3 py-1 text-xs font-semibold text-[#05a391]">Volt Application Emails</span>
                <h2 className="text-2xl font-bold text-foreground">Notifications</h2>
                <p className="mt-1 text-sm text-muted-foreground">Tickets and assigned tasks can send Volt email notifications. Personal tasks stay inside the app.</p>
              </div>
              <div className="space-y-3">
                {[
                  ["Email Notifications", "Main email notification switch for Volt.", emailNotifications, () => setEmailNotifications(!emailNotifications)],
                  ["Ticket Created For Me", "Email me when a ticket is created and assigned to me.", ticketEmails, () => setTicketEmails(!ticketEmails)],
                  ["Assigned Task Created", "Email me only for assigned tasks, not personal tasks.", assignedTaskEmails, () => setAssignedTaskEmails(!assignedTaskEmails)],
                  ["Desktop Notifications", "Show browser alerts for team activity.", desktopNotifications, () => setDesktopNotifications(!desktopNotifications)],
                ].map(([title, description, enabled, action]) => (
                  <div key={String(title)} className="flex items-center justify-between rounded-2xl border border-border bg-background/40 p-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{String(title)}</p>
                      <p className="text-xs text-muted-foreground">{String(description)}</p>
                    </div>
                    {renderToggle(Boolean(enabled), action as () => void)}
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => saveUserSettings("Notification preferences saved. Email sending is ready through the Volt notification hook.")} className="mt-5 h-10 rounded-xl bg-gradient-to-r from-[#d011c9] to-[#05a391] px-4 text-sm font-semibold text-white">Save Notifications</button>
            </section>
          )}

          {activeSection === "security" && (
            <section className="max-w-4xl">
              <div className="mb-6">
                <span className="mb-3 inline-flex rounded-full border border-[#d011c9]/30 bg-[#d011c9]/10 px-3 py-1 text-xs font-semibold text-[#d011c9]">Cyber Security</span>
                <h2 className="text-2xl font-bold text-foreground">Security</h2>
                <p className="mt-1 text-sm text-muted-foreground">Link Microsoft security and harden Volt with safer access controls.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-border bg-background/40 p-5">
                  <Shield className="mb-4 h-7 w-7 text-[#05a391]" />
                  <h3 className="font-semibold">Microsoft Security Link</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Prepared for Microsoft Entra / Microsoft login security, MFA, and verified business access.</p>
                  <button type="button" onClick={() => setMicrosoftSecurity((value) => !value)} className="mt-4 h-9 rounded-xl border border-[#05a391]/40 px-3 text-sm font-semibold text-[#05a391]">{microsoftSecurity ? "Linked Preview" : "Link Microsoft"}</button>
                </div>
                <div className="rounded-2xl border border-border bg-background/40 p-5">
                  <Monitor className="mb-4 h-7 w-7 text-[#d011c9]" />
                  <h3 className="font-semibold">Cyber Protection Checklist</h3>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    <li>• Role based Admin Hub access</li>
                    <li>• OTP-ready admin login flow</li>
                    <li>• Encrypted team chat and files</li>
                    <li>• Safe file upload validation</li>
                    <li>• Session and company isolation</li>
                  </ul>
                </div>
              </div>
              <button type="button" onClick={() => saveUserSettings("Security settings saved.")} className="mt-5 h-10 rounded-xl bg-gradient-to-r from-[#d011c9] to-[#05a391] px-4 text-sm font-semibold text-white">Save Security</button>
            </section>
          )}

          {activeSection === "appearance" && (
            <section className="max-w-4xl">
              <div className="mb-6">
                <span className="mb-3 inline-flex rounded-full border border-[#d011c9]/30 bg-[#d011c9]/10 px-3 py-1 text-xs font-semibold text-[#d011c9]">Volt Theme</span>
                <h2 className="text-2xl font-bold text-foreground">Appearance</h2>
                <p className="mt-1 text-sm text-muted-foreground">Switch theme and choose how buttons feel across Volt.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  ["dark", "Dark Mode", "Professional black Volt dashboard.", Moon],
                  ["light", "Light Mode", "Clean white professional interface.", Sun],
                  ["system", "System", "Follow your device theme.", Monitor],
                ].map(([value, title, description, Icon]) => (
                  <button key={String(value)} type="button" onClick={() => handleThemeChange(value as ThemeMode)} className={`rounded-2xl border p-5 text-left transition-all ${themeMode === value ? "border-[#d011c9] bg-[#d011c9]/10 shadow-[0_0_28px_rgba(208,17,201,0.2)]" : "border-border bg-background/40 hover:bg-secondary"}`}>
                    <Icon className="mb-4 h-6 w-6 text-[#05a391]" />
                    <h3 className="font-semibold text-foreground">{String(title)}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{String(description)}</p>
                  </button>
                ))}
              </div>
              <div className="mt-6 rounded-2xl border border-border bg-background/40 p-5">
                <h3 className="mb-3 text-sm font-semibold text-foreground">Button Shape</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    ["pill", "Pill", "Fully rounded action buttons"],
                    ["rounded", "Rectangle", "Cleaner squared shape with curves"],
                    ["soft", "Both", "Balanced Volt curved animation style"],
                  ].map(([value, title, description]) => (
                    <button key={String(value)} type="button" onClick={() => handleButtonShape(value as ButtonShape)} className={`border px-4 py-3 text-left transition hover:-translate-y-0.5 ${buttonShape === value ? "border-[#05a391] bg-[#05a391]/10 text-[#05a391]" : "border-border bg-card/60"}`}>
                      <span className="block text-sm font-bold">{String(title)}</span>
                      <span className="block text-xs text-muted-foreground">{String(description)}</span>
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" onClick={() => saveUserSettings("Appearance saved and applied.")} className="mt-5 h-10 rounded-xl bg-gradient-to-r from-[#d011c9] to-[#05a391] px-4 text-sm font-semibold text-white">Save Appearance</button>
            </section>
          )}

          {activeSection === "language" && (
            <section className="max-w-3xl">
              <div className="mb-6">
                <span className="mb-3 inline-flex rounded-full border border-[#05a391]/30 bg-[#05a391]/10 px-3 py-1 text-xs font-semibold text-[#05a391]">Language & Region</span>
                <h2 className="text-2xl font-bold text-foreground">Language & Region</h2>
                <p className="mt-1 text-sm text-muted-foreground">Default is English. The selected language is saved and ready for dashboard wording hooks.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {languages.map((item) => (
                  <button key={item.code} type="button" onClick={() => handleLanguageChange(item.code)} className={`rounded-2xl border p-4 text-left transition ${language === item.code ? "border-[#05a391] bg-[#05a391]/10" : "border-border bg-background/40 hover:bg-secondary"}`}>
                    <span className="block font-semibold">{item.label}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{item.preview}</span>
                  </button>
                ))}
              </div>
              <div className="mt-5 rounded-2xl border border-border bg-background/40 p-4 text-sm text-muted-foreground">
                Current dashboard language: <strong className="text-foreground">{selectedLanguage.label}</strong>. Region: South Africa. Currency: ZAR.
              </div>
              <button type="button" onClick={() => saveUserSettings("Language and region saved.")} className="mt-5 h-10 rounded-xl bg-gradient-to-r from-[#d011c9] to-[#05a391] px-4 text-sm font-semibold text-white">Save Language</button>
            </section>
          )}
          {activeSection === "support" && (
            <section className="max-w-3xl">
              <div className="mb-6">
                <span className="mb-3 inline-flex rounded-full border border-[#05a391]/30 bg-[#05a391]/10 px-3 py-1 text-xs font-semibold text-[#05a391]">Support</span>
                <h2 className="text-2xl font-bold text-foreground">Help & Support</h2>
                <p className="mt-1 text-sm text-muted-foreground">Technical support contact and quick answers for common Volt questions.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-border bg-background/40 p-5">
                  <Smartphone className="mb-3 h-6 w-6 text-[#05a391]" />
                  <h3 className="font-semibold">Technical Support Number</h3>
                  <p className="mt-1 text-sm text-muted-foreground">+27 00 000 0000</p>
                </div>
                <div className="rounded-2xl border border-border bg-background/40 p-5">
                  <Mail className="mb-3 h-6 w-6 text-[#d011c9]" />
                  <h3 className="font-semibold">Support Email</h3>
                  <p className="mt-1 text-sm text-muted-foreground">support@voltapplication.local</p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {supportFaqs.map((faq) => (
                  <div key={faq.question} className="rounded-2xl border border-border bg-background/40 p-4">
                    <p className="text-sm font-semibold text-foreground">{faq.question}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </DashboardLayout>
  )
}
