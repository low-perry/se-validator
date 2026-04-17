import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { FrontendFeatureExpectation, FrontendReviewService, FrontendValidationProfile } from "./types.js";

const featureExpectationSchema = z
  .union([z.enum(["required", "optional", "disabled"]), z.boolean()])
  .transform((value): FrontendFeatureExpectation => {
    if (value === true) return "required";
    if (value === false) return "disabled";
    return value;
  });

const profileSchema = z.object({
  service: z.enum(["autocomplete", "search"]).default("autocomplete"),
  trackerId: z.string().min(1).optional(),
  analyticsMode: z.enum(["any", "datalayer", "events-api"]).default("any"),
  features: z
    .object({
      autocomplete: featureExpectationSchema.optional(),
      search: featureExpectationSchema.optional(),
      topItems: featureExpectationSchema.optional(),
      trendingQueries: featureExpectationSchema.optional()
    })
    .default({}),
  search: z
    .object({
      expectedResultTypes: z.array(z.string().min(1)).optional()
    })
    .optional()
});

interface FrontendValidationProfileInput {
  service?: FrontendReviewService;
  trackerId?: string;
  analyticsMode?: FrontendValidationProfile["analyticsMode"];
  features?: Partial<FrontendValidationProfile["features"]>;
  search?: FrontendValidationProfile["search"];
}

export function defaultFrontendValidationProfile(): FrontendValidationProfile {
  return {
    service: "autocomplete",
    analyticsMode: "any",
    features: {
      autocomplete: "required",
      search: "disabled",
      topItems: "optional",
      trendingQueries: "optional"
    }
  };
}

export async function loadFrontendValidationProfile(path: string): Promise<FrontendValidationProfile> {
  const raw = await readFile(path, "utf8");
  const parsed = profileSchema.parse(JSON.parse(raw));
  return normalizeFrontendValidationProfile({
    service: parsed.service,
    ...(parsed.trackerId ? { trackerId: parsed.trackerId } : {}),
    analyticsMode: parsed.analyticsMode,
    features: {
      ...(parsed.features.autocomplete ? { autocomplete: parsed.features.autocomplete } : {}),
      ...(parsed.features.search ? { search: parsed.features.search } : {}),
      ...(parsed.features.topItems ? { topItems: parsed.features.topItems } : {}),
      ...(parsed.features.trendingQueries ? { trendingQueries: parsed.features.trendingQueries } : {})
    },
    ...(parsed.search ? { search: parsed.search } : {})
  });
}

export function normalizeFrontendValidationProfile(input: FrontendValidationProfileInput): FrontendValidationProfile {
  const defaults = defaultFrontendValidationProfile();
  const service = input.service ?? defaults.service;
  const serviceDefaults: FrontendValidationProfile["features"] =
    service === "search"
      ? {
          autocomplete: "disabled",
          search: "required",
          topItems: "disabled",
          trendingQueries: "disabled"
        }
      : defaults.features;

  return {
    service,
    ...(input.trackerId ? { trackerId: input.trackerId } : {}),
    analyticsMode: input.analyticsMode ?? defaults.analyticsMode,
    features: {
      autocomplete: input.features?.autocomplete ?? serviceDefaults.autocomplete,
      search: input.features?.search ?? serviceDefaults.search,
      topItems: input.features?.topItems ?? serviceDefaults.topItems,
      trendingQueries: input.features?.trendingQueries ?? serviceDefaults.trendingQueries
    },
    ...(input.search ? { search: input.search } : {})
  };
}

export function summarizeFrontendValidationProfile(profile: FrontendValidationProfile): string {
  const tracker = profile.trackerId ? ` trackerId=${profile.trackerId}` : "";
  const searchTypes = profile.search?.expectedResultTypes?.length
    ? `; searchTypes=${profile.search.expectedResultTypes.join(",")}`
    : "";
  return `service=${profile.service}; analyticsMode=${profile.analyticsMode}; autocomplete=${profile.features.autocomplete}; search=${profile.features.search}; topItems=${profile.features.topItems}; trendingQueries=${profile.features.trendingQueries}${searchTypes}${tracker}`;
}
