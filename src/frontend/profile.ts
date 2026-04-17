import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { FrontendFeatureExpectation, FrontendValidationProfile } from "./types.js";

const featureExpectationSchema = z
  .union([z.enum(["required", "optional", "disabled"]), z.boolean()])
  .transform((value): FrontendFeatureExpectation => {
    if (value === true) return "required";
    if (value === false) return "disabled";
    return value;
  });

const profileSchema = z.object({
  service: z.literal("autocomplete").default("autocomplete"),
  trackerId: z.string().min(1).optional(),
  analyticsMode: z.enum(["any", "datalayer", "events-api"]).default("any"),
  features: z
    .object({
      autocomplete: featureExpectationSchema.optional(),
      topItems: featureExpectationSchema.optional(),
      trendingQueries: featureExpectationSchema.optional()
    })
    .default({})
});

interface FrontendValidationProfileInput {
  trackerId?: string;
  analyticsMode?: FrontendValidationProfile["analyticsMode"];
  features?: Partial<FrontendValidationProfile["features"]>;
}

export function defaultFrontendValidationProfile(): FrontendValidationProfile {
  return {
    service: "autocomplete",
    analyticsMode: "any",
    features: {
      autocomplete: "required",
      topItems: "optional",
      trendingQueries: "optional"
    }
  };
}

export async function loadFrontendValidationProfile(path: string): Promise<FrontendValidationProfile> {
  const raw = await readFile(path, "utf8");
  const parsed = profileSchema.parse(JSON.parse(raw));
  return normalizeFrontendValidationProfile({
    ...(parsed.trackerId ? { trackerId: parsed.trackerId } : {}),
    analyticsMode: parsed.analyticsMode,
    features: {
      ...(parsed.features.autocomplete ? { autocomplete: parsed.features.autocomplete } : {}),
      ...(parsed.features.topItems ? { topItems: parsed.features.topItems } : {}),
      ...(parsed.features.trendingQueries ? { trendingQueries: parsed.features.trendingQueries } : {})
    }
  });
}

export function normalizeFrontendValidationProfile(input: FrontendValidationProfileInput): FrontendValidationProfile {
  const defaults = defaultFrontendValidationProfile();

  return {
    service: "autocomplete",
    ...(input.trackerId ? { trackerId: input.trackerId } : {}),
    analyticsMode: input.analyticsMode ?? defaults.analyticsMode,
    features: {
      autocomplete: input.features?.autocomplete ?? defaults.features.autocomplete,
      topItems: input.features?.topItems ?? defaults.features.topItems,
      trendingQueries: input.features?.trendingQueries ?? defaults.features.trendingQueries
    }
  };
}

export function summarizeFrontendValidationProfile(profile: FrontendValidationProfile): string {
  const tracker = profile.trackerId ? ` trackerId=${profile.trackerId}` : "";
  return `service=${profile.service}; analyticsMode=${profile.analyticsMode}; autocomplete=${profile.features.autocomplete}; topItems=${profile.features.topItems}; trendingQueries=${profile.features.trendingQueries}${tracker}`;
}
