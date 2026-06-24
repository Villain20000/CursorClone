import NextAuth from "next-auth";
import GithubProvider from "next-auth/providers/github";

export const authOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID || "mock-id",
      clientSecret: process.env.GITHUB_SECRET || "mock-secret",
    }),
    // In a real enterprise app, we would add SAML/OIDC here
  ],
  callbacks: {
    async session({ session, token }: any) {
      session.user.role = "admin"; // Mocking RBAC
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
