import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const hasGoogleCredentials = Boolean(googleClientId && googleClientSecret);
const providers = hasGoogleCredentials
  ? [
      Google({
        clientId: googleClientId as string,
        clientSecret: googleClientSecret as string
      })
    ]
  : [];

export const { auth, handlers, signIn, signOut } = NextAuth({
  // Keep local preview noise-free while still requiring a real secret in production.
  secret: process.env.AUTH_SECRET || (process.env.NODE_ENV === "production" ? undefined : "pricetracked-local-development-secret"),
  providers,
  session: {
    strategy: "jwt"
  },
  callbacks: {
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    }
  },
  trustHost: true
});
