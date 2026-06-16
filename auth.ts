import NextAuth from "next-auth"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"
import Google from "next-auth/providers/google"

/**
 * Volt SSO configuration.
 *
 * This powers the "Continue with Microsoft" and "Continue with Google" buttons
 * on the login page. It only verifies WHO the person is (their real,
 * verified work/personal email address) — it does not decide whether they
 * have access to Volt. After a successful sign-in, the client calls
 * /api/auth/sso-login with the verified email, which looks the person up in
 * the existing Volt AppUsers table (the same table your company admin manages)
 * and issues the normal Volt session.
 *
 * Required environment variables (set these in Azure App Service ->
 * Configuration -> Application settings, or in a local .env.local file):
 *
 *   AUTH_SECRET                       - any long random string (required by Auth.js)
 *   AUTH_MICROSOFT_ENTRA_ID_ID         - Azure AD App Registration "Application (client) ID"
 *   AUTH_MICROSOFT_ENTRA_ID_SECRET     - Azure AD App Registration client secret value
 *   AUTH_MICROSOFT_ENTRA_ID_ISSUER     - e.g. https://login.microsoftonline.com/common/v2.0
 *                                        (use "common" so both work/school AND personal
 *                                        Microsoft accounts can sign in)
 *   AUTH_GOOGLE_ID                     - Google Cloud OAuth Client ID
 *   AUTH_GOOGLE_SECRET                 - Google Cloud OAuth Client Secret
 *
 * See the "Volt Azure Deployment & SSO Guide" provided alongside this project
 * for step-by-step setup instructions.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER || "https://login.microsoftonline.com/common/v2.0",
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    // Keep the verified email + name on the token/session so the client can
    // hand it to /api/auth/sso-login.
    async jwt({ token, profile }) {
      if (profile?.email) token.email = profile.email
      if (profile?.name) token.name = profile.name
      return token
    },
    async session({ session, token }) {
      if (token.email) session.user.email = token.email
      if (token.name) session.user.name = token.name as string
      return session
    },
  },
})
