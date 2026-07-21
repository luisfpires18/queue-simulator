import { describe, it, expect } from "vitest";
import {
  overlapMinutes,
  overlappingDays,
  totalMinutes,
  normalizeSlots,
  shiftToUtc,
  tzOffsetMinutes,
  formatSlots,
  formatWeeklyLoad,
  type WeeklySlot,
} from "./availability";

/** 20:00-23:00 on `day`, the shape almost every real listing has. */
const evening = (day: number): WeeklySlot => ({ day, startMin: 20 * 60, endMin: 23 * 60 });

describe("normalizeSlots", () => {
  it("drops slots with an out-of-range day", () => {
    expect(normalizeSlots([{ day: 7, startMin: 0, endMin: 60 }])).toEqual([]);
    expect(normalizeSlots([{ day: -1, startMin: 0, endMin: 60 }])).toEqual([]);
  });

  it("drops zero-length slots, which cannot match anything", () => {
    expect(normalizeSlots([{ day: 1, startMin: 600, endMin: 600 }])).toEqual([]);
  });

  it("drops slots with times outside a day", () => {
    expect(normalizeSlots([{ day: 1, startMin: 1440, endMin: 100 }])).toEqual([]);
    expect(normalizeSlots([{ day: 1, startMin: 0, endMin: 1441 }])).toEqual([]);
  });

  it("keeps a valid slot untouched", () => {
    expect(normalizeSlots([evening(2)])).toEqual([evening(2)]);
  });
});

describe("overlapMinutes", () => {
  it("returns the full block for identical schedules", () => {
    expect(overlapMinutes([evening(2)], [evening(2)])).toBe(180);
  });

  it("returns zero for the same time on different days", () => {
    expect(overlapMinutes([evening(2)], [evening(4)])).toBe(0);
  });

  it("returns zero for different times on the same day", () => {
    const morning: WeeklySlot = { day: 2, startMin: 8 * 60, endMin: 11 * 60 };
    expect(overlapMinutes([evening(2)], [morning])).toBe(0);
  });

  it("returns only the shared portion of a partial overlap", () => {
    // 20:00-23:00 against 22:00-01:00 shares 22:00-23:00.
    const late: WeeklySlot = { day: 2, startMin: 22 * 60, endMin: 24 * 60 };
    expect(overlapMinutes([evening(2)], [late])).toBe(60);
  });

  it("sums across multiple shared days", () => {
    expect(overlapMinutes([evening(2), evening(4)], [evening(2), evening(4)])).toBe(360);
  });

  it("counts only the days both sides share", () => {
    expect(overlapMinutes([evening(2), evening(4)], [evening(4), evening(6)])).toBe(180);
  });

  it("is zero when either side is empty", () => {
    expect(overlapMinutes([], [evening(2)])).toBe(0);
    expect(overlapMinutes([evening(2)], [])).toBe(0);
  });

  it("handles a slot that wraps past midnight into the next day", () => {
    // Tue 22:00 -> Wed 02:00, against Wed 00:00-03:00: shares 00:00-02:00.
    const wrapping: WeeklySlot = { day: 2, startMin: 22 * 60, endMin: 2 * 60 };
    const wedEarly: WeeklySlot = { day: 3, startMin: 0, endMin: 3 * 60 };
    expect(overlapMinutes([wrapping], [wedEarly])).toBe(120);
  });

  it("wraps around the end of the week", () => {
    // Sat 23:00 -> Sun 01:00 must meet Sunday 00:00-02:00.
    const satNight: WeeklySlot = { day: 6, startMin: 23 * 60, endMin: 60 };
    const sunEarly: WeeklySlot = { day: 0, startMin: 0, endMin: 2 * 60 };
    expect(overlapMinutes([satNight], [sunEarly])).toBe(60);
  });

  it("does not double-count a wrapping slot against itself", () => {
    const wrapping: WeeklySlot = { day: 6, startMin: 23 * 60, endMin: 60 };
    expect(overlapMinutes([wrapping], [wrapping])).toBe(120);
  });
});

describe("overlappingDays", () => {
  it("lists only days with a real shared window", () => {
    expect(overlappingDays([evening(2), evening(4)], [evening(4)])).toEqual([4]);
  });

  it("returns an empty list when nothing overlaps", () => {
    expect(overlappingDays([evening(1)], [evening(5)])).toEqual([]);
  });

  it("returns days sorted", () => {
    expect(overlappingDays([evening(5), evening(1)], [evening(1), evening(5)])).toEqual([1, 5]);
  });
});

describe("totalMinutes", () => {
  it("sums plain slots", () => {
    expect(totalMinutes([evening(1), evening(3)])).toBe(360);
  });

  it("measures a wrapping slot by its real length", () => {
    expect(totalMinutes([{ day: 6, startMin: 23 * 60, endMin: 60 }])).toBe(120);
  });
});

describe("tzOffsetMinutes", () => {
  // January: northern hemisphere on standard time.
  const winter = new Date("2026-01-15T12:00:00Z");
  // July: northern hemisphere on summer time, Sydney on standard time.
  const summer = new Date("2026-07-15T12:00:00Z");

  it("is zero for UTC", () => {
    expect(tzOffsetMinutes("UTC", winter)).toBe(0);
  });

  it("tracks DST for Europe/Lisbon", () => {
    expect(tzOffsetMinutes("Europe/Lisbon", winter)).toBe(0);
    expect(tzOffsetMinutes("Europe/Lisbon", summer)).toBe(60);
  });

  it("tracks DST for America/New_York", () => {
    expect(tzOffsetMinutes("America/New_York", winter)).toBe(-300);
    expect(tzOffsetMinutes("America/New_York", summer)).toBe(-240);
  });

  it("tracks the southern-hemisphere DST flip for Australia/Sydney", () => {
    expect(tzOffsetMinutes("Australia/Sydney", winter)).toBe(660); // AEDT
    expect(tzOffsetMinutes("Australia/Sydney", summer)).toBe(600); // AEST
  });

  it("falls back to UTC for an unknown zone rather than throwing", () => {
    expect(tzOffsetMinutes("Not/AZone", winter)).toBe(0);
  });
});

describe("shiftToUtc", () => {
  const summer = new Date("2026-07-15T12:00:00Z");

  it("leaves slots alone when no zone is recorded", () => {
    expect(shiftToUtc([evening(2)], null, summer)).toEqual([evening(2)]);
  });

  it("shifts a European evening back by its offset", () => {
    // Lisbon is UTC+1 in July, so 20:00-23:00 local is 19:00-22:00 UTC.
    expect(shiftToUtc([evening(2)], "Europe/Lisbon", summer)).toEqual([
      { day: 2, startMin: 19 * 60, endMin: 22 * 60 },
    ]);
  });

  it("moves a slot onto the previous day when the shift crosses midnight", () => {
    // Sydney is UTC+10 in July: Tuesday 08:00-10:00 local is Monday 22:00-00:00 UTC.
    const morning: WeeklySlot = { day: 2, startMin: 8 * 60, endMin: 10 * 60 };
    expect(shiftToUtc([morning], "Australia/Sydney", summer)).toEqual([
      { day: 1, startMin: 22 * 60, endMin: 24 * 60 },
    ]);
  });

  it("splits a slot that straddles midnight after shifting", () => {
    // New York is UTC-4 in July: Tue 21:00-23:00 local is Wed 01:00-03:00 UTC.
    const night: WeeklySlot = { day: 2, startMin: 21 * 60, endMin: 23 * 60 };
    expect(shiftToUtc([night], "America/New_York", summer)).toEqual([
      { day: 3, startMin: 60, endMin: 3 * 60 },
    ]);
  });

  it("makes two schedules in different zones comparable", () => {
    // 21:00 Lisbon (UTC+1) and 22:00 Madrid (UTC+2) are the same instant, so
    // comparing them raw finds no overlap but comparing in UTC finds a full one.
    const lisbon: WeeklySlot = { day: 2, startMin: 21 * 60, endMin: 23 * 60 };
    const madrid: WeeklySlot = { day: 2, startMin: 22 * 60, endMin: 24 * 60 };
    expect(overlapMinutes([lisbon], [madrid])).toBe(60);

    const a = shiftToUtc([lisbon], "Europe/Lisbon", summer);
    const b = shiftToUtc([madrid], "Europe/Madrid", summer);
    expect(overlapMinutes(a, b)).toBe(120);
  });

  it("preserves total duration across a shift", () => {
    const slots = [evening(2), evening(4)];
    expect(totalMinutes(shiftToUtc(slots, "Australia/Sydney", summer))).toBe(totalMinutes(slots));
  });
});

describe("formatSlots", () => {
  it("collapses days that share a time", () => {
    expect(formatSlots([evening(2), evening(4)])).toBe("Tue, Thu 20:00-23:00");
  });

  it("lists days separately when the times differ", () => {
    expect(formatSlots([evening(2), { day: 6, startMin: 14 * 60, endMin: 18 * 60 }])).toBe(
      "Tue 20:00-23:00, Sat 14:00-18:00"
    );
  });

  it("returns an empty string for no slots, so callers can use their own empty state", () => {
    expect(formatSlots([])).toBe("");
  });
});

describe("formatWeeklyLoad", () => {
  it("renders whole hours without a decimal", () => {
    expect(formatWeeklyLoad([evening(2), evening(4)])).toBe("6h/week");
  });

  it("renders partial hours with one decimal", () => {
    expect(formatWeeklyLoad([{ day: 1, startMin: 0, endMin: 90 }])).toBe("1.5h/week");
  });

  it("returns an empty string for no slots", () => {
    expect(formatWeeklyLoad([])).toBe("");
  });
});
