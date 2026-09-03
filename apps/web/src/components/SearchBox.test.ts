import type { PublicStreamer } from "@zevent-radar/contracts";
import { filterStreamers, normalize } from "./SearchBox";

function streamer(displayName: string, login: string, game: string | null = null): PublicStreamer {
  return {
    id: login,
    twitchId: login,
    login,
    displayName,
    avatarUrl: null,
    donationUrl: null,
    location: "unknown",
    online: false,
    game,
    viewers: 0,
    amountCents: 0,
    goalsCount: 0,
    reachedCount: 0,
    nextGoal: null,
    remainingCents: null,
    progress: null,
    velocityCentsPerMinute: null,
    etaSeconds: null,
    confidence: null,
    updatedAt: ""
  };
}

describe("filterStreamers", () => {
  const list = [streamer("Étoiles", "etoiles", "Minecraft"), streamer("ZeratoR", "zerator", "Trackmania"), streamer("Anariake", "anariake")];

  it("ignores accents and case", () => {
    expect(filterStreamers(list, "etoi").map((s) => s.login)).toEqual(["etoiles"]);
    expect(normalize("Étoiles")).toBe("etoiles");
  });

  it("matches on game", () => {
    expect(filterStreamers(list, "track").map((s) => s.login)).toEqual(["zerator"]);
  });

  it("returns everything on empty query", () => {
    expect(filterStreamers(list, "  ")).toHaveLength(3);
  });
});
