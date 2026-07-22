import { SEASON } from "@/game/season";
import { HomeSection } from "@/components/home/HomeSection";
import { PlayerSearchBar } from "@/components/home/PlayerSearchBar";
import { fetchRealmIndex } from "@/data/blizzardApp";
import {
  KeyBoardMockup, RaidBoardMockup, RosterMockup, CoachingMockup, NotificationsMockup, SearchMockup,
} from "@/components/home/FeatureMockups";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  // Most visitors land on EU - prefetching it server-side means the search
  // bar's realm picker has no client-side loading state at all for them,
  // instead of every fresh page load paying a Blizzard token fetch + API
  // round trip before the realm list is usable. Falls back to the client's
  // own fetch (with its own loading state) if this fails for any reason.
  const initialRealms = await fetchRealmIndex("eu").catch(() => []);

  return (
    <div className="space-y-20 py-8">
      {/* hero */}
      <div className="flex flex-col items-center text-center gap-6">
        <span className="text-[11px] uppercase tracking-widest text-gray-500">
          {SEASON.expansion} · Season {SEASON.season}
        </span>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight">
          Play more. Queue less.
        </h1>
        <p className="max-w-xl text-gray-400">
          Enough of endless queue wait time for declines while you can't do anything else at the same time.
          Find Mythic+ and raid groups by what the comp needs rather than a rating number. Compare
          your own parses against the top players of your spec. Look up any character on any server.
        </p>
        <PlayerSearchBar className="w-full max-w-xl" initialRegion="eu" initialRealms={initialRealms} />
      </div>

      <HomeSection
        eyebrow="M+ Key Board"
        title="See the whole comp before you apply"
        description="The default group finder is a flat list of ratings. This board also shows Bloodlust and Battle Res coverage, dispels, defensives, role balance, and run times for every listed key, so you can tell whether a group needs what you bring."
        cta={{ href: "/runs", label: "Browse open keys" }}
        visual={<KeyBoardMockup />}
      />

      <HomeSection
        reverse
        eyebrow="Raid Board"
        title="Pick your own roster split"
        description="Set the tank/healer/dps split yourself for any raid, difficulty, and roster size. Nothing is locked to a preset. List it and players apply straight into the roles you still need."
        cta={{ href: "/raids", label: "Browse open raids" }}
        visual={<RaidBoardMockup />}
      />

      <HomeSection
        eyebrow="Character Roster"
        title="All your alts on one shareable page"
        description="Sync your characters from Battle.net and order your main and alts however you like. The public profile link shows a recruiter or raid lead your whole roster in one place."
        cta={{ href: "/profile", label: "Set up your roster" }}
        visual={<RosterMockup />}
      />

      <HomeSection
        reverse
        eyebrow="Parse Improvement"
        title="See what to fix next"
        description="Compare your Mythic+ and raid logs against a top player of your spec, or against the median of a whole cohort. You get the specifics behind the percentile: rotation gaps, wasted resources, consumables you skipped."
        cta={{ href: "/profile", label: "Compare your parses" }}
        visual={<CoachingMockup />}
      />

      <HomeSection
        eyebrow="Notifications"
        title="Get told when a key opens"
        description="Set your key-level range once. A push arrives when a matching group is listed, so you can close the group finder and go do something else."
        cta={{ href: "/profile", label: "Set up alerts" }}
        visual={<NotificationsMockup />}
      />

      <HomeSection
        reverse
        eyebrow="Player Search"
        title="Look up anyone, on any server"
        description="Search any character across every region and realm, registered here or not. Registered players show their full roster and history. For everyone else you get a live snapshot pulled on the spot."
        visual={<SearchMockup />}
      />
    </div>
  );
}
