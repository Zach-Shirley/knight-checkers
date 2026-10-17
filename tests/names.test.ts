import { describe, expect, it } from "vitest";
import { generateDisplayName, isGeneratedName, isPlayerId } from "../src/multiplayer/names";

describe("generated identities", () => {
  it("generates names the server accepts", () => {
    for (let i = 0; i < 200; i++) expect(isGeneratedName(generateDisplayName())).toBe(true);
  });

  it("rejects typed names", () => {
    for (const name of ["Guest", "swiftfalcon27", "SwiftFalcon7", "SwiftFalcon270", "SwiftNazi27", "Swift Falcon27", ""]) {
      expect(isGeneratedName(name)).toBe(false);
    }
  });

  it("validates player IDs", () => {
    expect(isPlayerId("1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed")).toBe(true);
    expect(isPlayerId("not-an-id")).toBe(false);
    expect(isPlayerId(42)).toBe(false);
  });
});
