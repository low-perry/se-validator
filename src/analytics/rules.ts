import { createFinding } from "../core/findings.js";
import type { ValidationFinding } from "../core/types.js";
import { isRecord } from "../catalog/detect.js";
import type { AnalyticsArtifact, AnalyticsEvent } from "./types.js";

export type AnalyticsRule = (artifacts: AnalyticsArtifact[]) => ValidationFinding[];

export const analyticsRules: AnalyticsRule[] = [
  validateParseErrors,
  validateEventEnvelope,
  validateDuplicateEventIds,
  validateEventPayloads
];

const knownListNames = ["Search Results", "Autocomplete", "Product Listing", "Recommendation"] as const;
const knownItemTypes = ["item", "product", "category", "brand", "article", "query"] as const;

function validateParseErrors(artifacts: AnalyticsArtifact[]): ValidationFinding[] {
  return artifacts.flatMap((artifact) => {
    if (!artifact.parseError) return [];

    return createFinding({
      id: "ANALYTICS_ARTIFACT_PARSE_ERROR",
      severity: "P0",
      area: "analytics",
      title: "Analytics artifact could not be parsed",
      message: artifact.parseError,
      evidencePath: artifact.path,
      remediation: "Provide an Events API JSON object, an array of Events API objects, or an object with events[].",
      docs: ["analytics/api/events"],
      confidence: 0.98
    });
  });
}

function validateEventEnvelope(artifacts: AnalyticsArtifact[]): ValidationFinding[] {
  return artifacts.flatMap((artifact) =>
    artifact.events.flatMap((event) => {
      if (!isRecord(event.payload)) {
        return analyticsFinding({
          id: "ANALYTICS_EVENT_NOT_OBJECT",
          severity: "P0",
          title: "Analytics event is not a JSON object",
          message: "Every Events API payload must be a JSON object.",
          evidencePath: eventPath(event),
          remediation: "Send each event as an object with type, id, tracker_id, client_id, and the event-specific payload.",
          confidence: 0.98
        });
      }

      const findings: ValidationFinding[] = [];
      const missing = requiredEnvelopeFields(event.payload);
      if (missing.length > 0) {
        findings.push(
          analyticsFinding({
            id: "ANALYTICS_EVENT_ENVELOPE_MISSING",
            severity: "P0",
            title: "Analytics event is missing required envelope fields",
            message: `${eventLabel(event)} is missing ${missing.join(", ")}.`,
            evidencePath: eventPath(event),
            remediation: "Every Events API payload must include type, globally unique id, tracker_id, and stable client_id.",
            confidence: 0.96
          })
        );
      }

      if (event.kind === "unknown") {
        findings.push(
          analyticsFinding({
            id: "ANALYTICS_EVENT_TYPE_UNKNOWN",
            severity: "P0",
            title: "Analytics event type is unknown",
            message: `${eventLabel(event)} uses unsupported type "${String(event.payload.type)}".`,
            evidencePath: `${eventPath(event)}.type`,
            remediation: "Use one of the Events API event types: pv, event, click, or transaction.",
            confidence: 0.96
          })
        );
      }

      findings.push(...validateLocalTimestamp(event));
      findings.push(...validateOptionalEnvelopeFields(event));
      return findings;
    })
  );
}

function validateDuplicateEventIds(artifacts: AnalyticsArtifact[]): ValidationFinding[] {
  const seen = new Map<string, AnalyticsEvent>();
  const findings: ValidationFinding[] = [];

  for (const event of artifacts.flatMap((artifact) => artifact.events)) {
    if (!isRecord(event.payload) || typeof event.payload.id !== "string" || event.payload.id.trim() === "") continue;

    const id = event.payload.id.trim();
    const first = seen.get(id);
    if (!first) {
      seen.set(id, event);
      continue;
    }

    findings.push(
      analyticsFinding({
        id: "ANALYTICS_EVENT_ID_DUPLICATE",
        severity: "P1",
        title: "Analytics event id is reused in the evidence",
        message: `Event id "${id}" appears in both ${eventLabel(first)} and ${eventLabel(event)}.`,
        evidencePath: `${eventPath(event)}.id`,
        remediation: "Generate a fresh globally unique id for every emitted analytics event.",
        confidence: 0.95
      })
    );
  }

  return findings;
}

function validateEventPayloads(artifacts: AnalyticsArtifact[]): ValidationFinding[] {
  return artifacts.flatMap((artifact) =>
    artifact.events.flatMap((event) => {
      if (!isRecord(event.payload) || event.kind === "unknown") return [];

      if (event.kind === "pv") return validatePageView(event);
      if (event.kind === "event") return validateListEvent(event);
      if (event.kind === "click") return validateClickEvent(event);
      return validateTransactionEvent(event);
    })
  );
}

function validatePageView(event: AnalyticsEvent): ValidationFinding[] {
  if (!isRecord(event.payload)) return [];
  const findings: ValidationFinding[] = [];

  if ("title" in event.payload && !isNonEmptyString(event.payload.title)) {
    findings.push(
      analyticsFinding({
        id: "ANALYTICS_PAGEVIEW_TITLE_INVALID",
        severity: "P2",
        title: "Pageview title has invalid type",
        message: `${eventLabel(event)} sends title, but it is not a non-empty string.`,
        evidencePath: `${eventPath(event)}.title`,
        remediation: "Omit title or send the human-readable page/object title as a string.",
        confidence: 0.88
      })
    );
  }

  if (isNonEmptyString(event.payload.url)) return findings;

  findings.push(
    analyticsFinding({
        id: "ANALYTICS_PAGEVIEW_URL_MISSING",
        severity: "P0",
        title: "Pageview event is missing url",
        message: `${eventLabel(event)} must include url with the viewed object identity or canonical page URL.`,
        evidencePath: `${eventPath(event)}.url`,
        remediation: "For product/detail pages, set url to the same object identity used in the catalog. For generic pages, use the canonical URL or path.",
        confidence: 0.95
      })
  );

  return findings;
}

function validateListEvent(event: AnalyticsEvent): ValidationFinding[] {
  if (!isRecord(event.payload)) return [];

  if (!isRecord(event.payload.lists)) {
    return [
      analyticsFinding({
        id: "ANALYTICS_LISTS_MISSING",
        severity: "P0",
        title: "List event is missing lists",
        message: `${eventLabel(event)} must include a lists object.`,
        evidencePath: `${eventPath(event)}.lists`,
        remediation: "Send result-list analytics as type=event with lists.Search Results, lists.Autocomplete, lists.Product Listing, or lists.Recommendation.",
        confidence: 0.96
      })
    ];
  }

  const listEntries = Object.entries(event.payload.lists);
  const findings: ValidationFinding[] = [];

  if (listEntries.length === 0) {
    findings.push(
      analyticsFinding({
        id: "ANALYTICS_LISTS_EMPTY",
        severity: "P0",
        title: "List event has no reported lists",
        message: `${eventLabel(event)} has an empty lists object.`,
        evidencePath: `${eventPath(event)}.lists`,
        remediation: "Report the visible Search Results, Autocomplete, Product Listing, or Recommendation list.",
        confidence: 0.95
      })
    );
  }

  for (const [listName, list] of listEntries) {
    if (!isKnownListName(listName)) {
      findings.push(
        analyticsFinding({
          id: "ANALYTICS_LIST_NAME_UNRECOGNIZED",
          severity: "P1",
          title: "List name is not a recognized Events API list",
          message: `${eventLabel(event)} reports "${listName}", but Events API list names are case-sensitive.`,
          evidencePath: `${eventPath(event)}.lists.${jsonPathKey(listName)}`,
          remediation: "Use exactly Search Results, Autocomplete, Product Listing, or Recommendation.",
          confidence: 0.9
        })
      );
      continue;
    }

    if (!isRecord(list)) {
      findings.push(
        analyticsFinding({
          id: "ANALYTICS_LIST_SHAPE_INVALID",
          severity: "P0",
          title: "Analytics list is not an object",
          message: `${eventLabel(event)} list "${listName}" must be a JSON object.`,
          evidencePath: `${eventPath(event)}.lists.${jsonPathKey(listName)}`,
          remediation: "Each list should contain items and query metadata.",
          confidence: 0.95
        })
      );
      continue;
    }

    findings.push(...validateItems(event, listName, list));
    findings.push(...validateListQuery(event, listName, list));
  }

  return findings;
}

function validateItems(event: AnalyticsEvent, listName: string, list: Record<string, unknown>): ValidationFinding[] {
  if (!Array.isArray(list.items)) {
    return [
      analyticsFinding({
        id: "ANALYTICS_LIST_ITEMS_MISSING",
        severity: "P0",
        title: "Analytics list is missing items",
        message: `${eventLabel(event)} list "${listName}" must include items[]. Empty arrays are valid for no-result searches.`,
        evidencePath: listPath(event, listName, "items"),
        remediation: "Send the final visible result list. For zero-result searches or autocomplete, send items as an empty array.",
        confidence: 0.95
      })
    ];
  }

  const findings: ValidationFinding[] = [];
  const positions = new Set<number>();
  let previousPosition = 0;

  list.items.forEach((item, index) => {
    const basePath = `${listPath(event, listName, "items")}[${index}]`;
    if (!isRecord(item)) {
      findings.push(
        analyticsFinding({
          id: "ANALYTICS_LIST_ITEM_SHAPE_INVALID",
          severity: "P1",
          title: "Analytics list item is not an object",
          message: `${eventLabel(event)} list "${listName}" has a non-object item at index ${index}.`,
          evidencePath: basePath,
          remediation: "Each list item should include title, type, url, and position.",
          confidence: 0.94
        })
      );
      return;
    }

    const missing = ["title", "type", "url", "position"].filter((field) => {
      if (field === "position") return !isPositiveInteger(item.position);
      return !isNonEmptyString(item[field]);
    });

    if (missing.length > 0) {
      findings.push(
        analyticsFinding({
          id: "ANALYTICS_LIST_ITEM_FIELDS_MISSING",
          severity: "P1",
          title: "Analytics list item is missing required fields",
          message: `${eventLabel(event)} list "${listName}" item ${index} is missing or has invalid ${missing.join(", ")}.`,
          evidencePath: basePath,
          remediation: "Report every visible list item with title, type, url matching catalog identity, and a positive integer position.",
          confidence: 0.92
        })
      );
    }

    if (isNonEmptyString(item.type) && !isKnownItemType(item.type)) {
      findings.push(
        analyticsFinding({
          id: "ANALYTICS_LIST_ITEM_TYPE_UNRECOGNIZED",
          severity: "P2",
          title: "Analytics list item type is not recognized",
          message: `${eventLabel(event)} list "${listName}" item ${index} uses type "${item.type}".`,
          evidencePath: `${basePath}.type`,
          remediation: "Use a catalog object type such as item, category, brand, article, or query. If this is a custom type, confirm it matches the indexed catalog type.",
          confidence: 0.78
        })
      );
    }

    if (isPositiveInteger(item.position)) {
      if (positions.has(item.position)) {
        findings.push(
          analyticsFinding({
            id: "ANALYTICS_LIST_POSITION_DUPLICATE",
            severity: "P1",
            title: "Analytics list has duplicate item positions",
            message: `${eventLabel(event)} list "${listName}" repeats position ${item.position}.`,
            evidencePath: `${basePath}.position`,
            remediation: "Use absolute, unique positions from the full result set for every visible item.",
            confidence: 0.92
          })
        );
      }

      if (item.position <= previousPosition) {
        findings.push(
          analyticsFinding({
            id: "ANALYTICS_LIST_POSITION_NOT_INCREASING",
            severity: "P2",
            title: "Analytics list positions are not increasing",
            message: `${eventLabel(event)} list "${listName}" item ${index} has position ${item.position} after ${previousPosition}.`,
            evidencePath: `${basePath}.position`,
            remediation: "Keep item positions in visible order and make them absolute across pagination.",
            confidence: 0.86
          })
        );
      }

      positions.add(item.position);
      previousPosition = item.position;
    }

    if ("price" in item && !isNonNegativeNumber(item.price)) {
      findings.push(
        analyticsFinding({
          id: "ANALYTICS_LIST_ITEM_PRICE_INVALID",
          severity: "P2",
          title: "Analytics list item price is invalid",
          message: `${eventLabel(event)} list "${listName}" item ${index} has a non-numeric or negative price.`,
          evidencePath: `${basePath}.price`,
          remediation: "Send price as a non-negative number when reporting it.",
          confidence: 0.88
        })
      );
    }
  });

  return findings;
}

function validateListQuery(event: AnalyticsEvent, listName: string, list: Record<string, unknown>): ValidationFinding[] {
  const findings = validateListFilters(event, listName, list);

  if (listName === "Search Results" || listName === "Autocomplete") {
    findings.push(...validateSearchLikeQuery(event, listName, list));
    return findings;
  }

  if (listName === "Product Listing") {
    findings.push(...validateProductListingQuery(event, listName, list));
    return findings;
  }

  findings.push(...validateRecommendationQuery(event, listName, list));
  return findings;
}

function validateListFilters(event: AnalyticsEvent, listName: string, list: Record<string, unknown>): ValidationFinding[] {
  if (!isRecord(list.query) || !("filters" in list.query)) return [];

  if (!isRecord(list.query.filters)) {
    return [
      analyticsFinding({
        id: "ANALYTICS_LIST_FILTERS_INVALID",
        severity: "P1",
        title: "Analytics list filters are not an object",
        message: `${eventLabel(event)} list "${listName}" sends query.filters, but it is not an object.`,
        evidencePath: listPath(event, listName, "query.filters"),
        remediation: "Send filters as an object where keys are active filter names and values are strings, numbers, booleans, or arrays of those primitive values.",
        confidence: 0.9
      })
    ];
  }

  const findings: ValidationFinding[] = [];
  const filters = list.query.filters;

  for (const [key, value] of Object.entries(filters)) {
    if (!isFilterValue(value)) {
      findings.push(
        analyticsFinding({
          id: "ANALYTICS_LIST_FILTER_VALUE_INVALID",
          severity: "P1",
          title: "Analytics list filter has invalid value",
          message: `${eventLabel(event)} list "${listName}" filter "${key}" is not a primitive value or array of primitive values.`,
          evidencePath: `${listPath(event, listName, "query.filters")}.${jsonPathKey(key)}`,
          remediation: "Send active filters exactly as user-visible primitive values. Use arrays for multi-select filters.",
          confidence: 0.86
        })
      );
    }
  }

  for (const reservedKey of ["_Guid", "_Variant"]) {
    if (reservedKey in filters && !isNonEmptyString(filters[reservedKey])) {
      findings.push(
        analyticsFinding({
          id: "ANALYTICS_RESERVED_FILTER_INVALID",
          severity: "P1",
          title: "Reserved analytics filter has invalid value",
          message: `${eventLabel(event)} list "${listName}" sends ${reservedKey}, but it is not a non-empty string.`,
          evidencePath: `${listPath(event, listName, "query.filters")}.${reservedKey}`,
          remediation: `Send ${reservedKey} as a non-empty string, or omit it when it is not available.`,
          confidence: 0.9
        })
      );
    }
  }

  return findings;
}

function validateSearchLikeQuery(event: AnalyticsEvent, listName: string, list: Record<string, unknown>): ValidationFinding[] {
  const findings: ValidationFinding[] = [];

  if (!isRecord(list.query) || !isNonEmptyString(list.query.string)) {
    findings.push(
      analyticsFinding({
        id: "ANALYTICS_LIST_QUERY_STRING_MISSING",
        severity: "P0",
        title: "Search-like analytics list is missing query.string",
        message: `${eventLabel(event)} list "${listName}" must include the user's query string.`,
        evidencePath: listPath(event, listName, "query.string"),
        remediation: "Set query.string to the exact search term or autocomplete text the user entered, even when there are no results.",
        confidence: 0.95
      })
    );
  }

  if (Array.isArray(list.items) && list.items.length > 0 && !hasFilterKey(list.query, "_Guid")) {
    findings.push(
      analyticsFinding({
        id: "ANALYTICS_LIST_RESPONSE_GUID_MISSING",
        severity: "P2",
        title: "Result-list analytics is missing response guid",
        message: `${eventLabel(event)} list "${listName}" has visible items but no query.filters._Guid.`,
        evidencePath: listPath(event, listName, "query.filters._Guid"),
        remediation: "When the search or autocomplete response provides a guid, copy it into query.filters._Guid so later clicks and conversions can be attributed to the returned result set.",
        confidence: 0.75
      })
    );
  }

  return findings;
}

function validateProductListingQuery(event: AnalyticsEvent, listName: string, list: Record<string, unknown>): ValidationFinding[] {
  const findings: ValidationFinding[] = [];

  if (!isRecord(list.query) || !isRecord(list.query.scopes)) {
    findings.push(
      analyticsFinding({
        id: "ANALYTICS_PRODUCT_LISTING_SCOPE_MISSING",
        severity: "P1",
        title: "Product Listing analytics is missing scope",
        message: `${eventLabel(event)} must identify the category, brand, or listing context.`,
        evidencePath: listPath(event, listName, "query.scopes"),
        remediation: "Send query.scopes with _category_label and _category_identity for category pages, or _brand_label and _brand_identity for brand pages.",
        confidence: 0.9
      })
    );
  } else {
    const scopes = list.query.scopes;
    const hasCategoryScope = isNonEmptyString(scopes._category_label) && isNonEmptyString(scopes._category_identity);
    const hasBrandScope = isNonEmptyString(scopes._brand_label) && isNonEmptyString(scopes._brand_identity);

    if (!hasCategoryScope && !hasBrandScope) {
      findings.push(
        analyticsFinding({
          id: "ANALYTICS_PRODUCT_LISTING_SCOPE_INCOMPLETE",
          severity: "P1",
          title: "Product Listing analytics scope is incomplete",
          message: `${eventLabel(event)} does not provide a complete category or brand scope.`,
          evidencePath: listPath(event, listName, "query.scopes"),
          remediation: "Provide both label and identity for the listing context, for example _category_label plus _category_identity.",
          confidence: 0.9
        })
      );
    }
  }

  if (Array.isArray(list.items) && list.items.length > 0 && !hasFilterKey(list.query, "_Guid")) {
    findings.push(
      analyticsFinding({
        id: "ANALYTICS_LIST_RESPONSE_GUID_MISSING",
        severity: "P2",
        title: "Product-listing analytics is missing response guid",
        message: `${eventLabel(event)} list "${listName}" has visible items but no query.filters._Guid.`,
        evidencePath: listPath(event, listName, "query.filters._Guid"),
        remediation: "When the listing API response provides a guid, copy it into query.filters._Guid so engagement can be attributed to the returned list.",
        confidence: 0.72
      })
    );
  }

  return findings;
}

function validateRecommendationQuery(event: AnalyticsEvent, listName: string, list: Record<string, unknown>): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const filters = isRecord(list.query) && isRecord(list.query.filters) ? list.query.filters : undefined;

  if (!filters || !isNonEmptyString(filters.RecommenderClientId)) {
    findings.push(
      analyticsFinding({
        id: "ANALYTICS_RECOMMENDER_CLIENT_ID_MISSING",
        severity: "P0",
        title: "Recommendation analytics is missing RecommenderClientId",
        message: `${eventLabel(event)} list "${listName}" must identify the recommender placement.`,
        evidencePath: listPath(event, listName, "query.filters.RecommenderClientId"),
        remediation: "Set query.filters.RecommenderClientId to a stable placement name such as homepage_top or item_detail_alternatives.",
        confidence: 0.94
      })
    );
  }

  if (!filters || !isNonEmptyString(filters.RecommendationId)) {
    findings.push(
      analyticsFinding({
        id: "ANALYTICS_RECOMMENDATION_ID_MISSING",
        severity: "P1",
        title: "Recommendation analytics is missing RecommendationId",
        message: `${eventLabel(event)} list "${listName}" does not include the returned recommendation set id.`,
        evidencePath: listPath(event, listName, "query.filters.RecommendationId"),
        remediation: "For new integrations, copy the recommendation response identifier into query.filters.RecommendationId.",
        confidence: 0.86
      })
    );
  }

  if (filters) {
    findings.push(...validateRecommendationFilterTypes(event, listName, filters));
  }

  return findings;
}

function validateRecommendationFilterTypes(
  event: AnalyticsEvent,
  listName: string,
  filters: Record<string, unknown>
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];

  for (const key of ["Recommender", "Type"]) {
    if (key in filters && !isNonEmptyString(filters[key])) {
      findings.push(
        analyticsFinding({
          id: "ANALYTICS_RECOMMENDATION_FILTER_INVALID",
          severity: "P1",
          title: "Recommendation filter has invalid value",
          message: `${eventLabel(event)} list "${listName}" sends ${key}, but it is not a non-empty string.`,
          evidencePath: `${listPath(event, listName, "query.filters")}.${key}`,
          remediation: `Send ${key} as the non-empty value returned by the recommendation response, or omit it if unavailable.`,
          confidence: 0.88
        })
      );
    }
  }

  if ("ItemIds" in filters && !isIdentifierArray(filters.ItemIds)) {
    findings.push(
      analyticsFinding({
        id: "ANALYTICS_RECOMMENDATION_ITEM_IDS_INVALID",
        severity: "P1",
        title: "Recommendation ItemIds filter is invalid",
        message: `${eventLabel(event)} list "${listName}" sends ItemIds, but it is not an array of object identities.`,
        evidencePath: `${listPath(event, listName, "query.filters")}.ItemIds`,
        remediation: "Send ItemIds as an array of the input object identities used to generate the recommendation.",
        confidence: 0.88
      })
    );
  }

  if (
    filters.RecommenderClientId === "autocomplete_popup" &&
    "Recommender" in filters &&
    filters.Recommender !== "autocomplete_popup"
  ) {
    findings.push(
      analyticsFinding({
        id: "ANALYTICS_AUTOCOMPLETE_TOP_ITEMS_RECOMMENDER_MISMATCH",
        severity: "P2",
        title: "Autocomplete Top Items recommender metadata is inconsistent",
        message: `${eventLabel(event)} identifies autocomplete Top Items with RecommenderClientId=autocomplete_popup but Recommender is different.`,
        evidencePath: `${listPath(event, listName, "query.filters")}.Recommender`,
        remediation: "When tracking empty-state autocomplete Top Items as a Recommendation list, set both Recommender and RecommenderClientId to autocomplete_popup.",
        confidence: 0.78
      })
    );
  }

  return findings;
}

function validateClickEvent(event: AnalyticsEvent): ValidationFinding[] {
  if (!isRecord(event.payload)) return [];

  if (!isRecord(event.payload.action)) {
    return [
      analyticsFinding({
        id: "ANALYTICS_CLICK_ACTION_MISSING",
        severity: "P0",
        title: "Click or conversion event is missing action",
        message: `${eventLabel(event)} must include action.type and action.resource_identifier.`,
        evidencePath: `${eventPath(event)}.action`,
        remediation: "For normal clicks use action.type=click. For micro-conversions use action.type such as add-to-cart and keep resource_identifier aligned with the catalog identity.",
        confidence: 0.95
      })
    ];
  }

  const action = event.payload.action;
  const missing = ["type", "resource_identifier"].filter((field) => !isNonEmptyString(action[field]));
  if (missing.length === 0) return [];

  return [
    analyticsFinding({
      id: "ANALYTICS_CLICK_ACTION_FIELDS_MISSING",
      severity: "P0",
      title: "Click or conversion action is incomplete",
      message: `${eventLabel(event)} action is missing ${missing.join(", ")}.`,
      evidencePath: `${eventPath(event)}.action`,
      remediation: "Send action.type and action.resource_identifier. For result clicks, resource_identifier must match the clicked item's url from the previously reported list.",
      confidence: 0.95
    })
  ];
}

function validateTransactionEvent(event: AnalyticsEvent): ValidationFinding[] {
  if (!isRecord(event.payload)) return [];

  if (!Array.isArray(event.payload.items) || event.payload.items.length === 0) {
    return [
      analyticsFinding({
        id: "ANALYTICS_TRANSACTION_ITEMS_MISSING",
        severity: "P0",
        title: "Transaction event is missing purchased items",
        message: `${eventLabel(event)} must include every purchased line item in items[].`,
        evidencePath: `${eventPath(event)}.items`,
        remediation: "Send transaction.items with url, count, and total_price for every item in the completed order.",
        confidence: 0.95
      })
    ];
  }

  const findings: ValidationFinding[] = [];

  event.payload.items.forEach((item, index) => {
    const basePath = `${eventPath(event)}.items[${index}]`;
    if (!isRecord(item)) {
      findings.push(
        analyticsFinding({
          id: "ANALYTICS_TRANSACTION_ITEM_SHAPE_INVALID",
          severity: "P1",
          title: "Transaction item is not an object",
          message: `${eventLabel(event)} transaction item ${index} is not a JSON object.`,
          evidencePath: basePath,
          remediation: "Each transaction line item should be an object with url, count, and total_price.",
          confidence: 0.94
        })
      );
      return;
    }

    const missing = [
      !isNonEmptyString(item.url) ? "url" : undefined,
      !isPositiveInteger(item.count) ? "count" : undefined,
      !isNonNegativeNumber(item.total_price) ? "total_price" : undefined
    ].filter((field): field is string => Boolean(field));

    if (missing.length > 0) {
      findings.push(
        analyticsFinding({
          id: "ANALYTICS_TRANSACTION_ITEM_FIELDS_INVALID",
          severity: "P1",
          title: "Transaction item has invalid required fields",
          message: `${eventLabel(event)} transaction item ${index} is missing or has invalid ${missing.join(", ")}.`,
          evidencePath: basePath,
          remediation: "Use catalog identity in url, a positive integer count, and a non-negative numeric total_price for every transaction line item.",
          confidence: 0.92
        })
      );
    }

    if ("title" in item && !isNonEmptyString(item.title)) {
      findings.push(
        analyticsFinding({
          id: "ANALYTICS_TRANSACTION_ITEM_TITLE_INVALID",
          severity: "P2",
          title: "Transaction item title has invalid type",
          message: `${eventLabel(event)} transaction item ${index} sends title, but it is not a non-empty string.`,
          evidencePath: `${basePath}.title`,
          remediation: "Omit title or send the purchased item title as a string.",
          confidence: 0.88
        })
      );
    }

    for (const field of ["was_discounted", "was_volume_discounted"]) {
      if (field in item && typeof item[field] !== "boolean") {
        findings.push(
          analyticsFinding({
            id: "ANALYTICS_TRANSACTION_DISCOUNT_FLAG_INVALID",
            severity: "P2",
            title: "Transaction discount flag is not boolean",
            message: `${eventLabel(event)} transaction item ${index} has non-boolean ${field}.`,
            evidencePath: `${basePath}.${field}`,
            remediation: "Send discount flags as booleans when they are present.",
            confidence: 0.9
          })
        );
      }
    }
  });

  return findings;
}

function validateOptionalEnvelopeFields(event: AnalyticsEvent): ValidationFinding[] {
  if (!isRecord(event.payload)) return [];

  const findings: ValidationFinding[] = [];
  const payload = event.payload;

  if ("client_id" in payload && !isStringOrIntegerIdentifier(payload.client_id)) {
    findings.push(optionalEnvelopeFinding(event, "client_id", "client_id must be a non-empty string or integer."));
  }

  if ("customer_id" in payload && !isStringOrIntegerIdentifier(payload.customer_id)) {
    findings.push(optionalEnvelopeFinding(event, "customer_id", "customer_id must be a non-empty string or integer."));
  }

  for (const field of ["user_agent", "referer", "ab_test_variant", "recommendation_id"]) {
    if (field in payload && !isNonEmptyString(payload[field])) {
      findings.push(optionalEnvelopeFinding(event, field, `${field} must be a non-empty string when present.`));
    }
  }

  if ("platform" in payload && !isPlatformValue(payload.platform)) {
    findings.push(optionalEnvelopeFinding(event, "platform", "platform must be a string or an array of non-empty strings."));
  }

  if ("context" in payload && !isRecord(payload.context)) {
    findings.push(optionalEnvelopeFinding(event, "context", "context must be an object when present."));
  }

  if ("consent_granted" in payload && typeof payload.consent_granted !== "boolean") {
    findings.push(optionalEnvelopeFinding(event, "consent_granted", "consent_granted must be boolean when present."));
  }

  return findings;
}

function validateLocalTimestamp(event: AnalyticsEvent): ValidationFinding[] {
  if (!isRecord(event.payload) || !("local_timestamp" in event.payload)) return [];

  const localTimestamp = event.payload.local_timestamp;

  if (!Number.isInteger(localTimestamp)) {
    return [
      analyticsFinding({
        id: "ANALYTICS_LOCAL_TIMESTAMP_INVALID",
        severity: "P1",
        title: "Analytics local_timestamp is not an integer",
        message: `${eventLabel(event)} sends local_timestamp as ${typeof localTimestamp}.`,
        evidencePath: `${eventPath(event)}.local_timestamp`,
        remediation: "Send local_timestamp as a UNIX timestamp in seconds, or omit it.",
        confidence: 0.94
      })
    ];
  }

  if (typeof localTimestamp === "number" && localTimestamp > 9_999_999_999) {
    return [
      analyticsFinding({
        id: "ANALYTICS_LOCAL_TIMESTAMP_MILLISECONDS",
        severity: "P1",
        title: "Analytics local_timestamp appears to be milliseconds",
        message: `${eventLabel(event)} sends local_timestamp=${localTimestamp}, which is too large for UNIX seconds.`,
        evidencePath: `${eventPath(event)}.local_timestamp`,
        remediation: "Convert JavaScript millisecond timestamps with Math.floor(Date.now() / 1000) before sending them.",
        confidence: 0.95
      })
    ];
  }

  if (typeof localTimestamp === "number" && localTimestamp <= 0) {
    return [
      analyticsFinding({
        id: "ANALYTICS_LOCAL_TIMESTAMP_INVALID",
        severity: "P1",
        title: "Analytics local_timestamp is not a valid UNIX timestamp",
        message: `${eventLabel(event)} sends local_timestamp=${localTimestamp}.`,
        evidencePath: `${eventPath(event)}.local_timestamp`,
        remediation: "Send local_timestamp as a positive UNIX timestamp in seconds, or omit it.",
        confidence: 0.9
      })
    ];
  }

  return [];
}

function requiredEnvelopeFields(payload: Record<string, unknown>): string[] {
  return [
    !isNonEmptyString(payload.type) ? "type" : undefined,
    !isNonEmptyString(payload.id) ? "id" : undefined,
    !isNonEmptyString(payload.tracker_id) ? "tracker_id" : undefined,
    !isStringOrIntegerIdentifier(payload.client_id) ? "client_id" : undefined
  ].filter((field): field is string => Boolean(field));
}

function hasFilterKey(query: unknown, key: string): boolean {
  return isRecord(query) && isRecord(query.filters) && key in query.filters;
}

function isKnownListName(value: string): value is (typeof knownListNames)[number] {
  return knownListNames.includes(value as (typeof knownListNames)[number]);
}

function isKnownItemType(value: string): value is (typeof knownItemTypes)[number] {
  return knownItemTypes.includes(value as (typeof knownItemTypes)[number]);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringOrIntegerIdentifier(value: unknown): boolean {
  return isNonEmptyString(value) || (typeof value === "number" && Number.isInteger(value));
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isFilterValue(value: unknown): boolean {
  if (isNonEmptyString(value) || typeof value === "number" || typeof value === "boolean") return true;
  if (!Array.isArray(value)) return false;
  return value.every((item) => isNonEmptyString(item) || typeof item === "number" || typeof item === "boolean");
}

function isIdentifierArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && value.every(isStringOrIntegerIdentifier);
}

function isPlatformValue(value: unknown): boolean {
  if (isNonEmptyString(value)) return true;
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
}

function eventPath(event: AnalyticsEvent): string {
  return `${event.sourcePath}:events[${event.index}]`;
}

function listPath(event: AnalyticsEvent, listName: string, suffix: string): string {
  return `${eventPath(event)}.lists.${jsonPathKey(listName)}.${suffix}`;
}

function jsonPathKey(value: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(value) ? value : JSON.stringify(value);
}

function eventLabel(event: AnalyticsEvent): string {
  return `event at ${eventPath(event)}`;
}

function optionalEnvelopeFinding(event: AnalyticsEvent, field: string, message: string): ValidationFinding {
  return analyticsFinding({
    id: "ANALYTICS_ENVELOPE_OPTIONAL_FIELD_INVALID",
    severity: "P1",
    title: "Analytics envelope optional field is invalid",
    message: `${eventLabel(event)} sends invalid ${field}: ${message}`,
    evidencePath: `${eventPath(event)}.${field}`,
    remediation: "Use only the documented Events API envelope field types, or omit optional fields when they are not available.",
    confidence: 0.9
  });
}

function analyticsFinding(input: Omit<Parameters<typeof createFinding>[0], "area" | "docs">): ValidationFinding {
  return createFinding({
    area: "analytics",
    docs: ["analytics/api/events", "quickstart/analytics/events-api-first-search"],
    ...input
  });
}
