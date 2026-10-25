import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { attemptLogin } from "@/features/auth/server/login";
import { clientIp } from "@/lib/rate-limit";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

// Stateless JWT session kept in a secure httpOnly cookie: the user stays logged in for 30 days.
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: THIRTY_DAYS },
  pages: { signIn: "/entrar" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials, request) => {
        const attempt = await attemptLogin(credentials, clientIp(request.headers));
        return attempt.status === "ok" ? attempt.user : null;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
