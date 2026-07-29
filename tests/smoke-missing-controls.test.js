#!/usr/bin/env node
"use strict";

/**
 * Smoke: missing optional controls must not prevent route render.
 * Simulates a mismatched/cached HTML shell against app.v2.js behaviour.
 */
var assert = require("assert");
var fs = require("fs");
var vm = require("vm");
var path = require("path");

var Core = require("../outreach-core.js");

function makeEl(id) {
  return {
    id: id,
    style: {},
    hidden: false,
    open: false,
    value: "",
    innerHTML: "",
    textContent: "",
    classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } },
    setAttribute: function () {},
    getAttribute: function () { return null; },
    addEventListener: function () {},
    querySelectorAll: function () { return []; },
    querySelector: function () { return null; },
    contains: function () { return false; },
    blur: function () {},
    focus: function () {},
    reset: function () {},
    elements: {}
  };
}

var route = makeEl("route-list");
route.querySelectorAll = function () { return []; };

var elsMap = {
  "route-list": route,
  "stat-to-visit": makeEl("stat-to-visit"),
  "stat-good": makeEl("stat-good"),
  "stat-followup": makeEl("stat-followup"),
  "area-location": makeEl("area-location"),
  "boot-error": Object.assign(makeEl("boot-error"), { hidden: true })
  // Intentionally omit: search-input, filters, add-place-btn, sheet, toast, controls-collapse
};

var store = {};
var doc = {
  readyState: "complete",
  body: makeEl("body"),
  getElementById: function (id) {
    return elsMap[id] || null;
  },
  querySelectorAll: function () {
    return [];
  },
  querySelector: function () {
    return null;
  },
  addEventListener: function () {},
  createElement: function (tag) {
    return makeEl(tag);
  }
};

var sandbox = {
  OutreachCore: Core,
  document: doc,
  window: {
    OutreachCore: Core,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    scrollY: 0,
    scrollTo: function () {},
    localStorage: {
      getItem: function (k) { return store[k] || null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; }
    },
    location: { href: "http://localhost/", origin: "http://localhost", pathname: "/" },
    supabase: undefined,
    addEventListener: function () {}
  },
  navigator: {},
  console: console,
  localStorage: null,
  Set: Set,
  Promise: Promise,
  URLSearchParams: URLSearchParams,
  Date: Date,
  Array: Array,
  Object: Object,
  String: String,
  Number: Number,
  Boolean: Boolean,
  Math: Math,
  JSON: JSON,
  Error: Error,
  parseInt: parseInt,
  parseFloat: parseFloat,
  isNaN: isNaN,
  encodeURIComponent: encodeURIComponent,
  decodeURIComponent: decodeURIComponent,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout
};
sandbox.window.document = doc;
sandbox.localStorage = sandbox.window.localStorage;
sandbox.self = sandbox.window;

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../assets/app.v2.js"), "utf8"), sandbox, {
  filename: "app.v2.js"
});

setTimeout(function () {
  var cards = (route.innerHTML.match(/venue-card/g) || []).length;
  var empty = /No places match/.test(route.innerHTML);
  var boot = elsMap["boot-error"];
  console.log("cards:", cards);
  console.log("empty:", empty);
  console.log("boot hidden:", boot.hidden, "text:", boot.textContent);
  assert.ok(cards >= 17, "expected seeded offices to render without optional controls");
  assert.strictEqual(empty, false);
  assert.strictEqual(boot.hidden, true);
  console.log("ok - missing optional controls do not blank the route list");
}, 80);
