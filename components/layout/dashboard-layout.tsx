"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Sidebar } from "./sidebar"
import { Header } from "./header"
import { VoltNotificationToasts } from "@/components/ui/volt-notifications"
import {
  applyCompanyTheme,
  applyVoltTheme,
  CompanySettings,
  getStoredCompany,
  getStoredCompanyId,
  storeCompany,
} from "@/lib/tenant"
import { AppSession, getStoredSession, storeSession } from "@/lib/auth"

interface DashboardLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
}

const fallbackCompany: CompanySettings = {
  id: 0,
  name: "Volt",
  dashboardName: "Volt Dashboards",
  logoUrl: null,
  primaryColor: "#22c55e",
  accentColor: "#8b5cf6",
  ownerName: "Business Owner",
  ownerEmail: "owner@company.com",
}

export function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [company, setCompany] = useState<CompanySettings>(fallbackCompany)
  const [session, setSession] = useState<AppSession | null>(null)
  const [loadingCompany, setLoadingCompany] = useState(true)

  useEffect(() => {
    if (pathname === "/dashboards") {
      applyVoltTheme()
    }
  }, [pathname])

  useEffect(() => {
    async function loadCompany() {
      const storedSession = getStoredSession()
      const storedCompany = getStoredCompany()
      const companyId = storedSession?.companyId || getStoredCompanyId()

      if (!storedSession && !["/login", "/setup"].includes(pathname)) {
        router.push("/login")
        return
      }

      if (storedCompany) {
        setCompany(storedCompany)
        if (pathname === "/dashboards") {
          applyVoltTheme()
        } else {
          applyCompanyTheme(storedCompany)
        }
      }

      if (!companyId) {
        router.push(storedSession ? "/dashboards" : "/setup")
        return
      }

      setSession(storedSession)

      try {
        const response = await fetch(`/api/company-settings?companyId=${companyId}`, {
          cache: "no-store",
        })

        if (!response.ok) {
          throw new Error("Company not found")
        }

        const data: CompanySettings = await response.json()
        setCompany(data)
        if (pathname === "/dashboards") {
          applyVoltTheme()
        } else {
          storeCompany(data)
        }

        if (storedSession) {
          const activeMembership = storedSession.dashboards?.find(
            (dashboard) => dashboard.companyId === Number(companyId)
          )

          if (activeMembership) {
            const updatedSession = {
              ...storedSession,
              userId: activeMembership.userId,
              companyId: activeMembership.companyId,
              role: activeMembership.role,
              fullName: activeMembership.fullName,
              email: activeMembership.email,
            }
            storeSession(updatedSession)
            setSession(updatedSession)
          }
        }
      } catch (error) {
        console.error("Failed to load company settings:", error)
        router.push("/dashboards")
      } finally {
        setLoadingCompany(false)
      }
    }

    loadCompany()
  }, [pathname, router])


  return (
    <div className="flex h-screen overflow-hidden">
      <VoltNotificationToasts />
      <Sidebar
        companyName={company.name}
        dashboardName={company.dashboardName}
        logoUrl={company.logoUrl}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="relative">
          <Header
            title={title}
            subtitle={subtitle}
            companyName={company.name}
            userName={session?.fullName || company.ownerName}
            userEmail={session?.email || company.ownerEmail}
            userRole={session?.role || "employee"}
          />
        </div>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
