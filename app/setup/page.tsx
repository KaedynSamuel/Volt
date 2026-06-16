"use client"

import { FormEvent, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Eye,
  Image,
  Lock,
  Mail,
  Palette,
  User,
  Zap,
} from "lucide-react"

import { storeSession } from "@/lib/auth"
import { getReadableForeground, storeCompany } from "@/lib/tenant"

type SetupForm = {
  companyName: string
  dashboardName: string
  ownerName: string
  ownerEmail: string
  ownerPassword: string
  logoUrl: string
  primaryColor: string
  accentColor: string
}

const emptyForm: SetupForm = {
  companyName: "",
  dashboardName: "",
  ownerName: "",
  ownerEmail: "",
  ownerPassword: "",
  logoUrl: "",
  primaryColor: "#22c55e",
  accentColor: "#8b5cf6",
}

const steps = [
  {
    title: "Company Name",
    description: "What company is this dashboard for?",
    icon: Building2,
  },
  {
    title: "Dashboard Name",
    description: "Give this workspace a clean dashboard name.",
    icon: Zap,
  },
  {
    title: "Business Owner",
    description: "Who owns this company dashboard?",
    icon: User,
  },
  {
    title: "Owner Email",
    description: "This email will be used to sign in.",
    icon: Mail,
  },
  {
    title: "Password",
    description: "Create the first business owner password.",
    icon: Lock,
  },
  {
    title: "Logo",
    description: "Add a company logo link, or skip this for now.",
    icon: Image,
  },
  {
    title: "Brand Colours",
    description: "Choose the colours for this dashboard.",
    icon: Palette,
  },
  {
    title: "Preview",
    description: "Review everything before creating the dashboard.",
    icon: Eye,
  },
]

const mainInputClass =
  "w-full rounded-2xl border border-border bg-background/70 px-5 py-3.5 text-center text-base font-medium outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-4 focus:ring-primary/20"

const smallInputClass =
  "w-full rounded-xl border border-border bg-background/70 px-3 py-2.5 text-center text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"

export default function SetupPage() {
  const router = useRouter()

  const [form, setForm] = useState<SetupForm>(emptyForm)
  const [currentStep, setCurrentStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const current = steps[currentStep]
  const CurrentIcon = current.icon
  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === steps.length - 1

  const progress = useMemo(() => {
    return Math.round(((currentStep + 1) / steps.length) * 100)
  }, [currentStep])

  function updateField(key: keyof SetupForm, value: string) {
    setError("")

    setForm((prev) => ({
      ...prev,
      [key]: value,
      ...(key === "companyName" && !prev.dashboardName.trim()
        ? { dashboardName: `${value} Dashboard` }
        : {}),
    }))
  }

  function getStepError(step: number) {
    if (step === 0 && !form.companyName.trim()) {
      return "Enter the company name before continuing."
    }

    if (step === 1 && !form.dashboardName.trim()) {
      return "Enter the dashboard name before continuing."
    }

    if (step === 2 && !form.ownerName.trim()) {
      return "Enter the business owner name before continuing."
    }

    if (step === 3) {
      if (!form.ownerEmail.trim()) {
        return "Enter the owner email before continuing."
      }

      if (!form.ownerEmail.includes("@")) {
        return "Enter a valid email address."
      }
    }

    if (step === 4) {
      if (!form.ownerPassword.trim()) {
        return "Create a password before continuing."
      }

      if (form.ownerPassword.length < 6) {
        return "Password must be at least 6 characters."
      }
    }

    if (step === 6) {
      if (!form.primaryColor.trim() || !form.accentColor.trim()) {
        return "Choose both brand colours before continuing."
      }
    }

    return ""
  }

  const currentStepError = getStepError(currentStep)
  const canContinue = currentStepError === ""

  function nextStep() {
    const validationError = getStepError(currentStep)

    if (validationError) {
      setError(validationError)
      return
    }

    setError("")
    setCurrentStep((step) => Math.min(step + 1, steps.length - 1))
  }

  function previousStep() {
    setError("")
    setCurrentStep((step) => Math.max(step - 1, 0))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    for (let step = 0; step < steps.length - 1; step++) {
      const validationError = getStepError(step)

      if (validationError) {
        setCurrentStep(step)
        setError(validationError)
        return
      }
    }

    try {
      setSaving(true)
      setError("")

      const response = await fetch("/api/company-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          creatorAccount: false,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.details || data?.error || "Company setup failed")
      }

      const company = await response.json()
      const role = "business_owner"

      storeCompany(company)

      storeSession({
        userId: company.ownerUserId,
        companyId: company.id,
        fullName: company.ownerName,
        email: company.ownerEmail,
        role,
        dashboards: [
          {
            userId: company.ownerUserId,
            companyId: company.id,
            fullName: company.ownerName,
            email: company.ownerEmail,
            role,
            status: "active",
            company,
          },
        ],
      })

      router.push("/dashboards")
    } catch (error) {
      console.error(error)
      setSaving(false)
      setError(error instanceof Error ? error.message : "Company setup failed")
    }
  }

  if (saving) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background text-foreground">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.16),transparent_35%),radial-gradient(circle_at_top_right,rgba(139,92,246,0.14),transparent_35%)]" />
        <div className="absolute inset-0 opacity-[0.07] volt-grid" />

        <div className="relative mx-4 w-full max-w-md overflow-hidden rounded-[2rem] border border-border/70 bg-card/85 p-8 text-center shadow-2xl backdrop-blur-xl">
          <div
            className="absolute left-0 right-0 top-0 h-1"
            style={{
              background: `linear-gradient(90deg, ${form.primaryColor}, ${form.accentColor})`,
            }}
          />

          <div className="relative mx-auto mb-7 flex h-24 w-24 items-center justify-center">
            <div
              className="absolute inset-0 rounded-full border volt-ring-one"
              style={{ borderColor: `${form.primaryColor}55` }}
            />

            <div
              className="absolute inset-3 rounded-full border volt-ring-two"
              style={{ borderColor: `${form.accentColor}55` }}
            />

            <div
              className="absolute inset-5 rounded-3xl volt-core"
              style={{
                background: `linear-gradient(135deg, ${form.primaryColor}, ${form.accentColor})`,
              }}
            />

            <Zap className="relative z-10 h-10 w-10 fill-white text-white volt-bolt" />
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">
            Volt Setup
          </p>

          <h1 className="mt-3 text-2xl font-bold tracking-tight">
            Creating your company dashboard
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Give us a few moments while we set everything up for you. We are
            preparing your workspace, owner login, branding and dashboard
            settings.
          </p>

          <div className="relative mt-7 h-2 overflow-hidden rounded-full bg-muted">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent volt-shimmer" />

            <div
              className="h-full w-1/2 rounded-full volt-loader-bar"
              style={{
                background: `linear-gradient(90deg, ${form.primaryColor}, ${form.accentColor})`,
              }}
            />
          </div>

          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span
              className="h-1.5 w-1.5 rounded-full volt-dot"
              style={{ backgroundColor: form.primaryColor }}
            />
            Setting up workspace
            <span
              className="h-1.5 w-1.5 rounded-full volt-dot delay-150"
              style={{ backgroundColor: form.accentColor }}
            />
          </div>
        </div>

        <style jsx>{`
          .volt-grid {
            background-image:
              linear-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px),
              linear-gradient(
                90deg,
                rgba(255, 255, 255, 0.08) 1px,
                transparent 1px
              );
            background-size: 48px 48px;
            animation: gridMove 8s linear infinite;
          }

          .volt-ring-one {
            animation: ringPulse 1.8s ease-in-out infinite;
          }

          .volt-ring-two {
            animation: ringPulse 2.4s ease-in-out infinite reverse;
          }

          .volt-core {
            animation: corePulse 1.6s ease-in-out infinite;
            box-shadow: 0 0 50px rgba(34, 197, 94, 0.35);
          }

          .volt-bolt {
            animation: boltPulse 1.15s ease-in-out infinite;
            filter: drop-shadow(0 0 14px rgba(255, 255, 255, 0.7));
          }

          .volt-loader-bar {
            animation: loaderMove 1.15s ease-in-out infinite;
          }

          .volt-shimmer {
            animation: shimmer 1.7s linear infinite;
          }

          .volt-dot {
            animation: dotPulse 1s ease-in-out infinite;
          }

          .delay-150 {
            animation-delay: 0.15s;
          }

          @keyframes gridMove {
            from {
              transform: translateY(0);
            }
            to {
              transform: translateY(48px);
            }
          }

          @keyframes ringPulse {
            0% {
              transform: scale(0.94);
              opacity: 0.5;
            }
            50% {
              transform: scale(1.08);
              opacity: 1;
            }
            100% {
              transform: scale(0.94);
              opacity: 0.5;
            }
          }

          @keyframes corePulse {
            0% {
              transform: scale(1);
              filter: brightness(1);
            }
            50% {
              transform: scale(1.06);
              filter: brightness(1.25);
            }
            100% {
              transform: scale(1);
              filter: brightness(1);
            }
          }

          @keyframes boltPulse {
            0% {
              transform: scale(1);
              opacity: 0.85;
            }
            50% {
              transform: scale(1.16);
              opacity: 1;
            }
            100% {
              transform: scale(1);
              opacity: 0.85;
            }
          }

          @keyframes loaderMove {
            0% {
              transform: translateX(-120%);
            }
            50% {
              transform: translateX(70%);
            }
            100% {
              transform: translateX(230%);
            }
          }

          @keyframes shimmer {
            0% {
              transform: translateX(-120%);
            }
            100% {
              transform: translateX(120%);
            }
          }

          @keyframes dotPulse {
            0%,
            100% {
              opacity: 0.35;
              transform: scale(0.8);
            }
            50% {
              opacity: 1;
              transform: scale(1.25);
            }
          }
        `}</style>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.12),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(139,92,246,0.14),transparent_35%)]" />

      <div
        className="absolute left-1/2 top-0 -z-10 h-[520px] w-[520px] -translate-x-1/2 rounded-full blur-3xl opacity-20"
        style={{
          background: `linear-gradient(135deg, ${form.primaryColor}, ${form.accentColor})`,
        }}
      />

      <form
        onSubmit={handleSubmit}
        className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-8"
      >
        <div className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl shadow-[0_0_30px_rgba(34,197,94,0.22)]"
              style={{
                background: `linear-gradient(135deg, ${form.primaryColor}, ${form.accentColor})`,
              }}
            >
              <Zap className="h-6 w-6 text-white" />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
                Volt Setup
              </p>
              <h1 className="text-lg font-bold tracking-tight">
                Company onboarding
              </h1>
            </div>
          </div>

          <div className="hidden text-right sm:block">
            <p className="text-sm text-muted-foreground">
              Step {currentStep + 1} of {steps.length}
            </p>
            <p className="text-sm font-medium">{progress}% Complete</p>
          </div>
        </div>

        <div className="mb-8 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${form.primaryColor}, ${form.accentColor})`,
            }}
          />
        </div>

        <section className="relative overflow-hidden rounded-[2.25rem] border border-border bg-card/80 p-6 shadow-2xl backdrop-blur-xl md:p-10">
          <div
            className="absolute inset-x-0 top-0 h-1"
            style={{
              background: `linear-gradient(90deg, ${form.primaryColor}, ${form.accentColor})`,
            }}
          />

          <div className="mx-auto max-w-2xl text-center">
            <div
              className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[1.5rem] shadow-[0_0_40px_rgba(34,197,94,0.24)]"
              style={{
                background: `linear-gradient(135deg, ${form.primaryColor}, ${form.accentColor})`,
              }}
            >
              <CurrentIcon className="h-9 w-9 text-white" />
            </div>

            <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
              {current.title}
            </p>

            <h2 className="mt-3 text-2xl font-bold tracking-tight md:text-4xl">
              {current.description}
            </h2>
          </div>

          <div className="mx-auto mt-8 max-w-lg">
            {currentStep === 0 && (
              <input
                autoFocus
                value={form.companyName}
                onChange={(event) =>
                  updateField("companyName", event.target.value)
                }
                placeholder="Example: B&R IT Consultants"
                className={mainInputClass}
              />
            )}

            {currentStep === 1 && (
              <input
                autoFocus
                value={form.dashboardName}
                onChange={(event) =>
                  updateField("dashboardName", event.target.value)
                }
                placeholder="Example: B&R Dashboard"
                className={mainInputClass}
              />
            )}

            {currentStep === 2 && (
              <input
                autoFocus
                value={form.ownerName}
                onChange={(event) =>
                  updateField("ownerName", event.target.value)
                }
                placeholder="Example: Rayleen Padayachee"
                className={mainInputClass}
              />
            )}

            {currentStep === 3 && (
              <input
                autoFocus
                type="email"
                value={form.ownerEmail}
                onChange={(event) =>
                  updateField("ownerEmail", event.target.value)
                }
                placeholder="Example: owner@company.com"
                className={mainInputClass}
              />
            )}

            {currentStep === 4 && (
              <div className="space-y-3">
                <input
                  autoFocus
                  type="password"
                  value={form.ownerPassword}
                  onChange={(event) =>
                    updateField("ownerPassword", event.target.value)
                  }
                  placeholder="Create a secure password"
                  className={mainInputClass}
                />

                <p className="text-center text-sm text-muted-foreground">
                  Use at least 6 characters. Admins and employees can be added
                  later from the Team page.
                </p>
              </div>
            )}

            {currentStep === 5 && (
              <div className="space-y-5">
                <input
                  autoFocus
                  value={form.logoUrl}
                  onChange={(event) =>
                    updateField("logoUrl", event.target.value)
                  }
                  placeholder="Paste logo URL, or leave blank"
                  className={mainInputClass}
                />

                <div className="rounded-3xl border border-border bg-background/45 p-5">
                  <div className="flex items-center justify-center gap-4">
                    {form.logoUrl ? (
                      <img
                        src={form.logoUrl}
                        alt="Company logo preview"
                        className="h-16 w-16 rounded-2xl border border-border bg-background object-contain"
                      />
                    ) : (
                      <div
                        className="flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-bold text-white"
                        style={{
                          background: `linear-gradient(135deg, ${form.primaryColor}, ${form.accentColor})`,
                        }}
                      >
                        {(form.companyName || "CO").slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    <div className="text-left">
                      <p className="font-medium">
                        {form.companyName || "Company Logo"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Logo preview
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 6 && (
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-3">
                  <p className="text-center text-sm font-medium">
                    Primary Colour
                  </p>

                  <label
                    className="block h-32 cursor-pointer rounded-[1.75rem] border border-border shadow-inner transition hover:scale-[1.01] md:h-36"
                    style={{ backgroundColor: form.primaryColor }}
                  >
                    <input
                      type="color"
                      value={form.primaryColor}
                      onChange={(event) =>
                        updateField("primaryColor", event.target.value)
                      }
                      className="h-full w-full cursor-pointer opacity-0"
                    />
                  </label>

                  <input
                    value={form.primaryColor}
                    onChange={(event) =>
                      updateField("primaryColor", event.target.value)
                    }
                    className={smallInputClass}
                  />
                </div>

                <div className="space-y-3">
                  <p className="text-center text-sm font-medium">
                    Accent Colour
                  </p>

                  <label
                    className="block h-32 cursor-pointer rounded-[1.75rem] border border-border shadow-inner transition hover:scale-[1.01] md:h-36"
                    style={{ backgroundColor: form.accentColor }}
                  >
                    <input
                      type="color"
                      value={form.accentColor}
                      onChange={(event) =>
                        updateField("accentColor", event.target.value)
                      }
                      className="h-full w-full cursor-pointer opacity-0"
                    />
                  </label>

                  <input
                    value={form.accentColor}
                    onChange={(event) =>
                      updateField("accentColor", event.target.value)
                    }
                    className={smallInputClass}
                  />
                </div>

                <div
                  className="rounded-3xl p-[1px] md:col-span-2"
                  style={{
                    background: `linear-gradient(90deg, ${form.primaryColor}, ${form.accentColor})`,
                  }}
                >
                  <div className="rounded-3xl bg-card p-4 text-center">
                    <p className="text-sm font-medium">Colour preview</p>

                    <div className="mt-3 h-3 rounded-full bg-muted">
                      <div
                        className="h-3 w-3/4 rounded-full"
                        style={{
                          background: `linear-gradient(90deg, ${form.primaryColor}, ${form.accentColor})`,
                        }}
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      <span
                        className="rounded-xl px-4 py-2 text-sm font-semibold shadow"
                        style={{
                          background: `linear-gradient(90deg, ${form.primaryColor}, ${form.accentColor})`,
                          color: getReadableForeground(form.primaryColor),
                        }}
                      >
                        + Create
                      </span>
                      <span
                        className="rounded-full px-3 py-1 text-xs font-bold"
                        style={{
                          backgroundColor: `${form.primaryColor}1a`,
                          color: form.primaryColor,
                        }}
                      >
                        Status badge
                      </span>
                      <span
                        className="rounded-full px-3 py-1 text-xs font-bold"
                        style={{
                          backgroundColor: `${form.accentColor}1a`,
                          color: form.accentColor,
                        }}
                      >
                        Accent badge
                      </span>
                    </div>

                    <p className="mt-3 text-[11px] text-muted-foreground">
                      Volt automatically picks readable text for buttons based on the colours you choose.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 7 && (
              <div className="space-y-5">
                <div
                  className="rounded-[2rem] p-[1px]"
                  style={{
                    background: `linear-gradient(135deg, ${form.primaryColor}, ${form.accentColor})`,
                  }}
                >
                  <div className="rounded-[1.95rem] bg-card p-6">
                    <div className="flex items-center justify-center gap-4">
                      {form.logoUrl ? (
                        <img
                          src={form.logoUrl}
                          alt="Company logo preview"
                          className="h-16 w-16 rounded-2xl border border-border bg-background object-contain"
                        />
                      ) : (
                        <div
                          className="flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-bold text-white"
                          style={{
                            background: `linear-gradient(135deg, ${form.primaryColor}, ${form.accentColor})`,
                          }}
                        >
                          {(form.companyName || "CO").slice(0, 2).toUpperCase()}
                        </div>
                      )}

                      <div className="text-left">
                        <h3 className="text-lg font-bold">
                          {form.dashboardName || "Company Dashboard"}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {form.companyName || "Your Company"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Owner: {form.ownerName || "Business Owner"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-3 gap-3">
                      <div className="rounded-2xl border border-border bg-background/60 p-3 text-center">
                        <p className="text-xs text-muted-foreground">Tasks</p>
                        <p className="mt-1 text-lg font-bold">24</p>
                      </div>

                      <div className="rounded-2xl border border-border bg-background/60 p-3 text-center">
                        <p className="text-xs text-muted-foreground">Tickets</p>
                        <p className="mt-1 text-lg font-bold">8</p>
                      </div>

                      <div className="rounded-2xl border border-border bg-background/60 p-3 text-center">
                        <p className="text-xs text-muted-foreground">
                          Progress
                        </p>
                        <p className="mt-1 text-lg font-bold">76%</p>
                      </div>
                    </div>

                    <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full w-3/4 rounded-full"
                        style={{
                          background: `linear-gradient(90deg, ${form.primaryColor}, ${form.accentColor})`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-border bg-background/45 p-5 text-center">
                  <p className="font-medium">Ready to create</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    You can go back and change anything before creating your
                    dashboard.
                  </p>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
              {error}
            </div>
          )}
        </section>

        <div className="mt-8 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={previousStep}
            disabled={isFirstStep}
            className="flex items-center gap-2 rounded-2xl border border-border bg-card/70 px-5 py-3 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex items-center gap-2">
            {steps.map((step, index) => (
              <span
                key={step.title}
                className="h-2.5 w-2.5 rounded-full transition-all"
                style={{
                  backgroundColor:
                    index <= currentStep
                      ? form.primaryColor
                      : "hsl(var(--muted))",
                  width: index === currentStep ? 24 : 10,
                }}
              />
            ))}
          </div>

          {isLastStep ? (
            <button
              type="submit"
              className="flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-[0_0_35px_rgba(34,197,94,0.22)] transition hover:scale-[1.01]"
              style={{
                background: `linear-gradient(90deg, ${form.primaryColor}, ${form.accentColor})`,
              }}
            >
              Create
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={nextStep}
              disabled={!canContinue}
              className="flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-[0_0_35px_rgba(34,197,94,0.22)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background: `linear-gradient(90deg, ${form.primaryColor}, ${form.accentColor})`,
              }}
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>
    </main>
  )
}