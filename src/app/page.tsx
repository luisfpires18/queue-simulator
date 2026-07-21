import { SEASON } from "@/game/season";
import { HomeSection } from "@/components/home/HomeSection";
import { PlayerSearchBar } from "@/components/home/PlayerSearchBar";
import { fetchRealmIndex } from "@/data/blizzardApp";
import {
  KeyBoardMockup, RaidBoardMockup, SoloQueueMockup, RosterMockup, CoachingMockup, NotificationsMockup,
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
          The hard part of completing a key should be the key itself, not the endless hours of spamming
          applies. See the actual comp before you commit, list your own keys with preference times and
          raids, or just queue and let it match you.
        </p>
        <PlayerSearchBar className="w-full max-w-xl" initialRegion="eu" initialRealms={initialRealms} />
      </div>

      <HomeSection
        eyebrow="M+ keys"
        title="See the whole comp before you apply"
        description="Blizzard's finder is a wall of rating numbers. Here, every listed key shows its full group and what it's still short on - Lust, the Battle Res, dispels, defensives, the raid buffs, role balance - so you apply to keys that actually want what you play. Listing your own? Put one up for right now and another for later on a different alt, as long as the times don't clash."
        cta={{ href: "/runs", label: "Browse open keys" }}
        visual={<KeyBoardMockup />}
      />

      <HomeSection
        reverse
        eyebrow="Raids"
        title="Build the roster you actually want"
        description="Set your own tank, healer and dps split for any raid, difficulty or size - no forced template. Post it, and people apply straight into the spots you've still got open."
        cta={{ href: "/raids", label: "Browse open raids" }}
        visual={<RaidBoardMockup />}
      />

      <HomeSection
        eyebrow="Solo queue"
        title="Not in the mood to read the board?"
        description="Tell it your key range, your role and which dungeons you're up for, then let it find you a group. You still see who you'd be running with and get the final yes or no - nothing locks in without your say-so."
        cta={{ href: "/runs", label: "Try solo queue" }}
        visual={<SoloQueueMockup />}
      />

      <HomeSection
        reverse
        eyebrow="Profile & lookups"
        title="Your whole roster, one link"
        description="Pull your characters straight from Battle.net, sort your main and alts, and share a single link that shows the lot. Scouting someone before you invite them? Look up any character on any realm - they don't need an account here to show up."
        cta={{ href: "/profile", label: "Set up your profile" }}
        visual={<RosterMockup />}
      />

      <HomeSection
        eyebrow="Parse coaching"
        title="Find the thing that's actually costing you"
        description="Point it at a Mythic+ or raid log and it lines your run up next to a top player of your spec. You get the parts that moved the parse - casts per minute, buff and cooldown uptime, resources you overcapped, flasks or food you skipped, and where you died - not just a colour on a chart."
        cta={{ href: "/profile", label: "Check your parses" }}
        visual={<CoachingMockup />}
      />

      <HomeSection
        reverse
        eyebrow="Notifications"
        title="Add it to your phone, get pinged when a key opens"
        description="Install it to your home screen and it runs like any other app on your phone. Set your key range once and it pushes you the moment a matching group goes up - so you can stop sitting on the board refreshing."
        cta={{ href: "/profile", label: "Set up alerts" }}
        visual={<NotificationsMockup />}
      />
    </div>
  );
}
