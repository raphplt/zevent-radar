import { decodeShare, encodeShare, favoritesStore, toggleFavorite } from "./favorites";
import { useToasts } from "./toast";

describe("share tokens", () => {
  it("encodes logins as a readable comma list", () => {
    expect(encodeShare(["zerator", " domingo ", ""])).toBe("zerator,domingo");
  });

  it("decodes the current format", () => {
    expect(decodeShare("zerator,domingo")).toEqual(["zerator", "domingo"]);
  });

  it("decodes legacy base64 id lists", () => {
    const legacy = btoa("77870741,40063341").replace(/=+$/, "");
    expect(decodeShare(legacy)).toContain("77870741");
    expect(decodeShare(legacy)).toContain("40063341");
  });

  it("returns a single login untouched", () => {
    expect(decodeShare("zerator")).toContain("zerator");
  });

  it("ignores garbage", () => {
    expect(decodeShare("")).toEqual([]);
  });
});

describe("toggleFavorite", () => {
  beforeEach(() => favoritesStore.set([]));

  it("adds then removes", () => {
    toggleFavorite("a");
    expect(favoritesStore.get()).toEqual(["a"]);
    toggleFavorite("a");
    expect(favoritesStore.get()).toEqual([]);
  });

  it("restores the previous position on undo", () => {
    favoritesStore.set(["a", "b", "c"]);
    toggleFavorite("b", "B");
    expect(favoritesStore.get()).toEqual(["a", "c"]);
    expect(typeof useToasts).toBe("function");
  });
});
