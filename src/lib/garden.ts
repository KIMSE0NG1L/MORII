// Decorations that grow on the home map as the user earns XP (+5 per record,
// capped at 100). Positions are percentages of room-map.png, anchored at the
// item's feet; `w` is its width as a percentage of the map.
export const GARDEN_ITEMS = [
  { key: "sprout", name: "새싹", xp: 5, x: 30, y: 57, w: 6 },
  { key: "tulips", name: "튤립", xp: 10, x: 87, y: 36, w: 8.5 },
  { key: "sunflower", name: "해바라기", xp: 20, x: 33, y: 47, w: 6 },
  { key: "cat", name: "고양이", xp: 30, x: 25, y: 75, w: 7.5 },
  { key: "appletree", name: "사과나무", xp: 40, x: 12, y: 31, w: 12 },
  { key: "bluebird", name: "파랑새", xp: 50, x: 60, y: 46, w: 5 },
  { key: "mushroom", name: "버섯", xp: 65, x: 81, y: 75, w: 7 },
  { key: "birdhouse", name: "새집", xp: 80, x: 66, y: 81, w: 6.5 },
] as const;

export type GardenItem = (typeof GARDEN_ITEMS)[number];

export function unlockedGarden(xp: number) {
  return GARDEN_ITEMS.filter((i) => xp >= i.xp);
}

export function nextGardenItem(xp: number) {
  return GARDEN_ITEMS.find((i) => xp < i.xp) ?? null;
}

// Consecutive KST calendar days with at least one record, ending today
// (or yesterday, so the streak survives until the day is over).
export function recordStreak(createdAt: string[], now = new Date()) {
  const kst = (d: Date) => new Date(d.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
  const days = new Set(createdAt.map((iso) => kst(new Date(iso))));
  const DAY = 86_400_000;
  let cursor = now.getTime();
  if (!days.has(kst(new Date(cursor)))) cursor -= DAY;
  let streak = 0;
  while (days.has(kst(new Date(cursor)))) {
    streak++;
    cursor -= DAY;
  }
  return streak;
}
