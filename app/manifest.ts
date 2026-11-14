import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kori — Personal Economic Trainer",
    short_name: "Kori",
    description: "Your money in three baskets, and what is safe to spend this week.",
    id: "/",
    start_url: "/",
    display: "standalone",
    background_color: "#f9f9f7",
    theme_color: "#2a78d6",
    orientation: "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
