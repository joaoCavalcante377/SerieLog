import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  DeleteAccountForm,
  PasswordForm,
  ProfileForm,
} from "@/features/profile/components/settings-forms";
import { WatchlistPrivacyForm } from "@/features/watchlist/components/privacy-form";
import { getAccount } from "@/features/profile/queries/get-account";
import { requireUserId } from "@/lib/auth-guard";
import { messages } from "@/lib/messages/pt-BR";
import { buildLoginRedirect } from "@/lib/redirects";

export const metadata: Metadata = { title: messages.settings.title };

export default async function SettingsPage() {
  const userId = await requireUserId("/configuracoes");
  const account = await getAccount(userId);
  // Session is valid but the row is gone (e.g. account deleted in another tab).
  if (!account) redirect(buildLoginRedirect("/configuracoes"));
  const s = messages.settings;

  return (
    <div className="mx-auto max-w-xl space-y-10">
      <h1 className="text-2xl font-bold">{s.title}</h1>
      <section aria-labelledby="profile-heading" className="space-y-4">
        <h2 id="profile-heading" className="text-lg font-semibold">
          {s.profileSection}
        </h2>
        <ProfileForm
          defaults={{
            name: account.name,
            username: account.username ?? "",
            bio: account.bio ?? "",
            image: account.image ?? "",
          }}
        />
      </section>
      <section aria-labelledby="privacy-heading" className="space-y-4">
        <h2 id="privacy-heading" className="text-lg font-semibold">
          {messages.watchlist.title}
        </h2>
        <WatchlistPrivacyForm initialPublic={account.watchlistPublic} />
      </section>
      {account.passwordHash ? (
        <section aria-labelledby="password-heading" className="space-y-4">
          <h2 id="password-heading" className="text-lg font-semibold">
            {s.passwordSection}
          </h2>
          <PasswordForm />
        </section>
      ) : null}
      <section aria-labelledby="danger-heading" className="space-y-4">
        <h2 id="danger-heading" className="text-danger text-lg font-semibold">
          {s.dangerSection}
        </h2>
        <DeleteAccountForm />
      </section>
    </div>
  );
}
