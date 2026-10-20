import type { Dictionary } from "@/i18n";
import type { LightboxLabels } from "../Lightbox";

export function lightboxLabels(dict: Dictionary): LightboxLabels {
  return {
    gallery: dict.gallery.title,
    close: dict.a11y.closeGallery,
    previous: dict.a11y.previousImage,
    next: dict.a11y.nextImage,
    open: dict.a11y.openImage,
  };
}
