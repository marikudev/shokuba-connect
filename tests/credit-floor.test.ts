import { describe, expect, it } from "vitest";

import {
  isCreditFloorHit,
  paidModelsBlocked,
} from "@/hooks/useUsageMeter";

// GC-06 credit floor: paid models may only be used while the
// operator's remaining credit stays above $1. The floor reads
// the key's limit remainder — the only remaining-credit figure
// the key endpoint exposes — so an uncapped key (null) never
// triggers it.
describe("isCreditFloorHit (GC-06)", () => {
  it("never triggers without a remaining figure", () => {
    expect(isCreditFloorHit(null)).toBe(false);
  });

  it("stays open above the floor", () => {
    expect(isCreditFloorHit(4.5)).toBe(false);
    expect(isCreditFloorHit(1.01)).toBe(false);
  });

  it("hits at and below $1", () => {
    expect(isCreditFloorHit(1)).toBe(true);
    expect(isCreditFloorHit(0.5)).toBe(true);
    expect(isCreditFloorHit(0)).toBe(true);
    expect(isCreditFloorHit(-0.25)).toBe(true);
  });
});

// GC-06 combined: any single layer blocks paid models.
describe("paidModelsBlocked (GC-06, all layers)", () => {
  it("blocks a free-tier account even with a $50 key limit (the reported case)", () => {
    expect(
      paidModelsBlocked({
        isFreeTier: true,
        limitRemaining: 50,
        paidLocked: false,
      }),
    ).toBe(true);
  });

  it("blocks a paid account whose capped key reaches the $1 floor", () => {
    expect(
      paidModelsBlocked({
        isFreeTier: false,
        limitRemaining: 0.5,
        paidLocked: false,
      }),
    ).toBe(true);
  });

  it("does not block an uncapped key (null is 'no cap', not zero)", () => {
    expect(
      paidModelsBlocked({
        isFreeTier: false,
        limitRemaining: null,
        paidLocked: false,
      }),
    ).toBe(false);
  });

  it("blocks after a paid 402 locked the session", () => {
    expect(
      paidModelsBlocked({
        isFreeTier: null,
        limitRemaining: 50,
        paidLocked: true,
      }),
    ).toBe(true);
  });

  it("leaves a healthy paid account open", () => {
    expect(
      paidModelsBlocked({
        isFreeTier: false,
        limitRemaining: 50,
        paidLocked: false,
      }),
    ).toBe(false);
  });
});
