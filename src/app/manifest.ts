import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/pt",
    name: "Hotel Vice-Rei · Porto",
    short_name: "Vice-Rei",
    description:
      "Hotel de 2 estrelas na Rua Júlio Dinis, no Porto. Reserve directamente no site oficial.",
    start_url: "/pt",
    scope: "/",
    display: "standalone",
    background_color: "#faf7f2",
    theme_color: "#14110f",
    lang: "pt-PT",
    // The only icon files are full-width wordmarks: the logo reaches beyond the
    // maskable safe zone (80% circle), so no icon is declared "maskable".
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
