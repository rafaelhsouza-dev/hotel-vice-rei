import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hotel Vice-Rei · Porto",
    short_name: "Vice-Rei",
    description:
      "Hotel clássico no Centro de Negócios do Porto. Reserve directamente com o melhor preço garantido.",
    start_url: "/pt",
    display: "standalone",
    background_color: "#faf7f2",
    theme_color: "#14110f",
    lang: "pt-PT",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
