import { pt, type Dictionary } from "./dictionaries/pt";
import { en } from "./dictionaries/en";
import { es } from "./dictionaries/es";
import { fr } from "./dictionaries/fr";
import type { Locale } from "./config";

const dictionaries: Record<Locale, Dictionary> = { pt, en, es, fr };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export type { Dictionary };
