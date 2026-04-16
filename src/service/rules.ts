import { createFinding } from "../core/findings.js";
import type { ValidationFinding } from "../core/types.js";
import { isRecord } from "../catalog/detect.js";
import type {
  AutocompleteEndpoint,
  ServiceArtifact,
  ServiceCheck,
  ServiceCheckExecution,
  ServiceExpectation
} from "./types.js";

export type ServiceRule = (artifacts: ServiceArtifact[], executions: ServiceCheckExecution[]) => ValidationFinding[];

export const serviceRules: ServiceRule[] = [
  validateParseErrors,
  validateProfileShape,
  validateRequestContracts,
  validateAnalyticsContracts,
  validateExecutionResults
];

const endpointPaths: Record<AutocompleteEndpoint, string> = {
  autocomplete: "/autocomplete/v2",
  top_items: "/v1/top_items",
  personalized_top_items: "/v1/personalized_top_items",
  trending_queries: "/v2/trending_queries"
};

function validateParseErrors(artifacts: ServiceArtifact[]): ValidationFinding[] {
  return artifacts.flatMap((artifact) => {
    if (!artifact.parseError) return [];

    return serviceFinding({
      id: "SERVICE_PROFILE_PARSE_ERROR",
      severity: "P0",
      title: "Service profile could not be parsed",
      message: artifact.parseError,
      evidencePath: artifact.path,
      remediation: "Provide a JSON object with service: \"autocomplete-api\" and a checks[] array.",
      docs: ["autocomplete/api", "quickstart/autocomplete/query-suggestions"],
      confidence: 0.98
    });
  });
}

function validateProfileShape(artifacts: ServiceArtifact[]): ValidationFinding[] {
  return artifacts.flatMap((artifact) => {
    if (!artifact.profile) return [];

    const findings: ValidationFinding[] = [];
    if (artifact.profile.checks.length === 0) {
      findings.push(
        serviceFinding({
          id: "SERVICE_PROFILE_NO_CHECKS",
          severity: "P0",
          title: "Service profile does not define checks",
          message: `${artifact.path} has an empty checks[] array.`,
          evidencePath: `${artifact.path}:checks`,
          remediation: "Define at least one check for autocomplete, top_items, or trending_queries.",
          docs: ["autocomplete/api"],
          confidence: 0.96
        })
      );
    }

    artifact.profile.checks.forEach((check, index) => {
      if (!isRecord(check)) {
        findings.push(
          serviceFinding({
            id: "SERVICE_CHECK_NOT_OBJECT",
            severity: "P0",
            title: "Service check is not an object",
            message: `checks[${index}] is not a JSON object.`,
            evidencePath: `${artifact.path}:checks[${index}]`,
            remediation: "Each check must define name, endpoint, request, and expectations.",
            docs: ["autocomplete/api"],
            confidence: 0.98
          })
        );
        return;
      }

      if (typeof check.name !== "string" || check.name.trim() === "") {
        findings.push(
          serviceFinding({
            id: "SERVICE_CHECK_NAME_MISSING",
            severity: "P1",
            title: "Service check is missing a name",
            message: `checks[${index}] has no readable name.`,
            evidencePath: `${artifact.path}:checks[${index}].name`,
            remediation: "Name each check after the user-facing behavior it validates.",
            docs: ["autocomplete/api"],
            confidence: 0.9
          })
        );
      }

      if (!isKnownEndpoint(check.endpoint)) {
        findings.push(
          serviceFinding({
            id: "SERVICE_ENDPOINT_UNKNOWN",
            severity: "P0",
            title: "Service check uses an unknown endpoint",
            message: `checks[${index}] uses endpoint "${String(check.endpoint)}".`,
            evidencePath: `${artifact.path}:checks[${index}].endpoint`,
            remediation: "Use autocomplete, top_items, personalized_top_items, or trending_queries.",
            docs: ["autocomplete/api"],
            confidence: 0.97
          })
        );
      }

      if (!isRecord(check.request) || typeof check.request.url !== "string") {
        findings.push(
          serviceFinding({
            id: "SERVICE_REQUEST_URL_MISSING",
            severity: "P0",
            title: "Service check is missing request URL",
            message: `checks[${index}] does not define request.url.`,
            evidencePath: `${artifact.path}:checks[${index}].request.url`,
            remediation: "Set request.url to the Luigi's Box endpoint URL for this check.",
            docs: ["autocomplete/api"],
            confidence: 0.97
          })
        );
      }
    });

    return findings;
  });
}

function validateRequestContracts(artifacts: ServiceArtifact[]): ValidationFinding[] {
  return artifacts.flatMap((artifact) =>
    validChecks(artifact).flatMap(({ check, index }) => {
      const findings: ValidationFinding[] = [];
      const params = check.request.params ?? {};

      findings.push(...validateEndpointUrl(artifact.path, check, index));

      if (!hasParam(params, "tracker_id")) {
        findings.push(
          serviceFinding({
            id: "SERVICE_TRACKER_ID_MISSING",
            severity: "P0",
            title: "Service request is missing tracker_id",
            message: `${checkLabel(check, index)} does not send the public tracker_id.`,
            evidencePath: `${artifact.path}:checks[${index}].request.params.tracker_id`,
            remediation: "Pass the Luigi's Box tracker_id on every Autocomplete API, Top Items API, and Trending Queries API request.",
            docs: ["autocomplete/api/v2/autocomplete", "autocomplete/api/v1/top-items", "autocomplete/api/v2/trending-queries"],
            confidence: 0.98
          })
        );
      }

      if (check.endpoint === "autocomplete") {
        if (!hasParam(params, "q")) {
          findings.push(requiredParamFinding(artifact.path, check, index, "q", "Send the partial user query in q."));
        }
        if (!hasParam(params, "type")) {
          findings.push(requiredParamFinding(artifact.path, check, index, "type", "Request result types and counts, for example item:6,category:3,query:5."));
        }
        findings.push(...validateTypeParam(artifact.path, check, index));
        findings.push(...validateHitFieldsRecommendation(artifact.path, check, index));
      }

      if (check.endpoint === "top_items" || check.endpoint === "personalized_top_items") {
        if (!hasParam(params, "type")) {
          findings.push(requiredParamFinding(artifact.path, check, index, "type", "Request result types and counts, for example item:5,category:3."));
        }
        if (check.endpoint === "personalized_top_items" && !hasParam(params, "user_id")) {
          findings.push(requiredParamFinding(artifact.path, check, index, "user_id", "Send the same user_id/customer_id used in analytics for personalized top items."));
        }
        findings.push(...validateTypeParam(artifact.path, check, index));
        findings.push(...validateHitFieldsRecommendation(artifact.path, check, index));
      }

      if (check.endpoint === "trending_queries") {
        if (hasParam(params, "q") || hasParam(params, "type")) {
          findings.push(
            serviceFinding({
              id: "SERVICE_TRENDING_QUERIES_EXTRA_PARAMS",
              severity: "P2",
              title: "Trending Queries request includes query/type parameters",
              message: `${checkLabel(check, index)} sends q or type, but Trending Queries is configured from the dashboard and only requires tracker_id.`,
              evidencePath: `${artifact.path}:checks[${index}].request.params`,
              remediation: "Remove q/type from trending_queries checks. Use q/type on autocomplete and top_items checks instead.",
              docs: ["autocomplete/api/v2/trending-queries", "quickstart/autocomplete/trending-queries"],
              confidence: 0.9
            })
          );
        }
      }

      return findings;
    })
  );
}

function validateAnalyticsContracts(artifacts: ServiceArtifact[]): ValidationFinding[] {
  return artifacts.flatMap((artifact) =>
    validChecks(artifact).flatMap(({ check, index }) => {
      const findings: ValidationFinding[] = [];

      if (!check.analytics) {
        return serviceFinding({
          id: "SERVICE_ANALYTICS_CONTRACT_MISSING",
          severity: "P1",
          title: "Direct API check has no analytics contract",
          message: `${checkLabel(check, index)} validates fetching data but does not define how the rendered results will be tracked.`,
          evidencePath: `${artifact.path}:checks[${index}].analytics`,
          remediation: "Add an analytics block that maps the endpoint to Autocomplete, Recommendation, or Search Results events.",
          docs: ["quickstart/autocomplete/query-suggestions", "quickstart/autocomplete/top-items-api", "quickstart/autocomplete/trending-queries"],
          confidence: 0.9
        });
      }

      if (check.endpoint === "autocomplete") {
        if (check.analytics.viewListName !== "Autocomplete") {
          findings.push(wrongListFinding(artifact.path, check, index, "Autocomplete"));
        }
        if (check.analytics.clickAction !== "click") {
          findings.push(
            serviceFinding({
              id: "SERVICE_AUTOCOMPLETE_CLICK_TRACKING_MISSING",
              severity: "P1",
              title: "Autocomplete click tracking is missing",
              message: `${checkLabel(check, index)} does not state that selected suggestions are tracked as click actions.`,
              evidencePath: `${artifact.path}:checks[${index}].analytics.clickAction`,
              remediation: "Track suggestion selection as an Events API click action or dataLayer select_item with the clicked item identity.",
              docs: ["quickstart/autocomplete/query-suggestions"],
              confidence: 0.86
            })
          );
        }
        if (check.analytics.noResultsEventRequired !== true) {
          findings.push(
            serviceFinding({
              id: "SERVICE_AUTOCOMPLETE_NO_RESULTS_EVENT_MISSING",
              severity: "P2",
              title: "Autocomplete no-results tracking is not declared",
              message: `${checkLabel(check, index)} does not declare that zero-result autocomplete responses are still tracked.`,
              evidencePath: `${artifact.path}:checks[${index}].analytics.noResultsEventRequired`,
              remediation: "Send the Autocomplete view event even when hits is empty so zero-result queries can be learned from.",
              docs: ["quickstart/autocomplete/query-suggestions"],
              confidence: 0.82
            })
          );
        }
      }

      if (check.endpoint === "top_items" || check.endpoint === "personalized_top_items") {
        if (check.analytics.viewListName !== "Recommendation") {
          findings.push(wrongListFinding(artifact.path, check, index, "Recommendation"));
        }
        if (check.endpoint === "top_items" && check.analytics.recommendationPlacement !== "autocomplete_popup") {
          findings.push(
            serviceFinding({
              id: "SERVICE_TOP_ITEMS_PLACEMENT_MISSING",
              severity: "P1",
              title: "Top Items autocomplete placement is not declared",
              message: `${checkLabel(check, index)} does not use autocomplete_popup as the recommendation placement.`,
              evidencePath: `${artifact.path}:checks[${index}].analytics.recommendationPlacement`,
              remediation: "When top items are shown on search-box focus, track the Recommendation view with RecommenderClientId/Recommender set to autocomplete_popup.",
              docs: ["autocomplete/api/v1/top-items", "quickstart/autocomplete/top-items-api"],
              confidence: 0.88
            })
          );
        }
      }

      if (check.endpoint === "trending_queries") {
        if (check.analytics.viewListName !== "Search Results") {
          findings.push(wrongListFinding(artifact.path, check, index, "Search Results"));
        }
        if (check.analytics.clickRunsSearch !== true) {
          findings.push(
            serviceFinding({
              id: "SERVICE_TRENDING_QUERY_SEARCH_TRACKING_MISSING",
              severity: "P1",
              title: "Trending query click-to-search tracking is missing",
              message: `${checkLabel(check, index)} does not declare that clicking a trending query executes a search and tracks the resulting Search Results view.`,
              evidencePath: `${artifact.path}:checks[${index}].analytics.clickRunsSearch`,
              remediation: "On trending-query click, populate the query, run search, and track the resulting Search Results list.",
              docs: ["quickstart/autocomplete/trending-queries"],
              confidence: 0.88
            })
          );
        }
      }

      return findings;
    })
  );
}

function validateExecutionResults(artifacts: ServiceArtifact[], executions: ServiceCheckExecution[]): ValidationFinding[] {
  const checks = new Map<string, { artifactPath: string; index: number; check: ServiceCheck }>();
  for (const artifact of artifacts) {
    for (const { check, index } of validChecks(artifact)) {
      checks.set(executionKey(artifact.path, check.name), { artifactPath: artifact.path, index, check });
    }
  }

  return executions.flatMap((execution) => {
    const record = checks.get(executionKey(execution.artifactPath, execution.checkName));
    if (!record) return [];

    const findings: ValidationFinding[] = [];
    const { artifactPath, index, check } = record;
    const expected = check.expect ?? {};
    const expectedStatus = expected.status ?? 200;

    if (execution.error) {
      return serviceFinding({
        id: "SERVICE_REQUEST_FAILED",
        severity: "P0",
        title: "Service request failed",
        message: `${checkLabel(check, index)} could not be fetched: ${execution.error}`,
        evidencePath: `${artifactPath}:checks[${index}].request`,
        remediation: "Confirm the endpoint URL is reachable from the environment and the request does not time out.",
        docs: docsForEndpoint(check.endpoint),
        confidence: 0.94
      });
    }

    if (execution.status !== expectedStatus) {
      findings.push(
        serviceFinding({
          id: "SERVICE_HTTP_STATUS_UNEXPECTED",
          severity: "P0",
          title: "Service endpoint returned unexpected HTTP status",
          message: `${checkLabel(check, index)} returned HTTP ${execution.status ?? "unknown"} instead of ${expectedStatus}.`,
          evidencePath: `${artifactPath}:checks[${index}].request`,
          remediation: "Fix missing or malformed request parameters, especially tracker_id, q, type, and user_id where required.",
          docs: docsForEndpoint(check.endpoint),
          confidence: 0.96
        })
      );
    }

    findings.push(...validateResponseShape(artifactPath, check, index, execution.data, expected));
    return findings;
  });
}

function validateResponseShape(
  artifactPath: string,
  check: ServiceCheck,
  index: number,
  data: unknown,
  expected: ServiceExpectation
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];

  if (check.endpoint === "trending_queries") {
    if (!Array.isArray(data)) {
      return [serviceFinding({
        id: "SERVICE_TRENDING_RESPONSE_NOT_ARRAY",
        severity: "P0",
        title: "Trending Queries response is not an array",
        message: `${checkLabel(check, index)} returned ${describeValue(data)}; docs specify a JSON array of query objects.`,
        evidencePath: `${artifactPath}:checks[${index}].response`,
        remediation: "Call /v2/trending_queries and parse the response as an array of objects with title.",
        docs: ["autocomplete/api/v2/trending-queries"],
        confidence: 0.96
      })];
    }

    findings.push(...validateResultCount(artifactPath, check, index, data, expected));
    data.forEach((entry, entryIndex) => {
      if (!isRecord(entry) || typeof entry.title !== "string" || entry.title.trim() === "") {
        findings.push(
          serviceFinding({
            id: "SERVICE_TRENDING_QUERY_TITLE_MISSING",
            severity: "P1",
            title: "Trending query entry is missing title",
            message: `${checkLabel(check, index)} returned an entry without a readable title at index ${entryIndex}.`,
            evidencePath: `${artifactPath}:checks[${index}].response[${entryIndex}].title`,
            remediation: "Render only trending query objects that include title, and investigate dashboard/API setup if titles are missing.",
            docs: ["autocomplete/api/v2/trending-queries"],
            confidence: 0.9
          })
        );
      }
    });

    return findings;
  }

  if (!isRecord(data)) {
    return [serviceFinding({
      id: "SERVICE_RESPONSE_NOT_OBJECT",
      severity: "P0",
      title: "Service response is not a JSON object",
      message: `${checkLabel(check, index)} returned ${describeValue(data)}; docs specify an object with hits[].`,
      evidencePath: `${artifactPath}:checks[${index}].response`,
      remediation: "Parse the API response as JSON and confirm the endpoint path is correct.",
      docs: docsForEndpoint(check.endpoint),
      confidence: 0.96
    })];
  }

  const hits = Array.isArray(data.hits) ? data.hits : undefined;
  if (!hits) {
    return [serviceFinding({
      id: "SERVICE_HITS_ARRAY_MISSING",
      severity: "P0",
      title: "Service response is missing hits[]",
      message: `${checkLabel(check, index)} did not return a hits array.`,
      evidencePath: `${artifactPath}:checks[${index}].response.hits`,
      remediation: "Confirm the request uses the documented autocomplete/top_items endpoint and reads response.data.hits.",
      docs: docsForEndpoint(check.endpoint),
      confidence: 0.96
    })];
  }

  findings.push(...validateRootFields(artifactPath, check, index, data, expected));
  findings.push(...validateResultCount(artifactPath, check, index, hits, expected));
  findings.push(...validateGuid(artifactPath, check, index, data, expected));
  findings.push(...validateRecommendationId(artifactPath, check, index, data, expected));
  findings.push(...validateHitTypes(artifactPath, check, index, hits, expected));
  findings.push(...validateContainsIdentities(artifactPath, check, index, hits, expected));
  findings.push(...validateHitFields(artifactPath, check, index, hits, expected));

  return findings;
}

function validateEndpointUrl(artifactPath: string, check: ServiceCheck, index: number): ValidationFinding[] {
  try {
    const url = new URL(check.request.url);
    const findings: ValidationFinding[] = [];

    if (url.protocol !== "https:" || url.hostname !== "live.luigisbox.com") {
      findings.push(
        serviceFinding({
          id: "SERVICE_ENDPOINT_HOST_NOT_LIVE_API",
          severity: "P1",
          title: "Service check does not call the public live API host",
          message: `${checkLabel(check, index)} calls ${url.origin}; docs recommend direct frontend calls to https://live.luigisbox.com.`,
          evidencePath: `${artifactPath}:checks[${index}].request.url`,
          remediation: "Call the public Luigi's Box live API directly from the frontend unless you have a specific, accepted reason to proxy.",
          docs: ["autocomplete/guides/integration-best-practices"],
          confidence: 0.86
        })
      );
    }

    if (url.pathname !== endpointPaths[check.endpoint]) {
      findings.push(
        serviceFinding({
          id: "SERVICE_ENDPOINT_PATH_MISMATCH",
          severity: "P0",
          title: "Service endpoint path does not match declared endpoint",
          message: `${checkLabel(check, index)} declares ${check.endpoint} but calls ${url.pathname}.`,
          evidencePath: `${artifactPath}:checks[${index}].request.url`,
          remediation: `Use ${endpointPaths[check.endpoint]} for ${check.endpoint}.`,
          docs: docsForEndpoint(check.endpoint),
          confidence: 0.96
        })
      );
    }

    return findings;
  } catch {
    return [serviceFinding({
      id: "SERVICE_ENDPOINT_URL_INVALID",
      severity: "P0",
      title: "Service endpoint URL is invalid",
      message: `${checkLabel(check, index)} request.url is not a valid URL.`,
      evidencePath: `${artifactPath}:checks[${index}].request.url`,
      remediation: "Use a full URL such as https://live.luigisbox.com/autocomplete/v2.",
      docs: ["autocomplete/api"],
      confidence: 0.97
    })];
  }
}

function validateTypeParam(artifactPath: string, check: ServiceCheck, index: number): ValidationFinding[] {
  const value = check.request.params?.type;
  if (typeof value !== "string" || value.trim() === "") return [];

  const invalidParts = value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => !/^[A-Za-z0-9_-]+:[1-9][0-9]*$/.test(part));

  if (invalidParts.length === 0) return [];

  return [serviceFinding({
    id: "SERVICE_TYPE_PARAM_INVALID",
    severity: "P0",
    title: "Service type parameter has invalid format",
    message: `${checkLabel(check, index)} has invalid type entries: ${invalidParts.join(", ")}.`,
    evidencePath: `${artifactPath}:checks[${index}].request.params.type`,
    remediation: "Use comma-separated type:count entries such as item:6,category:3,query:5.",
    docs: docsForEndpoint(check.endpoint),
    confidence: 0.96
  })];
}

function validateHitFieldsRecommendation(artifactPath: string, check: ServiceCheck, index: number): ValidationFinding[] {
  if (hasParam(check.request.params ?? {}, "hit_fields")) return [];

  return [serviceFinding({
    id: "SERVICE_HIT_FIELDS_MISSING",
    severity: "P2",
    title: "Service request does not limit hit_fields",
    message: `${checkLabel(check, index)} does not specify hit_fields.`,
    evidencePath: `${artifactPath}:checks[${index}].request.params.hit_fields`,
    remediation: "Request only the attributes rendered in the dropdown, for example title,price,image_link_l,web_url.",
    docs: ["autocomplete/guides/integration-best-practices"],
    confidence: 0.82
  })];
}

function validateRootFields(
  artifactPath: string,
  check: ServiceCheck,
  index: number,
  data: Record<string, unknown>,
  expected: ServiceExpectation
): ValidationFinding[] {
  return (expected.requiredRootFields ?? []).flatMap((field) => {
    if (data[field] !== undefined && data[field] !== null) return [];

    return serviceFinding({
      id: "SERVICE_ROOT_FIELD_MISSING",
      severity: "P1",
      title: "Service response is missing an expected root field",
      message: `${checkLabel(check, index)} response is missing ${field}.`,
      evidencePath: `${artifactPath}:checks[${index}].response.${field}`,
      remediation: "Confirm the endpoint version and request parameters match the documented response shape.",
      docs: docsForEndpoint(check.endpoint),
      confidence: 0.86
    });
  });
}

function validateResultCount(
  artifactPath: string,
  check: ServiceCheck,
  index: number,
  results: unknown[],
  expected: ServiceExpectation
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];

  if (expected.minResults !== undefined && results.length < expected.minResults) {
    findings.push(
      serviceFinding({
        id: "SERVICE_MIN_RESULTS_NOT_MET",
        severity: "P1",
        title: "Service endpoint returned too few results",
        message: `${checkLabel(check, index)} returned ${results.length} result(s), expected at least ${expected.minResults}.`,
        evidencePath: `${artifactPath}:checks[${index}].response`,
        remediation: "Verify the catalog is indexed, the query/type parameters match existing data, and dashboard-managed suggestions are configured when required.",
        docs: docsForEndpoint(check.endpoint),
        confidence: 0.9
      })
    );
  }

  if (expected.maxResults !== undefined && results.length > expected.maxResults) {
    findings.push(
      serviceFinding({
        id: "SERVICE_MAX_RESULTS_EXCEEDED",
        severity: "P2",
        title: "Service endpoint returned more results than expected",
        message: `${checkLabel(check, index)} returned ${results.length} result(s), expected at most ${expected.maxResults}.`,
        evidencePath: `${artifactPath}:checks[${index}].response`,
        remediation: "Review type counts and UI rendering limits so the dropdown does not render more suggestions than intended.",
        docs: docsForEndpoint(check.endpoint),
        confidence: 0.82
      })
    );
  }

  return findings;
}

function validateGuid(
  artifactPath: string,
  check: ServiceCheck,
  index: number,
  data: Record<string, unknown>,
  expected: ServiceExpectation
): ValidationFinding[] {
  if (expected.requireGuid !== true || typeof data.guid === "string" && data.guid.trim() !== "") return [];

  return [serviceFinding({
    id: "SERVICE_AUTOCOMPLETE_GUID_MISSING",
    severity: "P1",
    title: "Autocomplete response is missing guid",
    message: `${checkLabel(check, index)} did not return a guid for correlating autocomplete analytics.`,
    evidencePath: `${artifactPath}:checks[${index}].response.guid`,
    remediation: "Use the documented Autocomplete API response and pass the guid into analytics filters when the integration path requires _Guid tracking.",
    docs: ["autocomplete/api/v2/autocomplete", "analytics/api/events"],
    confidence: 0.84
  })];
}

function validateRecommendationId(
  artifactPath: string,
  check: ServiceCheck,
  index: number,
  data: Record<string, unknown>,
  expected: ServiceExpectation
): ValidationFinding[] {
  if (expected.requireRecommendationId !== true || hasMeaningfulValue(data.recommendation_id)) return [];

  return [serviceFinding({
    id: "SERVICE_RECOMMENDATION_ID_MISSING",
    severity: "P1",
    title: "Top Items response is missing recommendation_id",
    message: `${checkLabel(check, index)} did not return recommendation_id.`,
    evidencePath: `${artifactPath}:checks[${index}].response.recommendation_id`,
    remediation: "Confirm the Top Items endpoint returns recommendation metadata and wire it into Recommendation analytics when used by the integration.",
    docs: ["autocomplete/api/v1/top-items", "quickstart/autocomplete/top-items-api"],
    confidence: 0.84
  })];
}

function validateHitTypes(
  artifactPath: string,
  check: ServiceCheck,
  index: number,
  hits: unknown[],
  expected: ServiceExpectation
): ValidationFinding[] {
  return (expected.resultTypes ?? []).flatMap((type) => {
    const hasType = hits.some((hit) => isRecord(hit) && hit.type === type);
    if (hasType) return [];

    return serviceFinding({
      id: "SERVICE_RESULT_TYPE_MISSING",
      severity: "P1",
      title: "Expected result type is missing",
      message: `${checkLabel(check, index)} did not return any ${type} hit.`,
      evidencePath: `${artifactPath}:checks[${index}].response.hits`,
      remediation: "Check the type parameter counts and catalog content for the expected object type.",
      docs: docsForEndpoint(check.endpoint),
      confidence: 0.88
    });
  });
}

function validateContainsIdentities(
  artifactPath: string,
  check: ServiceCheck,
  index: number,
  hits: unknown[],
  expected: ServiceExpectation
): ValidationFinding[] {
  const identities = new Set(
    hits.flatMap((hit) => {
      if (!isRecord(hit)) return [];
      return typeof hit.url === "string" ? [hit.url] : [];
    })
  );

  return (expected.containsIdentities ?? []).flatMap((identity) => {
    if (identities.has(identity)) return [];

    return serviceFinding({
      id: "SERVICE_EXPECTED_IDENTITY_MISSING",
      severity: "P1",
      title: "Expected catalog identity is missing from service response",
      message: `${checkLabel(check, index)} did not return ${identity}.`,
      evidencePath: `${artifactPath}:checks[${index}].response.hits`,
      remediation: "Verify the object exists in the catalog, is indexed, matches the query/filter, and is not excluded by availability/ranking setup.",
      docs: docsForEndpoint(check.endpoint),
      confidence: 0.88
    });
  });
}

function validateHitFields(
  artifactPath: string,
  check: ServiceCheck,
  index: number,
  hits: unknown[],
  expected: ServiceExpectation
): ValidationFinding[] {
  const sampleHits = hits.filter(isRecord);
  const findings: ValidationFinding[] = [];

  for (const field of expected.requiredHitFields ?? []) {
    const missing = sampleHits.findIndex((hit) => !hasMeaningfulValue(hit[field]));
    if (missing === -1) continue;

    findings.push(
      serviceFinding({
        id: "SERVICE_HIT_FIELD_MISSING",
        severity: "P1",
        title: "Service hit is missing expected top-level field",
        message: `${checkLabel(check, index)} has a hit missing ${field}.`,
        evidencePath: `${artifactPath}:checks[${index}].response.hits[${missing}].${field}`,
        remediation: "Confirm hit_fields and rendering code use fields returned by the documented response shape.",
        docs: docsForEndpoint(check.endpoint),
        confidence: 0.86
      })
    );
  }

  for (const field of expected.requiredAttributeFields ?? []) {
    const missing = sampleHits.findIndex((hit) => !isRecord(hit.attributes) || !hasMeaningfulValue(hit.attributes[field]));
    if (missing === -1) continue;

    findings.push(
      serviceFinding({
        id: "SERVICE_HIT_ATTRIBUTE_MISSING",
        severity: "P1",
        title: "Service hit is missing expected attribute",
        message: `${checkLabel(check, index)} has a hit missing attributes.${field}.`,
        evidencePath: `${artifactPath}:checks[${index}].response.hits[${missing}].attributes.${field}`,
        remediation: "Include the attribute in hit_fields and verify it is indexed in the catalog fields.",
        docs: docsForEndpoint(check.endpoint),
        confidence: 0.86
      })
    );
  }

  return findings;
}

function wrongListFinding(
  artifactPath: string,
  check: ServiceCheck,
  index: number,
  expectedListName: "Autocomplete" | "Recommendation" | "Search Results"
): ValidationFinding {
  return serviceFinding({
    id: "SERVICE_ANALYTICS_LIST_MISMATCH",
    severity: "P1",
    title: "Service check maps to the wrong analytics list",
    message: `${checkLabel(check, index)} should be tracked as ${expectedListName}, but declares ${check.analytics?.viewListName ?? "nothing"}.`,
    evidencePath: `${artifactPath}:checks[${index}].analytics.viewListName`,
    remediation: `Set analytics.viewListName to ${expectedListName} for this endpoint behavior.`,
    docs: ["quickstart/autocomplete/query-suggestions", "quickstart/autocomplete/top-items-api", "quickstart/autocomplete/trending-queries"],
    confidence: 0.9
  });
}

function requiredParamFinding(
  artifactPath: string,
  check: ServiceCheck,
  index: number,
  param: string,
  remediation: string
): ValidationFinding {
  return serviceFinding({
    id: "SERVICE_REQUIRED_PARAM_MISSING",
    severity: "P0",
    title: "Service request is missing a required parameter",
    message: `${checkLabel(check, index)} is missing ${param}.`,
    evidencePath: `${artifactPath}:checks[${index}].request.params.${param}`,
    remediation,
    docs: docsForEndpoint(check.endpoint),
    confidence: 0.98
  });
}

function validChecks(artifact: ServiceArtifact): Array<{ check: ServiceCheck; index: number }> {
  if (!artifact.profile) return [];

  return artifact.profile.checks.flatMap((check, index) => {
    if (!isRecord(check) || !isKnownEndpoint(check.endpoint) || !isRecord(check.request) || typeof check.request.url !== "string") {
      return [];
    }

    return [{ check, index }];
  });
}

function hasParam(params: Record<string, unknown>, key: string): boolean {
  const value = params[key];
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  return String(value).trim() !== "";
}

function hasMeaningfulValue(value: unknown): boolean {
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null;
}

function isKnownEndpoint(value: unknown): value is AutocompleteEndpoint {
  return value === "autocomplete" || value === "top_items" || value === "personalized_top_items" || value === "trending_queries";
}

function docsForEndpoint(endpoint: AutocompleteEndpoint): string[] {
  if (endpoint === "autocomplete") return ["autocomplete/api/v2/autocomplete", "quickstart/autocomplete/query-suggestions"];
  if (endpoint === "top_items") return ["autocomplete/api/v1/top-items", "quickstart/autocomplete/top-items-api"];
  if (endpoint === "personalized_top_items") return ["autocomplete/api/v1/top-items", "quickstart/autocomplete/top-items-api"];
  return ["autocomplete/api/v2/trending-queries", "quickstart/autocomplete/trending-queries"];
}

function checkLabel(check: ServiceCheck, index: number): string {
  return check.name?.trim() ? `"${check.name}"` : `checks[${index}]`;
}

function executionKey(artifactPath: string, checkName: string): string {
  return `${artifactPath}\0${checkName}`;
}

function describeValue(value: unknown): string {
  if (Array.isArray(value)) return "an array";
  if (isRecord(value)) return "an object";
  return typeof value;
}

function serviceFinding(input: Omit<Parameters<typeof createFinding>[0], "area">): ValidationFinding {
  return createFinding({ area: "service", ...input });
}
