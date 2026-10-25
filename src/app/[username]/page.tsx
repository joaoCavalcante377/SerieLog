import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { Avatar } from "@/components/ui/avatar";
import { getDiaryPage } from "@/features/logs/queries/diary";
import { ListGrid } from "@/features/lists/components/list-card";
import { getUserLists } from "@/features/lists/queries/lists";
import { FavoritesEditor } from "@/features/profile/components/favorites-editor";
import {
  Counters,
  FavoritesRow,
  RecentDiary,
  RecentReviews,
  TopGenres,
} from "@/features/profile/components/profile-sections";
import {
  getFavorites,
  getProfileCounters,
  getProfileUser,
  getRatingDistribution,
  getRecentReviewsByUser,
  getTopGenres,
} from "@/features/profile/queries/profile";
import { RatingSummaryPanel } from "@/features/series/components/rating-summary";
import { formatDate, formatRating } from "@/lib/format";
import { messages } from "@/lib/messages/pt-BR";

const m = messages.profile;

const loadUser = cache((username: string) => getProfileUser(username));

export async function generateMetadata({ params }: PageProps<"/[username]">): Promise<Metadata> {
  const { username } = await params;
  const user = await loadUser(username);
  if (!user) return { title: messages.errors.notFoundTitle };
  const title = `${user.name} (@${user.username})`;
  return {
    title,
    description: user.bio ?? undefined,
    openGraph: { title, description: user.bio ?? undefined, type: "profile" },
  };
}

function Section({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default async function ProfilePage({ params }: PageProps<"/[username]">) {
  const { username } = await params;
  const user = await loadUser(username);
  if (!user) notFound();

  const viewerId = (await auth())?.user?.id ?? null;
  const isOwner = viewerId === user.id;

  const [counters, favorites, diary, reviews, lists, ratings, genres] = await Promise.all([
    getProfileCounters(user.id, viewerId),
    getFavorites(user.id),
    getDiaryPage(user.id, { sort: "date" }, 0, 6),
    getRecentReviewsByUser(user.id),
    getUserLists(user.id, viewerId, 6),
    getRatingDistribution(user.id),
    getTopGenres(user.id),
  ]);

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar name={user.name} src={user.image} />
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-2xl font-bold [overflow-wrap:anywhere]">{user.name}</h1>
          <p className="text-muted">@{user.username}</p>
          {user.bio ? <p className="max-w-prose whitespace-pre-line">{user.bio}</p> : null}
          <p className="text-muted text-xs">{m.memberSince(formatDate(user.createdAt))}</p>
        </div>
        {isOwner ? (
          <Link
            href="/configuracoes"
            className="bg-surface-2 border-border inline-flex h-11 items-center rounded-md border px-4 text-sm font-medium"
          >
            {m.editProfile}
          </Link>
        ) : null}
      </header>

      <Counters counters={counters} />

      <Section
        id="favorites-heading"
        title={m.favorites}
        action={
          isOwner ? (
            <FavoritesEditor
              favorites={favorites.map((f) => ({
                seriesId: f.series.id,
                tmdbId: f.series.tmdbId,
                name: f.series.name,
                posterPath: f.series.posterPath,
              }))}
            />
          ) : null
        }
      >
        <FavoritesRow favorites={favorites} />
      </Section>

      <div className="grid gap-10 lg:grid-cols-2">
        <Section
          id="diary-heading"
          title={m.recentDiary}
          action={
            <Link href={`/${user.username}/diario`} className="text-accent text-sm underline">
              {m.seeAll}
            </Link>
          }
        >
          <RecentDiary entries={diary.entries} />
        </Section>

        <Section id="reviews-heading" title={m.recentReviews}>
          <RecentReviews reviews={reviews} />
        </Section>
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        <RatingSummaryPanel
          summary={ratings}
          title={
            ratings.average === null
              ? m.ratingDistribution
              : `${m.ratingDistribution} · ${m.ratingsAverage(formatRating(ratings.average))}`
          }
          emptyText={m.ratingDistributionEmpty}
          headingId="distribution-heading"
        />
        <Section id="genres-heading" title={m.topGenres}>
          <TopGenres genres={genres} />
        </Section>
      </div>

      <Section
        id="lists-heading"
        title={m.publicLists}
        action={
          <Link href={`/${user.username}/listas`} className="text-accent text-sm underline">
            {m.seeAll}
          </Link>
        }
      >
        {lists.length === 0 ? (
          <p className="text-muted text-sm">{messages.lists.noLists}</p>
        ) : (
          <ListGrid lists={lists} showOwner={false} />
        )}
      </Section>

      <p className="text-muted text-sm">
        <Link href={`/${user.username}/watchlist`} className="hover:underline">
          {messages.nav.watchlist}
        </Link>
      </p>
    </div>
  );
}
