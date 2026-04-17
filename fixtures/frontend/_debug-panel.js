/*
 * _debug-panel.js
 *
 * A tiny, zero-dependency visual debugger that pins itself to the bottom-right
 * of any fixture page and surfaces what the Autocomplete + Analytics wiring is
 * actually doing at runtime. Load it into a fixture with:
 *
 *   <script src="_debug-panel.js"></script>
 *
 * Fields and what each proves (or disproves) when you type into the search box:
 *
 *   - "Autocomplete URL"  : proves the v2/autocomplete endpoint is hit with the
 *                           required params (tracker_id, q, type, hit_fields).
 *                           A missing tracker_id or a query param named `search`
 *                           instead of `q` will be plainly visible here.
 *   - "Top Items URL"     : proves Top Items fires on input focus (not on page
 *                           load). If it shows up before you focus the input,
 *                           the "focus listener missing" bug is live.
 *   - "Trending URL"      : proves the Trending Queries endpoint is called and
 *                           a placeholder is set from the response.
 *   - "Last analytics"    : pretty-printed dataLayer.push payload OR the JSON
 *                           body of the most recent POST to api.luigisbox.com.
 *                           Shows item_id continuity with hit.url; a payload
 *                           whose item_id is a human title (not a URL) exposes
 *                           the identity-mismatch bugs.
 *   - "Rendered count"    : number of .result-item elements currently in the
 *                           results container, measured by MutationObserver.
 *                           A zero here with a non-empty query tells you the
 *                           render path broke (e.g. wrong request param).
 *   - "Last click id"     : what the click handler actually pushed as item_id,
 *                           alongside the data-item-id the button was rendered
 *                           with. If those two do not match you are looking at
 *                           the "click uses textContent instead of dataset"
 *                           failure mode.
 *   - "Warnings"          : inline alerts when:
 *                             * identity looks like a human title (no URL
 *                               characters) rather than hit.url
 *                             * an autocomplete response had an empty hits
 *                               array but no analytics event fired within the
 *                               expected window (the no-results-untracked bug)
 */
(function () {
  "use strict";

  if (window.__lbxDebugPanel) return;

  var state = {
    autocompleteUrl: null,
    topItemsUrl: null,
    trendingUrl: null,
    lastAnalytics: null,
    lastAnalyticsKind: null,
    lastAnalyticsAt: null,
    renderedCount: 0,
    lastClickId: null,
    lastClickDatasetId: null,
    warnings: []
  };

  // Track a short rolling window so we can diagnose "empty-hits but no event
  // fired" — the fingerprint of the no-results-untracked bug.
  var emptyHitsPending = null; // { query, at, timer }
  var EMPTY_HITS_WINDOW_MS = 600;

  function setWarning(key, message) {
    var existing = state.warnings.find(function (w) { return w.key === key; });
    if (existing) {
      existing.message = message;
      existing.at = Date.now();
    } else {
      state.warnings.push({ key: key, message: message, at: Date.now() });
    }
    render();
  }

  function clearWarning(key) {
    state.warnings = state.warnings.filter(function (w) { return w.key !== key; });
    render();
  }

  function looksLikeUrl(value) {
    if (typeof value !== "string") return false;
    return /[\/.]/.test(value);
  }

  function findAnyItemId(payload) {
    // Walk a few well-known shapes to pull one representative item identifier.
    try {
      if (!payload || typeof payload !== "object") return null;
      if (payload.ecommerce && payload.ecommerce.items && payload.ecommerce.items[0]) {
        return payload.ecommerce.items[0].item_id;
      }
      if (payload.lists) {
        var keys = Object.keys(payload.lists);
        for (var i = 0; i < keys.length; i++) {
          var list = payload.lists[keys[i]];
          if (list && list.items && list.items[0]) {
            return list.items[0].url || list.items[0].title;
          }
        }
      }
      if (payload.action && payload.action.resource_identifier) {
        return payload.action.resource_identifier;
      }
    } catch (err) {
      return null;
    }
    return null;
  }

  function checkIdentityWarning(payload) {
    var sample = findAnyItemId(payload);
    if (sample == null) return;
    if (!looksLikeUrl(sample)) {
      setWarning(
        "identity",
        "Analytics item identity looks like a title (\"" + String(sample).slice(0, 40) + "\"), not a hit.url."
      );
    } else {
      clearWarning("identity");
    }
  }

  function capturePayload(kind, payload) {
    state.lastAnalytics = payload;
    state.lastAnalyticsKind = kind;
    state.lastAnalyticsAt = Date.now();
    checkIdentityWarning(payload);
    // If an autocomplete view event came through while we were waiting for
    // "no-results" tracking, resolve the pending check.
    if (emptyHitsPending) {
      clearTimeout(emptyHitsPending.timer);
      emptyHitsPending = null;
      clearWarning("no-results-untracked");
    }
    render();
  }

  // Monkey-patch window.fetch to capture API URLs and Events API POST bodies.
  var originalFetch = window.fetch ? window.fetch.bind(window) : null;
  if (originalFetch) {
    window.fetch = function (input, init) {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      try {
        if (url.indexOf("/autocomplete/v2") !== -1) {
          state.autocompleteUrl = url;
          // Peek at the response to see if hits were empty.
          var qMatch = url.match(/[?&]q=([^&]*)/);
          var query = qMatch ? decodeURIComponent(qMatch[1]) : "";
          var promise = originalFetch(input, init);
          promise.then(function (res) {
            try {
              var clone = res.clone();
              clone.json().then(function (body) {
                if (body && Array.isArray(body.hits) && body.hits.length === 0) {
                  armEmptyHitsWatcher(query);
                }
              }).catch(function () {});
            } catch (err) {}
          }).catch(function () {});
          render();
          return promise;
        }
        if (url.indexOf("/v1/top_items") !== -1) {
          state.topItemsUrl = url;
          render();
        } else if (url.indexOf("/v2/trending_queries") !== -1) {
          state.trendingUrl = url;
          render();
        } else if (url.indexOf("api.luigisbox.com") !== -1) {
          // Events API POST: stash payload.
          try {
            var body = init && init.body;
            if (typeof body === "string") {
              capturePayload("events-api", JSON.parse(body));
            }
          } catch (err) {}
        }
      } catch (err) {}
      return originalFetch(input, init);
    };
  }

  function armEmptyHitsWatcher(query) {
    if (emptyHitsPending) clearTimeout(emptyHitsPending.timer);
    emptyHitsPending = {
      query: query,
      at: Date.now(),
      timer: setTimeout(function () {
        setWarning(
          "no-results-untracked",
          "Autocomplete returned empty hits for \"" + query + "\" but no analytics event followed."
        );
        emptyHitsPending = null;
      }, EMPTY_HITS_WINDOW_MS)
    };
  }

  // Monkey-patch dataLayer.push so we see every event as it fires.
  function patchDataLayer() {
    if (!window.dataLayer) window.dataLayer = [];
    var dl = window.dataLayer;
    var originalPush = dl.push ? dl.push.bind(dl) : Array.prototype.push.bind(dl);
    dl.push = function () {
      var args = Array.prototype.slice.call(arguments);
      args.forEach(function (entry) { capturePayload("datalayer", entry); });
      return originalPush.apply(dl, args);
    };
  }
  patchDataLayer();

  // Watch the results container for render activity.
  function wireResultsObserver() {
    var container = document.getElementById("autocomplete-results");
    if (!container) {
      setTimeout(wireResultsObserver, 150);
      return;
    }
    var observer = new MutationObserver(function () {
      state.renderedCount = container.querySelectorAll(".result-item").length;
      render();
    });
    observer.observe(container, { childList: true, subtree: true, characterData: true });
    // Also intercept clicks so we see what item identity was sent vs displayed.
    container.addEventListener("click", function (event) {
      var item = event.target && event.target.closest && event.target.closest(".result-item");
      if (!item) return;
      state.lastClickDatasetId = item.dataset ? item.dataset.itemId : null;
      setTimeout(function () {
        // If an analytics event fires right after, we'll have captured an item_id.
        var inferred = state.lastAnalytics ? findAnyItemId(state.lastAnalytics) : null;
        state.lastClickId = inferred;
        render();
      }, 30);
    }, true);
  }
  wireResultsObserver();

  // Build the panel. Everything CSS-scoped via unique id prefix.
  var panel;
  function ensurePanel() {
    if (panel) return panel;
    var style = document.createElement("style");
    style.textContent = [
      "#lbx-debug-panel{position:fixed;right:12px;bottom:12px;z-index:2147483647;",
      "font:12px/1.4 ui-monospace,Menlo,Consolas,monospace;color:#e5e7eb;background:#0f172a;",
      "border:1px solid #1e293b;border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.35);",
      "width:360px;max-height:60vh;overflow:auto}",
      "#lbx-debug-panel header{display:flex;align-items:center;justify-content:space-between;",
      "padding:8px 10px;background:#1e293b;border-bottom:1px solid #0f172a;border-radius:10px 10px 0 0}",
      "#lbx-debug-panel header h3{margin:0;font-size:12px;letter-spacing:.08em;color:#93c5fd;font-weight:600}",
      "#lbx-debug-panel header button{background:transparent;border:none;color:#94a3b8;cursor:pointer;font-size:14px;line-height:1;padding:2px 6px}",
      "#lbx-debug-panel .body{padding:10px}",
      "#lbx-debug-panel dl{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;margin:0}",
      "#lbx-debug-panel dt{color:#64748b;font-weight:600}",
      "#lbx-debug-panel dd{margin:0;word-break:break-all}",
      "#lbx-debug-panel dd.empty{color:#475569;font-style:italic}",
      "#lbx-debug-panel pre{margin:6px 0 0 0;padding:6px 8px;background:#020617;border-radius:6px;",
      "max-height:180px;overflow:auto;color:#d1d5db;white-space:pre-wrap;word-break:break-word}",
      "#lbx-debug-panel .warn{background:#7f1d1d;color:#fee2e2;padding:6px 8px;border-radius:6px;margin-top:6px}",
      "#lbx-debug-panel .ok{color:#86efac}",
      "#lbx-debug-panel[data-collapsed=\"true\"] .body{display:none}",
      "#lbx-debug-panel[data-collapsed=\"true\"]{width:auto}"
    ].join("");
    (document.head || document.documentElement).appendChild(style);

    panel = document.createElement("div");
    panel.id = "lbx-debug-panel";
    panel.setAttribute("data-collapsed", "false");
    panel.innerHTML = [
      "<header>",
      "  <h3>LBX debug</h3>",
      "  <button id=\"lbx-debug-toggle\" type=\"button\" aria-label=\"Collapse\">\u2014</button>",
      "</header>",
      "<div class=\"body\">",
      "  <dl id=\"lbx-debug-fields\"></dl>",
      "  <div id=\"lbx-debug-warnings\"></div>",
      "  <pre id=\"lbx-debug-payload\" hidden></pre>",
      "</div>"
    ].join("");
    (document.body || document.documentElement).appendChild(panel);

    panel.querySelector("#lbx-debug-toggle").addEventListener("click", function () {
      var collapsed = panel.getAttribute("data-collapsed") === "true";
      panel.setAttribute("data-collapsed", collapsed ? "false" : "true");
      this.textContent = collapsed ? "\u2014" : "+";
    });
    return panel;
  }

  function valueCell(value) {
    if (value == null || value === "") return { text: "(none)", empty: true };
    return { text: String(value), empty: false };
  }

  function render() {
    if (!document.body) { setTimeout(render, 50); return; }
    ensurePanel();

    var rows = [
      { label: "Autocomplete URL", cell: valueCell(state.autocompleteUrl) },
      { label: "Top Items URL",    cell: valueCell(state.topItemsUrl) },
      { label: "Trending URL",     cell: valueCell(state.trendingUrl) },
      { label: "Rendered count",   cell: valueCell(state.renderedCount) },
      {
        label: "Last click id",
        cell: valueCell(
          state.lastClickId
            ? state.lastClickId + (state.lastClickDatasetId && state.lastClickDatasetId !== state.lastClickId
                ? "  (dataset: " + state.lastClickDatasetId + ")"
                : "")
            : null
        )
      },
      {
        label: "Last analytics",
        cell: valueCell(state.lastAnalyticsKind
          ? state.lastAnalyticsKind + " @ " + new Date(state.lastAnalyticsAt).toLocaleTimeString()
          : null)
      }
    ];

    var fieldsEl = document.getElementById("lbx-debug-fields");
    if (fieldsEl) {
      fieldsEl.innerHTML = "";
      rows.forEach(function (row) {
        var dt = document.createElement("dt");
        dt.textContent = row.label;
        var dd = document.createElement("dd");
        dd.textContent = row.cell.text;
        if (row.cell.empty) dd.className = "empty";
        fieldsEl.appendChild(dt);
        fieldsEl.appendChild(dd);
      });
    }

    // Click-dataset consistency warning.
    if (state.lastClickId && state.lastClickDatasetId && state.lastClickId !== state.lastClickDatasetId) {
      setWarningInternal(
        "click-identity-mismatch",
        "Click payload item_id (\"" + String(state.lastClickId).slice(0, 40) +
          "\") does not match rendered data-item-id (\"" + String(state.lastClickDatasetId).slice(0, 40) + "\")."
      );
    } else if (state.lastClickId && state.lastClickDatasetId) {
      clearWarningInternal("click-identity-mismatch");
    }

    var warnBox = document.getElementById("lbx-debug-warnings");
    if (warnBox) {
      warnBox.innerHTML = "";
      state.warnings.forEach(function (w) {
        var div = document.createElement("div");
        div.className = "warn";
        div.textContent = "! " + w.message;
        warnBox.appendChild(div);
      });
    }

    var payloadEl = document.getElementById("lbx-debug-payload");
    if (payloadEl) {
      if (state.lastAnalytics) {
        try {
          payloadEl.textContent = JSON.stringify(state.lastAnalytics, null, 2);
        } catch (err) {
          payloadEl.textContent = "(payload not serializable)";
        }
        payloadEl.hidden = false;
      } else {
        payloadEl.hidden = true;
      }
    }
  }

  // Internal variants that don't re-enter render() to avoid loops.
  function setWarningInternal(key, message) {
    var existing = state.warnings.find(function (w) { return w.key === key; });
    if (existing) { existing.message = message; existing.at = Date.now(); return; }
    state.warnings.push({ key: key, message: message, at: Date.now() });
  }
  function clearWarningInternal(key) {
    state.warnings = state.warnings.filter(function (w) { return w.key !== key; });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }

  window.__lbxDebugPanel = { state: state, render: render };
})();
