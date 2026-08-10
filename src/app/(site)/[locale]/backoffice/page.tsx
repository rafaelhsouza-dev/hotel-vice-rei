import { permanentRedirect } from "next/navigation";

/**
 * The mock backoffice demo lived here. The real one is at /admin, outside the
 * localised tree, so old links land in the right place.
 */
export default function LegacyBackofficePage() {
  permanentRedirect("/admin");
}
