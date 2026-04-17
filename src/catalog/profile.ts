import { readFile } from "node:fs/promises";
import { z } from "zod";

export type CatalogExpectedSource = "auto" | "feed-xml" | "feed-json" | "content-update-json";
export type CatalogObjectType = string;
export type CatalogCategoryModel =
  | "auto"
  | "none"
  | "category_paths"
  | "nested_categories"
  | "independent_categories_with_pairing"
  | "independent_categories_with_matching_hierarchy";
export type CatalogVariantModel = "auto" | "none" | "item_group_id" | "nested_variants";
export type CatalogMultipleCategoryHierarchies = "allowed" | "expected" | "disallowed";
export type CatalogPrimaryCategoryMode = "auto" | "required_when_multiple" | "not_required";

export interface CatalogValidationProfile {
  expectedSource: CatalogExpectedSource;
  expectedObjectTypes: CatalogObjectType[];
  categoryModel: CatalogCategoryModel;
  variantModel: CatalogVariantModel;
  identity: {
    uniqueAcrossTypes: boolean;
    immutableIdentityField: string;
  };
  requiredFieldsByType: {
    [objectType: string]: string[];
  };
  multipleCategoryHierarchies: CatalogMultipleCategoryHierarchies;
  primaryCategory: CatalogPrimaryCategoryMode;
}

const catalogProfileSchema = z.object({
  expectedSource: z.enum(["auto", "feed-xml", "feed-json", "content-update-json"]).default("auto"),
  expectedObjectTypes: z.array(z.string().min(1)).default([]),
  categoryModel: z
    .enum([
      "auto",
      "none",
      "category_paths",
      "nested_categories",
      "independent_categories_with_pairing",
      "independent_categories_with_matching_hierarchy"
    ])
    .default("auto"),
  variantModel: z.enum(["auto", "none", "item_group_id", "nested_variants"]).default("auto"),
  identity: z
    .object({
      uniqueAcrossTypes: z.boolean().default(true),
      immutableIdentityField: z.string().min(1).default("identity")
    })
    .default({
      uniqueAcrossTypes: true,
      immutableIdentityField: "identity"
    }),
  requiredFieldsByType: z
    .object({
      item: z.array(z.string().min(1)).default([]),
      category: z.array(z.string().min(1)).default([]),
      brand: z.array(z.string().min(1)).default([]),
      article: z.array(z.string().min(1)).default([])
    })
    .catchall(z.array(z.string().min(1)))
    .default({
      item: [],
      category: [],
      brand: [],
      article: []
    }),
  multipleCategoryHierarchies: z.enum(["allowed", "expected", "disallowed"]).default("allowed"),
  primaryCategory: z.enum(["auto", "required_when_multiple", "not_required"]).default("auto")
});

export function defaultCatalogValidationProfile(): CatalogValidationProfile {
  return {
    expectedSource: "auto",
    expectedObjectTypes: [],
    categoryModel: "auto",
    variantModel: "auto",
    identity: {
      uniqueAcrossTypes: true,
      immutableIdentityField: "identity"
    },
    requiredFieldsByType: {
      item: [],
      category: [],
      brand: [],
      article: []
    },
    multipleCategoryHierarchies: "allowed",
    primaryCategory: "auto"
  };
}

export async function loadCatalogValidationProfile(path: string): Promise<CatalogValidationProfile> {
  const raw = await readFile(path, "utf8");
  return catalogProfileSchema.parse(JSON.parse(raw));
}

export function summarizeCatalogValidationProfile(profile: CatalogValidationProfile): string {
  return [
    `source=${profile.expectedSource}`,
    `objects=${profile.expectedObjectTypes.join(",") || "none"}`,
    `categoryModel=${profile.categoryModel}`,
    `variantModel=${profile.variantModel}`,
    `multipleCategoryHierarchies=${profile.multipleCategoryHierarchies}`,
    `primaryCategory=${profile.primaryCategory}`,
    `identityField=${profile.identity.immutableIdentityField}`,
    `uniqueAcrossTypes=${profile.identity.uniqueAcrossTypes}`
  ].join("; ");
}
