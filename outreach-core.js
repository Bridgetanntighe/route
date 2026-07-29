/**
 * Pure outreach helpers — shared by the app and automated tests.
 * No DOM, no network, no localStorage.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.OutreachCore = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var OUTCOME_LABELS = {
    not_visited: "Not visited",
    good_conversation: "Good conversation",
    leaflet_left: "Leaflet left",
    reception_only: "Reception only",
    could_not_get_in: "Could not get in",
    not_suitable: "Not suitable"
  };

  var SAVEABLE_OUTCOMES = [
    "good_conversation",
    "leaflet_left",
    "reception_only",
    "could_not_get_in",
    "not_suitable"
  ];

  function normalizeAreaId(areaId) {
    if (!areaId || areaId === "all") return areaId || "covent-garden";
    if (areaId === "st-pauls") return "st-pauls-cheapside";
    return areaId;
  }

  function isValidEmail(email) {
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
  }

  function parseTimestamp(value) {
    if (!value) return 0;
    var t = Date.parse(String(value));
    return isNaN(t) ? 0 : t;
  }

  function newerTimestamp(a, b) {
    return parseTimestamp(a) >= parseTimestamp(b) ? a : b;
  }

  /** Derive warm / follow-up from outcome + captured contact (legacy fields preserved in storage). */
  function deriveFlags(outcome, person, email) {
    var hasContact = !!(String(person || "").trim() || String(email || "").trim());
    if (outcome === "good_conversation") {
      return { warm: true, followUp: true };
    }
    if (outcome === "leaflet_left" || outcome === "reception_only") {
      return { warm: false, followUp: hasContact };
    }
    if (outcome === "could_not_get_in" || outcome === "not_suitable" || outcome === "not_visited") {
      return { warm: false, followUp: false };
    }
    return { warm: false, followUp: false };
  }

  function emptyVisit() {
    return {
      outcome: "not_visited",
      person: "",
      role: "",
      email: "",
      linkedin: "",
      notes: "",
      warm: false,
      followUp: false,
      savedAt: null,
      updatedAt: null
    };
  }

  /**
   * Normalize a visit for save. Resetting to not_visited clears contact fields.
   * Preserves legacy role/linkedin when not clearing.
   */
  function normalizeVisitForSave(input, existing) {
    var prev = existing || emptyVisit();
    var outcome = String((input && input.outcome) || "not_visited");
    if (SAVEABLE_OUTCOMES.indexOf(outcome) === -1 && outcome !== "not_visited") {
      outcome = "not_visited";
    }

    if (outcome === "not_visited") {
      return {
        outcome: "not_visited",
        person: "",
        role: "",
        email: "",
        linkedin: "",
        notes: "",
        warm: false,
        followUp: false,
        savedAt: null,
        updatedAt: (input && input.updatedAt) || new Date().toISOString()
      };
    }

    var person = String((input && input.person) != null ? input.person : prev.person || "").trim();
    var email = String((input && input.email) != null ? input.email : prev.email || "").trim();
    var notes = String((input && input.notes) != null ? input.notes : prev.notes || "").trim();
    var role = String((input && input.role) != null ? input.role : prev.role || "").trim();
    var linkedin = String((input && input.linkedin) != null ? input.linkedin : prev.linkedin || "").trim();
    var flags = deriveFlags(outcome, person, email);
    var now = (input && input.updatedAt) || new Date().toISOString();

    return {
      outcome: outcome,
      person: person,
      role: role,
      email: email,
      linkedin: linkedin,
      notes: notes,
      warm: flags.warm,
      followUp: flags.followUp,
      savedAt: (input && input.savedAt) || prev.savedAt || now,
      updatedAt: now
    };
  }

  function isVisited(visit) {
    return !!(visit && visit.outcome && visit.outcome !== "not_visited");
  }

  function visitUpdatedAt(visit) {
    if (!visit) return null;
    return visit.updatedAt || visit.savedAt || null;
  }

  /**
   * Merge local and cloud visit maps. Newest updatedAt wins per venue.
   * Returns { visits, pendingIds } where pendingIds need re-upload.
   */
  function mergeVisitMaps(localMap, cloudMap) {
    var local = localMap || {};
    var cloud = cloudMap || {};
    var ids = {};
    Object.keys(local).forEach(function (id) {
      ids[id] = true;
    });
    Object.keys(cloud).forEach(function (id) {
      ids[id] = true;
    });

    var merged = {};
    var pendingIds = [];

    Object.keys(ids).forEach(function (id) {
      var loc = local[id];
      var clo = cloud[id];
      if (loc && !clo) {
        merged[id] = loc;
        if (isVisited(loc) || loc.updatedAt || loc.savedAt) pendingIds.push(id);
        return;
      }
      if (clo && !loc) {
        merged[id] = clo;
        return;
      }
      var localTs = parseTimestamp(visitUpdatedAt(loc));
      var cloudTs = parseTimestamp(visitUpdatedAt(clo));
      if (localTs > cloudTs) {
        merged[id] = loc;
        pendingIds.push(id);
      } else if (cloudTs > localTs) {
        merged[id] = clo;
      } else {
        merged[id] = loc;
      }
    });

    return { visits: merged, pendingIds: pendingIds };
  }

  /**
   * Merge custom place arrays by id. Newest updatedAt wins.
   */
  function mergePlaceLists(localList, cloudList) {
    var byId = {};
    var pendingIds = [];
    (cloudList || []).forEach(function (p) {
      if (p && p.id) byId[p.id] = Object.assign({}, p);
    });
    (localList || []).forEach(function (p) {
      if (!p || !p.id) return;
      var existing = byId[p.id];
      if (!existing) {
        byId[p.id] = Object.assign({}, p);
        pendingIds.push(p.id);
        return;
      }
      var localTs = parseTimestamp(p.updatedAt || p.createdAt);
      var cloudTs = parseTimestamp(existing.updatedAt || existing.createdAt);
      if (localTs >= cloudTs) {
        byId[p.id] = Object.assign({}, p);
        if (localTs > cloudTs) pendingIds.push(p.id);
      }
    });
    return {
      places: Object.keys(byId).map(function (id) {
        return byId[id];
      }),
      pendingIds: pendingIds
    };
  }

  function serializePlace(place) {
    var now = new Date().toISOString();
    return {
      id: place.id,
      name: place.name || "",
      address: place.address || "",
      type: place.type || "",
      phone: place.phone || "",
      warmSeed: !!place.warmSeed,
      area: normalizeAreaId(place.area || "covent-garden"),
      cluster: place.cluster || "added-nearby",
      routeOrder: place.routeOrder != null ? place.routeOrder : 999,
      updatedAt: place.updatedAt || now
    };
  }

  function placeToRow(place) {
    var p = serializePlace(place);
    return {
      id: p.id,
      name: p.name,
      address: p.address,
      type: p.type,
      phone: p.phone,
      warm_seed: p.warmSeed,
      area: p.area,
      cluster: p.cluster,
      route_order: p.routeOrder,
      updated_at: p.updatedAt
    };
  }

  function placeFromRow(row) {
    return {
      id: row.id,
      name: row.name || "",
      address: row.address || "",
      type: row.type || "",
      phone: row.phone || "",
      warmSeed: !!row.warm_seed,
      area: normalizeAreaId(row.area || "covent-garden"),
      cluster: row.cluster || "added-nearby",
      routeOrder: row.route_order != null ? row.route_order : 999,
      updatedAt: row.updated_at || row.created_at || null
    };
  }

  function visitToRow(id, visit) {
    var v = normalizeVisitForSave(visit, visit);
    return {
      venue_id: id,
      outcome: v.outcome || "not_visited",
      person: v.person || "",
      role: v.role || "",
      email: v.email || "",
      linkedin: v.linkedin || "",
      notes: v.notes || "",
      warm: !!v.warm,
      follow_up: !!v.followUp,
      saved_at: v.savedAt || null,
      updated_at: v.updatedAt || v.savedAt || new Date().toISOString()
    };
  }

  function visitFromRow(row) {
    return {
      outcome: row.outcome || "not_visited",
      person: row.person || "",
      role: row.role || "",
      email: row.email || "",
      linkedin: row.linkedin || "",
      notes: row.notes || "",
      warm: !!row.warm,
      followUp: !!row.follow_up,
      savedAt: row.saved_at || null,
      updatedAt: row.updated_at || row.saved_at || null
    };
  }

  /**
   * Migrate legacy combined Me & You / Curious visit onto the new primary ID.
   * Does not delete the legacy key (kept for history / search).
   */
  function migrateLegacyCombinedVenue(visits) {
    var map = Object.assign({}, visits || {});
    var legacy = map["me-and-you-curious"];
    if (!legacy) return map;
    if (!map["me-and-you-productions"]) {
      map["me-and-you-productions"] = Object.assign({}, legacy, {
        notes: [legacy.notes, "[Migrated from combined Me and You + Curious card]"]
          .filter(Boolean)
          .join("\n\n")
          .trim(),
        updatedAt: newerTimestamp(legacy.updatedAt || legacy.savedAt, new Date().toISOString())
      });
    }
    return map;
  }

  return {
    OUTCOME_LABELS: OUTCOME_LABELS,
    SAVEABLE_OUTCOMES: SAVEABLE_OUTCOMES,
    normalizeAreaId: normalizeAreaId,
    isValidEmail: isValidEmail,
    parseTimestamp: parseTimestamp,
    deriveFlags: deriveFlags,
    emptyVisit: emptyVisit,
    normalizeVisitForSave: normalizeVisitForSave,
    isVisited: isVisited,
    visitUpdatedAt: visitUpdatedAt,
    mergeVisitMaps: mergeVisitMaps,
    mergePlaceLists: mergePlaceLists,
    serializePlace: serializePlace,
    placeToRow: placeToRow,
    placeFromRow: placeFromRow,
    visitToRow: visitToRow,
    visitFromRow: visitFromRow,
    migrateLegacyCombinedVenue: migrateLegacyCombinedVenue
  };
});
