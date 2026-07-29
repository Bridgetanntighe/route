#!/usr/bin/env node
"use strict";

var assert = require("assert");
var Core = require("../outreach-core.js");

var passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log("ok - " + name);
  } catch (err) {
    console.error("FAIL - " + name);
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
  }
}

test("deriveFlags: good conversation is warm + follow-up", function () {
  var f = Core.deriveFlags("good_conversation", "", "");
  assert.strictEqual(f.warm, true);
  assert.strictEqual(f.followUp, true);
});

test("deriveFlags: leaflet with email needs follow-up", function () {
  var f = Core.deriveFlags("leaflet_left", "", "a@b.com");
  assert.strictEqual(f.warm, false);
  assert.strictEqual(f.followUp, true);
});

test("deriveFlags: leaflet without contact is not follow-up", function () {
  var f = Core.deriveFlags("leaflet_left", "", "");
  assert.strictEqual(f.followUp, false);
});

test("deriveFlags: could not get in clears warm/follow-up", function () {
  var f = Core.deriveFlags("could_not_get_in", "Sam", "a@b.com");
  assert.strictEqual(f.warm, false);
  assert.strictEqual(f.followUp, false);
});

test("normalizeVisitForSave clears contact on not_visited", function () {
  var saved = Core.normalizeVisitForSave(
    { outcome: "not_visited" },
    {
      outcome: "good_conversation",
      person: "Sam",
      role: "OM",
      email: "a@b.com",
      notes: "hi",
      warm: true,
      followUp: true,
      savedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    }
  );
  assert.strictEqual(saved.outcome, "not_visited");
  assert.strictEqual(saved.person, "");
  assert.strictEqual(saved.email, "");
  assert.strictEqual(saved.notes, "");
  assert.strictEqual(saved.role, "");
  assert.strictEqual(saved.warm, false);
  assert.strictEqual(saved.followUp, false);
  assert.strictEqual(saved.savedAt, null);
});

test("normalizeVisitForSave preserves legacy role/linkedin", function () {
  var saved = Core.normalizeVisitForSave(
    { outcome: "reception_only", person: "Sam", email: "", notes: "left card" },
    { role: "EA", linkedin: "https://www.linkedin.com/in/x", outcome: "not_visited" }
  );
  assert.strictEqual(saved.role, "EA");
  assert.strictEqual(saved.linkedin, "https://www.linkedin.com/in/x");
  assert.strictEqual(saved.followUp, true);
});

test("mergeVisitMaps: newer local wins and stays pending", function () {
  var merged = Core.mergeVisitMaps(
    {
      a: {
        outcome: "leaflet_left",
        updatedAt: "2026-07-29T12:00:00.000Z",
        person: "Local"
      }
    },
    {
      a: {
        outcome: "reception_only",
        updatedAt: "2026-07-29T11:00:00.000Z",
        person: "Cloud"
      }
    }
  );
  assert.strictEqual(merged.visits.a.person, "Local");
  assert.deepStrictEqual(merged.pendingIds, ["a"]);
});

test("mergeVisitMaps: newer cloud wins", function () {
  var merged = Core.mergeVisitMaps(
    {
      a: {
        outcome: "leaflet_left",
        updatedAt: "2026-07-29T10:00:00.000Z",
        person: "Local"
      }
    },
    {
      a: {
        outcome: "good_conversation",
        updatedAt: "2026-07-29T12:00:00.000Z",
        person: "Cloud"
      }
    }
  );
  assert.strictEqual(merged.visits.a.person, "Cloud");
  assert.deepStrictEqual(merged.pendingIds, []);
});

test("placeToRow / placeFromRow round-trip keeps area cluster route_order", function () {
  var row = Core.placeToRow({
    id: "custom-1",
    name: "Test Co",
    address: "1 Test St",
    area: "st-pauls",
    cluster: "added-nearby",
    routeOrder: 12,
    updatedAt: "2026-07-29T12:00:00.000Z"
  });
  assert.strictEqual(row.area, "st-pauls-cheapside");
  assert.strictEqual(row.cluster, "added-nearby");
  assert.strictEqual(row.route_order, 12);
  var back = Core.placeFromRow(row);
  assert.strictEqual(back.area, "st-pauls-cheapside");
  assert.strictEqual(back.cluster, "added-nearby");
  assert.strictEqual(back.routeOrder, 12);
});

test("mergePlaceLists prefers newer local custom place", function () {
  var merged = Core.mergePlaceLists(
    [
      {
        id: "custom-1",
        name: "Local Name",
        area: "st-pauls-cheapside",
        updatedAt: "2026-07-29T13:00:00.000Z"
      }
    ],
    [
      {
        id: "custom-1",
        name: "Cloud Name",
        area: "covent-garden",
        updatedAt: "2026-07-29T12:00:00.000Z"
      }
    ]
  );
  assert.strictEqual(merged.places.length, 1);
  assert.strictEqual(merged.places[0].name, "Local Name");
  assert.strictEqual(merged.places[0].area, "st-pauls-cheapside");
  assert.deepStrictEqual(merged.pendingIds, ["custom-1"]);
});

test("migrateLegacyCombinedVenue copies visit to me-and-you-productions", function () {
  var out = Core.migrateLegacyCombinedVenue({
    "me-and-you-curious": {
      outcome: "leaflet_left",
      person: "Alex",
      notes: "left leaflet",
      savedAt: "2026-07-01T00:00:00.000Z"
    }
  });
  assert.ok(out["me-and-you-productions"]);
  assert.strictEqual(out["me-and-you-productions"].person, "Alex");
  assert.ok(out["me-and-you-curious"]);
  assert.ok(String(out["me-and-you-productions"].notes).indexOf("Migrated") !== -1);
});

test("isValidEmail rejects bad values", function () {
  assert.strictEqual(Core.isValidEmail("not-an-email"), false);
  assert.strictEqual(Core.isValidEmail("a@b.com"), true);
  assert.strictEqual(Core.isValidEmail(""), true);
});

test("visitToRow includes updated_at and derived flags", function () {
  var row = Core.visitToRow("msq-partners", {
    outcome: "good_conversation",
    person: "Jess",
    email: "j@x.com",
    notes: "chat"
  });
  assert.strictEqual(row.venue_id, "msq-partners");
  assert.strictEqual(row.warm, true);
  assert.strictEqual(row.follow_up, true);
  assert.ok(row.updated_at);
});

console.log("\n" + passed + " tests passed");
if (process.exitCode) {
  console.error("Some tests failed");
  process.exit(1);
}
