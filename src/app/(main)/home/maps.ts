// Home map themes. Each theme has a wide (PC / landscape, 1344x752) and a
// tall (mobile / portrait, 752x1344) painting. All coordinates are
// percentages of that painting, so they stay glued to the painted objects
// at any rendered size.

export type Point = { x: number; y: number };
export type SpotKey = "easel" | "mood" | "bookshelf" | "gallery";
export type Box = { left: number; top: number; width: number; height: number };

export type MapLayout = {
  src: string;
  /** width / height of the painting */
  ratio: number;
  home: Point; // where the player starts (feet position)
  spots: Record<SpotKey, { box: Box; stand: Point }>;
  /** Glowing windows at night (optional). */
  windows: Point[];
  /** Feet positions for the 8 garden items, in GARDEN_ITEMS order. */
  garden: Point[];
  /** Avatar width, % of map width. */
  avatarW: number;
  /** Multiplier for garden item widths. */
  gardenScale: number;
};

export type HomeTheme = {
  id: ThemeId;
  name: string;
  thumb: string;
  bg: string; // page background around the map
  wide: MapLayout;
  tall: MapLayout;
};

export const THEME_IDS = ["forest", "ocean", "sky", "room"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

const WIDE = 1344 / 752;
const TALL = 752 / 1344;
const wideBase = { ratio: WIDE, avatarW: 3.6, gardenScale: 0.5 };
const tallBase = { ratio: TALL, avatarW: 7.5, gardenScale: 1 };

const P = (x: number, y: number): Point => ({ x, y });

export const THEMES: Record<ThemeId, HomeTheme> = {
  forest: {
    id: "forest",
    name: "숲속 오두막",
    thumb: "/assets/home/forest-thumb.jpg",
    bg: "#2f4a2a",
    wide: {
      ...wideBase,
      src: "/assets/home/forest-wide.jpg",
      home: P(50, 42),
      spots: {
        easel: { box: { left: 12, top: 27, width: 18, height: 16 }, stand: P(24, 47) },
        mood: { box: { left: 67, top: 17, width: 8, height: 13 }, stand: P(70, 36) },
        bookshelf: { box: { left: 77, top: 24, width: 16, height: 30 }, stand: P(80, 58) },
        gallery: { box: { left: 1, top: 50, width: 32, height: 42 }, stand: P(37, 80) },
      },
      windows: [P(39, 26), P(60, 26), P(50, 10)],
      garden: [P(38, 55), P(62, 42), P(32, 44), P(44, 88), P(6, 40), P(57, 56), P(93, 62), P(72, 52)],
    },
    tall: {
      ...tallBase,
      src: "/assets/home/forest-tall.jpg",
      home: P(53, 30),
      spots: {
        easel: { box: { left: 5, top: 29, width: 33, height: 16 }, stand: P(30, 48) },
        mood: { box: { left: 78, top: 23, width: 13, height: 9 }, stand: P(75, 34) },
        bookshelf: { box: { left: 64, top: 39, width: 30, height: 17 }, stand: P(62, 58) },
        gallery: { box: { left: 1, top: 49, width: 47, height: 24 }, stand: P(55, 72) },
      },
      windows: [P(37, 22), P(52, 13)],
      garden: [P(45, 46), P(88, 36), P(38, 30), P(28, 78), P(90, 62), P(56, 42), P(80, 76), P(10, 44)],
    },
  },
  ocean: {
    id: "ocean",
    name: "깊은 바닷속",
    thumb: "/assets/home/ocean-thumb.jpg",
    bg: "#0d2b55",
    wide: {
      ...wideBase,
      src: "/assets/home/ocean-wide.jpg",
      home: P(51, 40),
      spots: {
        easel: { box: { left: 7, top: 27, width: 17, height: 15 }, stand: P(20, 44) },
        mood: { box: { left: 77, top: 11, width: 13, height: 12 }, stand: P(82, 27) },
        bookshelf: { box: { left: 81, top: 33, width: 15, height: 26 }, stand: P(86, 62) },
        gallery: { box: { left: 20, top: 63, width: 60, height: 30 }, stand: P(50, 92) },
      },
      windows: [],
      garden: [P(22, 42), P(64, 36), P(38, 37), P(40, 90), P(77, 58), P(72, 22), P(62, 92), P(18, 92)],
    },
    tall: {
      ...tallBase,
      src: "/assets/home/ocean-tall.jpg",
      home: P(52, 32),
      spots: {
        easel: { box: { left: 4, top: 29, width: 30, height: 17 }, stand: P(25, 47) },
        mood: { box: { left: 71, top: 24, width: 25, height: 11 }, stand: P(82, 36) },
        bookshelf: { box: { left: 66, top: 40, width: 28, height: 15 }, stand: P(75, 57) },
        gallery: { box: { left: 10, top: 63, width: 78, height: 25 }, stand: P(50, 88) },
      },
      windows: [],
      garden: [P(30, 45), P(68, 28), P(30, 28), P(30, 85), P(90, 55), P(72, 32), P(70, 86), P(8, 44)],
    },
  },
  sky: {
    id: "sky",
    name: "구름 위 하늘섬",
    thumb: "/assets/home/sky-thumb.jpg",
    bg: "#8f9ad8",
    wide: {
      ...wideBase,
      src: "/assets/home/sky-wide.jpg",
      home: P(51, 33),
      spots: {
        easel: { box: { left: 3, top: 27, width: 22, height: 20 }, stand: P(20, 52) },
        mood: { box: { left: 64, top: 62, width: 26, height: 28 }, stand: P(75, 88) },
        bookshelf: { box: { left: 74, top: 28, width: 24, height: 25 }, stand: P(82, 55) },
        gallery: { box: { left: 4, top: 56, width: 44, height: 40 }, stand: P(30, 88) },
      },
      windows: [P(46, 25), P(55, 25)],
      garden: [P(24, 49), P(62, 34), P(38, 33), P(20, 88), P(95, 52), P(66, 80), P(88, 88), P(44, 88)],
    },
    tall: {
      ...tallBase,
      src: "/assets/home/sky-tall.jpg",
      home: P(80, 29),
      spots: {
        easel: { box: { left: 4, top: 31, width: 36, height: 14 }, stand: P(28, 47) },
        mood: { box: { left: 60, top: 74, width: 36, height: 17 }, stand: P(76, 92) },
        bookshelf: { box: { left: 58, top: 42, width: 38, height: 18 }, stand: P(68, 61) },
        gallery: { box: { left: 1, top: 55, width: 45, height: 25 }, stand: P(25, 80) },
      },
      windows: [P(86, 25)],
      garden: [P(36, 46), P(92, 30), P(66, 28), P(20, 78), P(94, 55), P(45, 73), P(62, 92), P(10, 44)],
    },
  },
  room: {
    id: "room",
    name: "아늑한 내 방",
    thumb: "/assets/home/room-thumb.jpg",
    bg: "#4a3326",
    wide: {
      ...wideBase,
      src: "/assets/home/room-wide.jpg",
      home: P(50, 62),
      spots: {
        easel: { box: { left: 11, top: 27, width: 19, height: 15 }, stand: P(25, 47) },
        mood: { box: { left: 56, top: 15, width: 23, height: 25 }, stand: P(62, 45) },
        bookshelf: { box: { left: 87, top: 12, width: 12, height: 50 }, stand: P(84, 60) },
        gallery: { box: { left: 0, top: 52, width: 27, height: 45 }, stand: P(32, 85) },
      },
      windows: [],
      garden: [P(36, 40), P(47, 30), P(4, 45), P(62, 88), P(30, 96), P(52, 16), P(70, 52), P(80, 44)],
    },
    tall: {
      ...tallBase,
      src: "/assets/home/room-tall.jpg",
      home: P(50, 70),
      spots: {
        easel: { box: { left: 8, top: 24, width: 24, height: 16 }, stand: P(30, 43) },
        mood: { box: { left: 53, top: 24, width: 33, height: 15 }, stand: P(60, 45) },
        bookshelf: { box: { left: 79, top: 43, width: 20, height: 25 }, stand: P(75, 70) },
        gallery: { box: { left: 0, top: 47, width: 26, height: 40 }, stand: P(32, 80) },
      },
      windows: [],
      garden: [P(40, 44), P(36, 22), P(6, 42), P(62, 65), P(15, 96), P(60, 18), P(42, 72), P(90, 42)],
    },
  },
};

export const DEFAULT_THEME: ThemeId = "forest";

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === "string" && (THEME_IDS as readonly string[]).includes(v);
}
