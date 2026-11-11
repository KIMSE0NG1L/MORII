import type { MetadataRoute } from "next";

// Lets people add Me:seum to their phone home screen as a full-screen app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Me:seum - 나의 작은 마음 공간",
    short_name: "Me:seum",
    description: "그림으로 마음을 돌보는 나만의 픽셀 공간",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#24452f",
    theme_color: "#24452f",
    lang: "ko",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
