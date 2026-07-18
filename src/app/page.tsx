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
          Find Mythic+ and raid groups by comp, not just a rating number. Coach your own parses
          against the top players of your spec. Look up any character, on any server.
        </p>
        <PlayerSearchBar className="w-full max-w-xl" initialRegion="eu" initialRealms={initialRealms} />
      </div>

      <HomeSection
        eyebrow="M+ Key Board"
        title="See the whole comp before you apply"
        description="Blizzard's LFG shows a flat list of ratings. This board shows Bloodlust/Battle Res coverage, dispels, defensives, and role balance for every listed key — so you know if a group actually needs what you bring."
        cta={{ href: "/runs", label: "Browse open keys" }}
        visual={<KeyBoardMockup />}
      />

      <HomeSection
        reverse
        eyebrow="Raid Board"
        title="Build your own roster, your way"
        description="Pick your own tank/healer/dps split for any raid, any difficulty, any size — no forced formula. List it, and let players apply straight into the roles you actually need."
        cta={{ href: "/raids", label: "Browse open raids" }}
        visual={<RaidBoardMockup />}
      />

      <HomeSection
        eyebrow="Character Roster"
        title="One roster, every alt, one link to share"
        description="Sync your characters from Battle.net, arrange your main and alts, and share one public profile link — so a recruiter or raid lead sees your whole roster at a glance."
        cta={{ href: "/profile", label: "Set up your roster" }}
        visual={<RosterMockup />}
      />

      <HomeSection
        reverse
        eyebrow="Parse Improvement"
        title="Know exactly what to fix next"
        description="Compare your Mythic+ and raid logs against a top player of your spec — or a whole cohort's median — and get concrete, data-derived advice: rotation gaps, wasted resources, missing consumables, not just a percentile."
        cta={{ href: "/profile", label: "Compare your parses" }}
        visual={<CoachingMockup />}
      />

      <HomeSection
        eyebrow="Notifications"
        title="Stop tab-switching to check the board"
        description="Set your key-level range once and get pushed the moment a matching group opens — no more sitting on the group finder refreshing."
        cta={{ href: "/profile", label: "Set up alerts" }}
        visual={<NotificationsMockup />}
      />

      <HomeSection
        reverse
        eyebrow="Player Search"
        title="Look up anyone, on any server"
        description="Search any character across every region and realm — registered here or not. Registered players get their full roster and history; anyone else gets an instant live snapshot."
        visual={<SearchMockup />}
      />
    </div>
  );
}
