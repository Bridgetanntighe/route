(function () {
  "use strict";

  var STORAGE_VISITS = "cgc-outreach-v1-visits";
  var STORAGE_PLACES = "cgc-outreach-v1-places";

  var SUPABASE_URL = "https://athqfnbwchxvtozrqfcj.supabase.co";
  var SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ciawUoKC7kWslcvOtEWS6g_BDhytl9P";

  var sb = null;
  var cloudReady = false;

  var RECEPTION_INTRO =
    "Hi, we're Covent Garden Catering from The Market nearby. We deliver breakfast, working lunches and grazing boards to local offices. I'm dropping off our menu — who usually organises catering for meetings or team days? Could I take their first name and email so I can send the digital menu too?";

  var OUTCOME_LABELS = {
    not_visited: "Not visited",
    good_conversation: "Good conversation",
    leaflet_left: "Leaflet left",
    reception_only: "Reception only",
    could_not_get_in: "Could not get in",
    not_suitable: "Not suitable"
  };

  var SECTIONS = [
    { id: "leg-a", label: "Leg A — Bow Street · 9:00am", legClass: "leg-a" },
    { id: "leg-b", label: "Leg B — Slingsby Place & St Martin's Lane · 9:35am", legClass: "leg-b" },
    { id: "leg-c", label: "Leg C — Long Acre & Parker Street · 10:25am", legClass: "leg-c" },
    { id: "leg-d", label: "Leg D — Holborn cluster · 11:05am", legClass: "leg-d" },
    { id: "leg-e", label: "Leg E — Short's Gardens & Kingsway · 12:00pm", legClass: "leg-e" },
    { id: "bonus", label: "Bonus — On the way back to base", legClass: "bonus" },
    { id: "added", label: "Added nearby", legClass: "added" }
  ];

  /** Original route venues — preserve all company, address, phone, maps, and sales-angle data. */
  var VENUES = [
    {
      id: "msq-partners",
      section: "leg-a",
      routeNumber: 1,
      name: "MSQ Partners",
      type: "Marketing Agency Group",
      address: "34 Bow St, WC2E 7AU",
      walk: "2 min walk",
      score: 10,
      tags: [
        { className: "tag-warm", text: "Warm — Jessica Smith in DB" },
        { className: "tag-multi", text: "+The Gate (same building)" }
      ],
      phone: "+44 20 3026 6000",
      phoneHref: "+442030266000",
      phoneLabel: "+44 20 3026 6000",
      mapsQuery: "34 Bow St, London WC2E 7AU",
      angle:
        "Ask for Jessica Smith by name. \"Hi — we're your neighbours at The Market, literally 2 mins away. Premium office catering — boardroom boards and team lunches, next-day delivery. I've brought a menu for Jessica.\""
    },
    {
      id: "the-gate-london",
      section: "leg-a",
      routeNumber: 2,
      name: "The Gate London",
      type: "Creative / Integrated Agency",
      address: "34 Bow St, WC2E 7AU",
      walk: "Same building as MSQ",
      score: 9,
      tags: [{ className: "tag-new", text: "New find" }],
      phone: "+44 20 7927 3555",
      phoneHref: "+442079273555",
      phoneLabel: "+44 20 7927 3555",
      mapsQuery: "34 Bow St, London WC2E 7AU",
      angle:
        "Same building — ask for the Office Manager at The Gate's floor. \"Premium catering from The Market — team lunches and client meeting boards, next-day delivery. Could I leave a menu?\""
    },
    {
      id: "kearney-consulting",
      section: "leg-a",
      routeNumber: 3,
      name: "Kearney Consulting",
      type: "Global Management Consultancy",
      address: "The Adelphi, 1–11 John Adam St, WC2N 6HT",
      walk: "4 min",
      score: 10,
      tags: [{ className: "tag-new", text: "New find" }],
      phone: "+44 20 7468 8000",
      phoneHref: "+442074688000",
      phoneLabel: "+44 20 7468 8000",
      mapsQuery: "The Adelphi, 1 John Adam St, London WC2N 6HT",
      angle:
        "\"Hi — we're Covent Garden Catering, delivering premium boardroom platters and working lunches from The Market next door. Who handles catering for client meetings here? Could I leave a menu for them?\""
    },
    {
      id: "pha-group",
      section: "leg-b",
      routeNumber: 4,
      name: "The PHA Group",
      type: "PR & Communications Agency",
      address: "11 Slingsby Pl, WC2E 9AB",
      walk: "5 min",
      score: 9,
      tags: [{ className: "tag-new", text: "New find · 5★ Google" }],
      phone: "+44 20 7025 1350",
      phoneHref: "+442070251350",
      phoneLabel: "+44 20 7025 1350",
      mapsQuery: "11 Slingsby Place, London WC2E 9AB",
      angle:
        "\"Hi — we're your neighbours from The Market, just round the corner. Premium office catering — team breakfasts and working lunches, halal-friendly, next-day delivery. Could I leave a menu for whoever handles your team food?\""
    },
    {
      id: "rooster-marketing",
      section: "leg-b",
      routeNumber: 5,
      name: "Rooster Marketing",
      type: "Boutique Marketing Agency",
      address: "60 St Martin's Ln, WC2N 4JS",
      walk: "5 min",
      score: 9,
      tags: [{ className: "tag-new", text: "New find · 5★ Google" }],
      phone: "+44 20 3621 6644",
      phoneHref: "+442036216644",
      phoneLabel: "+44 20 3621 6644",
      mapsQuery: "60 St Martin's Lane, London WC2N 4JS",
      angle:
        "\"Hi — Covent Garden Catering here. We deliver premium breakfast boards and team lunches from The Market nearby. Could I leave a menu for the team?\""
    },
    {
      id: "carnival-film",
      section: "leg-b",
      routeNumber: 6,
      name: "Carnival Film & Television",
      type: "TV / Film Production Company",
      address: "101 St Martin's Ln, WC2N 4AZ",
      walk: "7 min",
      score: 8,
      tags: [{ className: "tag-new", text: "New find" }],
      phone: "+44 20 3618 6600",
      phoneHref: "+442036186600",
      phoneLabel: "+44 20 3618 6600",
      mapsQuery: "101 St Martin's Lane, London WC2N 4AZ",
      angle:
        "\"Hi — we cater for production offices and shoot days — premium platters and boards delivered next day from Covent Garden. Could I leave a menu for your production coordinator or office manager?\""
    },
    {
      id: "covent-garden-recruitment",
      section: "leg-b",
      routeNumber: 7,
      name: "Covent Garden Recruitment",
      type: "Recruitment Agency",
      address: "3rd Floor, 9 Irving St, WC2H 7AH",
      walk: "7 min",
      score: 8,
      tags: [{ className: "tag-new", text: "New find · 4.8★ Google" }],
      phone: "+44 20 3675 8800",
      phoneHref: "+442036758800",
      phoneLabel: "+44 20 3675 8800",
      mapsQuery: "9 Irving Street, London WC2H 7AH",
      angle:
        "\"Hi — we're Covent Garden Catering from The Market. You're literally neighbours! We do team breakfasts and client meeting platters — halal-friendly, next-day delivery. Could I leave a menu for your office manager?\""
    },
    {
      id: "me-and-you-curious",
      section: "leg-c",
      routeNumber: 8,
      name: "Me and You Productions + Curious PR",
      type: "Production Co + PR Agency",
      address: "39 Long Acre, WC2E 9LG",
      walk: "5 min · Two companies, one building",
      score: 9,
      tags: [
        { className: "tag-new", text: "New finds" },
        { className: "tag-multi", text: "2 stops, 1 building" }
      ],
      phone: "+44 20 3397 9111",
      phoneHref: "+442033979111",
      phoneLabel: "Curious PR: +44 20 3397 9111",
      mapsQuery: "39 Long Acre, London WC2E 9LG",
      angle:
        "Ask for both companies at reception. Production: \"We supply catering for production offices — boards and shoot-day platters, next-day delivery from Covent Garden.\" PR (Curious PR): \"Premium catering for client meetings and team lunches.\""
    },
    {
      id: "pb-creative",
      section: "leg-c",
      routeNumber: 9,
      name: "PB Creative",
      type: "Design / Creative Agency",
      address: "40–42 Parker St, WC2B 5PQ",
      walk: "7 min",
      score: 8,
      tags: [{ className: "tag-new", text: "New find" }],
      phone: "+44 20 7836 3067",
      phoneHref: "+442078363067",
      phoneLabel: "+44 20 7836 3067",
      mapsQuery: "40 Parker Street, London WC2B 5PQ",
      angle:
        "\"Hi — Covent Garden Catering. Premium office catering for creative teams — next-day delivery from The Market in Covent Garden. Could I leave a menu for whoever looks after your team?\""
    },
    {
      id: "kindred-agency",
      section: "leg-c",
      routeNumber: 10,
      name: "Kindred Agency",
      type: "Creative Agency",
      address: "17 Macklin St, WC2B 5NR",
      walk: "8 min",
      score: 9,
      tags: [{ className: "tag-warm", text: "Warm — previously contacted · hello@wearekindred.com" }],
      phone: "+44 20 4524 5900",
      phoneHref: "+442045245900",
      phoneLabel: "+44 20 4524 5900",
      mapsQuery: "17 Macklin Street, London WC2B 5NR",
      angle:
        "\"Hi — I emailed hello@wearekindred.com earlier this week. We're the catering service from The Market just nearby. Is the office manager or studio manager around for a quick hello?\""
    },
    {
      id: "academy-films",
      section: "leg-d",
      routeNumber: 11,
      name: "Academy Films",
      type: "Award-Winning Film Production",
      address: "16 W Central St, WC1A 1JJ",
      walk: "6 min",
      score: 8,
      tags: [{ className: "tag-new", text: "New find · 4.9★ Google" }],
      phone: "+44 20 7395 4155",
      phoneHref: "+442073954155",
      phoneLabel: "+44 20 7395 4155",
      mapsQuery: "16 West Central Street, London WC1A 1JJ",
      angle:
        "\"Hi — we do premium catering for production offices — boards and platters for shoot days and team lunches. We're just down the road at The Market in Covent Garden. Is the production coordinator or office manager in?\""
    },
    {
      id: "blick-rothenberg",
      section: "leg-d",
      routeNumber: 12,
      name: "Blick Rothenberg",
      type: "Accountancy & Advisory (100–200 staff)",
      address: "16 Great Queen St, WC2B 5AH",
      walk: "4 min",
      score: 8,
      tags: [{ className: "tag-new", text: "New find · 4.4★ Google" }],
      phone: "+44 20 7486 0111",
      phoneHref: "+442074860111",
      phoneLabel: "+44 20 7486 0111",
      mapsQuery: "16 Great Queen Street, London WC2B 5AH",
      angle:
        "Boardroom only: \"Premium boardroom platters and working lunches for client meetings — sourced properly, next-day delivery from Covent Garden. Could I leave a menu for your EA or PA?\""
    },
    {
      id: "collective-london",
      section: "leg-d",
      routeNumber: 13,
      name: "Collective London",
      type: "Creative & Marketing Agency",
      address: "20 Red Lion St, WC1R 4PS",
      walk: "5 min",
      score: 9,
      tags: [{ className: "tag-new", text: "New find · 5★ Google" }],
      phone: "+44 20 7843 3555",
      phoneHref: "+442078433555",
      phoneLabel: "+44 20 7843 3555",
      mapsQuery: "20 Red Lion Street, London WC1R 4PS",
      angle:
        "\"Hi — we're your neighbours from The Market in Covent Garden. Premium catering for creative offices and event days — halal-friendly, next-day delivery. Could I leave a menu?\""
    },
    {
      id: "passion-digital",
      section: "leg-d",
      routeNumber: 14,
      name: "Passion Digital",
      type: "Digital Marketing Agency",
      address: "4th Floor, 137–144 New Oxford St, WC1V 6PL",
      walk: "4 min",
      score: 8,
      tags: [{ className: "tag-new", text: "New find · 4.8★ Google" }],
      phone: "+44 20 3432 1360",
      phoneHref: "+442034321360",
      phoneLabel: "+44 20 3432 1360",
      mapsQuery: "Holborn Tower 137 New Oxford Street London WC1V 6PL",
      angle:
        "\"Hi — we're Covent Garden Catering, delivering premium office breakfasts and lunches from The Market in Covent Garden. Could I leave a menu for whoever looks after your team catering?\""
    },
    {
      id: "karma-live",
      section: "leg-e",
      routeNumber: 15,
      name: "Karma (Live Production)",
      type: "Video & Live Events Production",
      address: "56 Short's Gardens, WC2H 9AN",
      walk: "5 min back toward base",
      score: 9,
      tags: [{ className: "tag-new", text: "New find · 5★ · 62 reviews" }],
      phone: "",
      phoneHref: "",
      phoneLabel: "",
      mapsQuery: "56 Short's Gardens, London WC2H 9AN",
      angle:
        "\"Hi — we supply premium platters and breakfast boards for production days and shoot crews — sourced properly, next-day delivery from The Market in Covent Garden. Is there a production manager or operations person I could speak to?\""
    },
    {
      id: "purple-pr",
      section: "leg-e",
      routeNumber: 16,
      name: "Purple PR Westminster",
      type: "PR Agency",
      address: "7th Floor, 1 Kingsway, WC2B 4BG",
      walk: "10 min",
      score: 8,
      tags: [{ className: "tag-new", text: "New find" }],
      phone: "+44 20 7439 9888",
      phoneHref: "+442074399888",
      phoneLabel: "+44 20 7439 9888",
      mapsQuery: "1 Kingsway, London WC2B 4BG",
      angle:
        "\"Premium office catering for client meetings and team lunches — next-day delivery from Covent Garden. Could I leave a menu for your office manager?\""
    },
    {
      id: "greenwich-consulting",
      section: "bonus",
      routeNumber: 17,
      name: "Greenwich Consulting",
      type: "Consulting Firm",
      address: "7 Henrietta St, WC2E 8PS",
      walk: "3 min from base",
      score: 7,
      tags: [],
      phone: "+44 20 7470 5615",
      phoneHref: "+442074705615",
      phoneLabel: "+44 20 7470 5615",
      mapsQuery: "7 Henrietta Street, London WC2E 8PS",
      angle:
        "Brief drop on the way back. Leave menu + business card. \"Catering from The Market for client meetings — next-day delivery.\""
    }
  ];

  var state = {
    visits: {},
    customPlaces: [],
    search: "",
    filter: "all"
  };

  var els = {};
  var toastTimer = null;

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function safeTelHref(phone) {
    var cleaned = String(phone || "").replace(/[^\d+]/g, "");
    if (!cleaned) return "";
    return "tel:" + cleaned;
  }

  function mapsHref(query) {
    var q = String(query || "").trim();
    if (!q) return "";
    return "https://maps.google.com/?q=" + encodeURIComponent(q);
  }

  function isValidEmail(email) {
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function firstName(fullName) {
    var parts = String(fullName || "").trim().split(/\s+/);
    return parts[0] || "there";
  }

  function mailtoHref(email, personName) {
    var subject = "Covent Garden Catering — lovely to meet you";
    var body =
      "Hi " +
      firstName(personName) +
      ",\n\n" +
      "It was lovely to meet you earlier today. I wanted to make sure our catering menu reached you.\n\n" +
      "We deliver office breakfasts, working lunches and grazing boards from The Market in Covent Garden, with next-day options available for local offices.\n\n" +
      "If you have an upcoming meeting or team day, I'd be happy to recommend a suitable menu.\n\n" +
      "Best,\n" +
      "Covent Garden Catering";
    return (
      "mailto:" +
      encodeURIComponent(email) +
      "?subject=" +
      encodeURIComponent(subject) +
      "&body=" +
      encodeURIComponent(body)
    );
  }

  function loadJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (err) {
      showToast("Could not read saved data on this phone.");
      return fallback;
    }
  }

  function saveJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      showToast("Could not save on this phone. Storage may be full or blocked.");
      return false;
    }
  }

  function initSupabase() {
    try {
      if (window.supabase && typeof window.supabase.createClient === "function") {
        sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
      }
    } catch (err) {
      sb = null;
    }
  }

  function loadState() {
    state.visits = loadJson(STORAGE_VISITS, {}) || {};
    state.customPlaces = loadJson(STORAGE_PLACES, []) || [];
    if (!Array.isArray(state.customPlaces)) state.customPlaces = [];
  }

  function visitFromRow(row) {
    return {
      outcome: row.outcome || "not_visited",
      person: row.person || "",
      role: row.role || "",
      email: row.email || "",
      notes: row.notes || "",
      warm: !!row.warm,
      followUp: !!row.follow_up,
      savedAt: row.saved_at || null
    };
  }

  function placeFromRow(row) {
    return {
      id: row.id,
      routeNumber: "+",
      name: row.name || "",
      address: row.address || "",
      type: row.type || "",
      phone: row.phone || "",
      warmSeed: !!row.warm_seed
    };
  }

  function visitToRow(id, visit) {
    return {
      venue_id: id,
      outcome: visit.outcome || "not_visited",
      person: visit.person || "",
      role: visit.role || "",
      email: visit.email || "",
      notes: visit.notes || "",
      warm: !!visit.warm,
      follow_up: !!visit.followUp,
      saved_at: visit.savedAt || null,
      updated_at: new Date().toISOString()
    };
  }

  function placeToRow(place) {
    return {
      id: place.id,
      name: place.name || "",
      address: place.address || "",
      type: place.type || "",
      phone: place.phone || "",
      warm_seed: !!place.warmSeed
    };
  }

  async function loadFromCloud() {
    if (!sb) return false;
    try {
      var visitsRes = await sb.from("outreach_visits").select("*");
      var placesRes = await sb.from("outreach_places").select("*");

      if (visitsRes.error || placesRes.error) {
        var msg = (visitsRes.error && visitsRes.error.message) || (placesRes.error && placesRes.error.message) || "";
        if (/schema cache|does not exist|Could not find the table/i.test(msg)) {
          showToast("Cloud tables not set up yet. Run schema.sql in Supabase.");
          cloudReady = false;
          return false;
        }
        showToast("Could not load from cloud. Using phone backup.");
        cloudReady = false;
        return false;
      }

      cloudReady = true;
      var cloudVisits = {};
      var rows = visitsRes.data || [];
      for (var i = 0; i < rows.length; i++) {
        cloudVisits[rows[i].venue_id] = visitFromRow(rows[i]);
      }

      var cloudPlaces = [];
      var placeRows = placesRes.data || [];
      for (var j = 0; j < placeRows.length; j++) {
        cloudPlaces.push(placeFromRow(placeRows[j]));
      }

      state.visits = Object.assign({}, state.visits, cloudVisits);
      if (cloudPlaces.length) {
        var byId = {};
        for (var k = 0; k < state.customPlaces.length; k++) {
          byId[state.customPlaces[k].id] = state.customPlaces[k];
        }
        for (var m = 0; m < cloudPlaces.length; m++) {
          byId[cloudPlaces[m].id] = cloudPlaces[m];
        }
        state.customPlaces = Object.keys(byId).map(function (id) {
          return byId[id];
        });
      }

      saveJson(STORAGE_VISITS, state.visits);
      saveJson(STORAGE_PLACES, state.customPlaces);
      return true;
    } catch (err) {
      cloudReady = false;
      showToast("Could not reach cloud. Using phone backup.");
      return false;
    }
  }

  function persistVisits() {
    return saveJson(STORAGE_VISITS, state.visits);
  }

  function persistPlaces() {
    return saveJson(STORAGE_PLACES, state.customPlaces);
  }

  async function cloudUpsertVisit(id, visit) {
    if (!sb) return false;
    try {
      var res = await sb.from("outreach_visits").upsert(visitToRow(id, visit));
      if (res.error) {
        console.warn(res.error);
        if (/schema cache|does not exist|Could not find the table/i.test(res.error.message || "")) {
          cloudReady = false;
          updateSaveNotice();
        }
        return false;
      }
      cloudReady = true;
      return true;
    } catch (err) {
      return false;
    }
  }

  async function cloudUpsertPlace(place) {
    if (!sb) return false;
    try {
      var res = await sb.from("outreach_places").upsert(placeToRow(place));
      if (res.error) {
        console.warn(res.error);
        if (/schema cache|does not exist|Could not find the table/i.test(res.error.message || "")) {
          cloudReady = false;
          updateSaveNotice();
        }
        return false;
      }
      cloudReady = true;
      return true;
    } catch (err) {
      return false;
    }
  }

  async function cloudDeletePlace(id) {
    if (!sb) return false;
    try {
      var placeRes = await sb.from("outreach_places").delete().eq("id", id);
      var visitRes = await sb.from("outreach_visits").delete().eq("venue_id", id);
      if (placeRes.error || visitRes.error) {
        console.warn(placeRes.error || visitRes.error);
        return false;
      }
      return true;
    } catch (err) {
      return false;
    }
  }

  function updateSaveNotice() {
    var el = document.getElementById("save-notice");
    if (!el) return;
    if (cloudReady) {
      el.textContent =
        "Saving to the cloud when online. Notes also stay on this phone as a backup.";
    } else {
      el.textContent =
        "Saved on this phone for now. After schema.sql is run in Supabase, notes will sync to the cloud.";
    }
  }

  function emptyVisit() {
    return {
      outcome: "not_visited",
      person: "",
      role: "",
      email: "",
      notes: "",
      warm: false,
      followUp: false,
      savedAt: null
    };
  }

  function getVisit(id) {
    var v = state.visits[id];
    if (!v) return emptyVisit();
    return {
      outcome: v.outcome || "not_visited",
      person: v.person || "",
      role: v.role || "",
      email: v.email || "",
      notes: v.notes || "",
      warm: !!v.warm,
      followUp: !!v.followUp,
      savedAt: v.savedAt || null
    };
  }

  function isVisited(visit) {
    return !!(visit && visit.outcome && visit.outcome !== "not_visited");
  }

  function hasSavedVisit(visit) {
    return !!(visit && visit.savedAt);
  }

  function isWarmPlace(venue, visit) {
    if (visit && visit.warm) return true;
    if (venue && venue.isCustom && venue.warmSeed) return true;
    if (venue && venue.tags) {
      for (var i = 0; i < venue.tags.length; i++) {
        if (venue.tags[i].className === "tag-warm") return true;
      }
    }
    return false;
  }

  function allPlaces() {
    var list = VENUES.slice();
    for (var i = 0; i < state.customPlaces.length; i++) {
      var p = state.customPlaces[i];
      list.push({
        id: p.id,
        section: "added",
        routeNumber: p.routeNumber || "+",
        name: p.name || "Untitled place",
        type: p.type || "",
        address: p.address || "",
        walk: "Added nearby",
        score: null,
        tags: p.warmSeed ? [{ className: "tag-warm", text: "Warm lead" }] : [],
        phone: p.phone || "",
        phoneHref: String(p.phone || "").replace(/[^\d+]/g, ""),
        phoneLabel: p.phone || "",
        mapsQuery: p.address || p.name || "",
        angle: "Custom stop added during the walk.",
        isCustom: true,
        warmSeed: !!p.warmSeed
      });
    }
    return list;
  }

  function placeMatchesSearch(venue, visit, query) {
    if (!query) return true;
    var hay = [
      venue.name,
      venue.type,
      venue.address,
      venue.walk,
      venue.angle,
      visit.person,
      visit.role,
      visit.email,
      visit.notes
    ]
      .join(" ")
      .toLowerCase();
    return hay.indexOf(query) !== -1;
  }

  function placeMatchesFilter(venue, visit) {
    var visited = isVisited(visit);
    if (state.filter === "all") return true;
    if (state.filter === "visited") return visited;
    if (state.filter === "not_visited") return !visited;
    if (state.filter === "warm") {
      return isWarmPlace(venue, visit) || !!(visit && visit.followUp);
    }
    return true;
  }

  function showToast(message) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      els.toast.hidden = true;
    }, 2800);
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (err) {
      /* fall through */
    }
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (err2) {
      return false;
    }
  }

  function formatDate() {
    var now = new Date();
    var opts = { weekday: "long", day: "numeric", month: "long", year: "numeric" };
    try {
      return now.toLocaleDateString("en-GB", opts);
    } catch (err) {
      return now.toDateString();
    }
  }

  function setWalkDate() {
    var el = document.getElementById("walk-date");
    if (!el) return;
    var now = new Date();
    el.dateTime = now.toISOString().slice(0, 10);
    el.textContent = formatDate();
  }

  function updateStats() {
    var places = allPlaces();
    var toVisit = 0;
    var good = 0;
    var followUps = 0;

    for (var i = 0; i < places.length; i++) {
      var visit = getVisit(places[i].id);
      if (!isVisited(visit)) toVisit += 1;
      if (visit.outcome === "good_conversation") good += 1;
      if (visit.followUp) followUps += 1;
    }

    els.statToVisit.textContent = String(toVisit);
    els.statGood.textContent = String(good);
    els.statFollowup.textContent = String(followUps);
  }

  function outcomeOptionsHtml(selected) {
    var keys = Object.keys(OUTCOME_LABELS);
    var html = "";
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      html +=
        '<option value="' +
        escapeHtml(key) +
        '"' +
        (selected === key ? " selected" : "") +
        ">" +
        escapeHtml(OUTCOME_LABELS[key]) +
        "</option>";
    }
    return html;
  }

  function tagsHtml(venue, visit) {
    var bits = [];
    if (venue.score != null) {
      bits.push('<span class="tag tag-score">Score ' + escapeHtml(venue.score) + "</span>");
    }
    if (venue.walk) {
      bits.push('<span class="tag tag-walk">' + escapeHtml(venue.walk) + "</span>");
    }
    if (venue.tags) {
      for (var i = 0; i < venue.tags.length; i++) {
        bits.push(
          '<span class="tag ' +
            escapeHtml(venue.tags[i].className) +
            '">' +
            escapeHtml(venue.tags[i].text) +
            "</span>"
        );
      }
    }
    if (visit.warm) {
      bits.push('<span class="tag tag-warm">Warm lead</span>');
    }
    if (visit.followUp) {
      bits.push('<span class="tag tag-followup">Needs follow-up</span>');
    }
    if (hasSavedVisit(visit) && isVisited(visit)) {
      var cls = visit.outcome === "good_conversation" ? "tag-good" : "tag-outcome";
      bits.push(
        '<span class="tag ' +
          cls +
          '">' +
          escapeHtml(OUTCOME_LABELS[visit.outcome] || visit.outcome) +
          "</span>"
      );
    }
    return bits.join("");
  }

  function summaryHtml(venue, visit) {
    if (!hasSavedVisit(visit) || !isVisited(visit)) return "";
    var classes = "visit-summary" + (visit.followUp ? " has-followup" : "");
    var html =
      '<div class="' +
      classes +
      '">' +
      "<h3>Saved visit</h3>" +
      "<p><strong>Outcome:</strong> " +
      escapeHtml(OUTCOME_LABELS[visit.outcome] || visit.outcome) +
      "</p>";
    if (visit.person || visit.role) {
      html +=
        "<p><strong>Contact:</strong> " +
        escapeHtml(visit.person || "—") +
        (visit.role ? " · " + escapeHtml(visit.role) : "") +
        "</p>";
    }
    if (visit.email) {
      html += "<p><strong>Email:</strong> " + escapeHtml(visit.email) + "</p>";
    }
    if (visit.notes) {
      html += "<p><strong>Notes:</strong> " + escapeHtml(visit.notes) + "</p>";
    }
    if (visit.followUp) {
      html += '<p><span class="tag tag-followup">Follow-up required</span></p>';
    }
    if (visit.email) {
      html +=
        '<a class="btn btn-secondary btn-small email-contact" href="' +
        escapeHtml(mailtoHref(visit.email, visit.person)) +
        '">Email contact</a>';
    }
    html += "</div>";
    return html;
  }

  function formHtml(venue, visit) {
    var saved = hasSavedVisit(visit) && isVisited(visit);
    var title = saved ? "Update visit" : "Log visit";

    return (
      '<div class="visit-panel" data-visit-panel="' +
      escapeHtml(venue.id) +
      '">' +
      '<h3 class="visit-panel-title">' +
      escapeHtml(title) +
      "</h3>" +
      '<form class="visit-form" data-visit-form="' +
      escapeHtml(venue.id) +
      '" novalidate>' +
      '<div class="field">' +
      '<label class="field-label" for="outcome-' +
      escapeHtml(venue.id) +
      '">What happened?</label>' +
      '<select id="outcome-' +
      escapeHtml(venue.id) +
      '" name="outcome" required>' +
      outcomeOptionsHtml(visit.outcome || "not_visited") +
      "</select></div>" +
      '<div class="field">' +
      '<label class="field-label" for="person-' +
      escapeHtml(venue.id) +
      '">Person spoken to</label>' +
      '<input type="text" id="person-' +
      escapeHtml(venue.id) +
      '" name="person" value="' +
      escapeHtml(visit.person) +
      '" autocomplete="name">' +
      "</div>" +
      '<div class="field">' +
      '<label class="field-label" for="role-' +
      escapeHtml(venue.id) +
      '">Their role</label>' +
      '<input type="text" id="role-' +
      escapeHtml(venue.id) +
      '" name="role" list="role-suggestions" placeholder="Reception, Office Manager, EA…" value="' +
      escapeHtml(visit.role) +
      '">' +
      "</div>" +
      '<div class="field">' +
      '<label class="field-label" for="email-' +
      escapeHtml(venue.id) +
      '">Email address</label>' +
      '<input type="email" id="email-' +
      escapeHtml(venue.id) +
      '" name="email" inputmode="email" autocomplete="email" value="' +
      escapeHtml(visit.email) +
      '">' +
      "</div>" +
      '<div class="field">' +
      '<label class="field-label" for="notes-' +
      escapeHtml(venue.id) +
      '">Quick notes</label>' +
      '<textarea id="notes-' +
      escapeHtml(venue.id) +
      '" name="notes" rows="3" placeholder="What they said, catering used, upcoming meeting, best follow-up time…">' +
      escapeHtml(visit.notes) +
      "</textarea></div>" +
      '<label class="check"><input type="checkbox" name="warm"' +
      (visit.warm ? " checked" : "") +
      '><span>Warm lead / worth returning to</span></label>' +
      '<label class="check"><input type="checkbox" name="followUp"' +
      (visit.followUp ? " checked" : "") +
      '><span>Needs follow-up</span></label>' +
      '<button type="submit" class="btn btn-primary btn-block">Save visit</button>' +
      "</form></div>"
    );
  }

  function cardHtml(venue, visit) {
    var sectionMeta = SECTIONS.find
      ? SECTIONS.find(function (s) {
          return s.id === venue.section;
        })
      : null;
    var legClass = (sectionMeta && sectionMeta.legClass) || "bonus";
    var warm = isWarmPlace(venue, visit);
    var good = visit.outcome === "good_conversation";
    var classes =
      "venue-card" +
      (warm ? " is-warm" : "") +
      (good ? " is-good" : "");

    var phoneBlock = "";
    if (venue.phoneLabel && venue.phoneHref) {
      phoneBlock =
        '<div class="phone-row"><a href="' +
        escapeHtml(safeTelHref(venue.phoneHref)) +
        '">Call ' +
        escapeHtml(venue.phoneLabel) +
        "</a></div>";
    }

    var maps = mapsHref(venue.mapsQuery || venue.address || venue.name);
    var mapsBtn = maps
      ? '<a class="btn" href="' +
        escapeHtml(maps) +
        '" target="_blank" rel="noopener noreferrer">Open in Maps</a>'
      : '<span class="btn" aria-disabled="true">No map address</span>';

    var removeBtn = venue.isCustom
      ? '<button type="button" class="btn btn-danger btn-small btn-block remove-place" data-remove-place="' +
        escapeHtml(venue.id) +
        '">Remove this place</button>'
      : "";

    return (
      '<article class="' +
      classes +
      '" data-venue-id="' +
      escapeHtml(venue.id) +
      '" data-section="' +
      escapeHtml(venue.section) +
      '">' +
      '<div class="venue-head">' +
      '<div class="route-num ' +
      escapeHtml(legClass) +
      '" aria-hidden="true">' +
      escapeHtml(venue.routeNumber) +
      "</div>" +
      '<div class="venue-info">' +
      '<h3 class="venue-name">' +
      escapeHtml(venue.name) +
      "</h3>" +
      (venue.type ? '<p class="venue-type">' + escapeHtml(venue.type) + "</p>" : "") +
      (venue.address ? '<p class="venue-addr">' + escapeHtml(venue.address) + "</p>" : "") +
      '<div class="tags">' +
      tagsHtml(venue, visit) +
      "</div></div></div>" +
      '<div class="angle">' +
      '<p class="angle-label">Tailored angle</p>' +
      '<p class="angle-text">' +
      escapeHtml(venue.angle) +
      "</p></div>" +
      '<div class="copy-angle-wrap">' +
      '<button type="button" class="btn btn-secondary btn-small btn-block" data-copy-angle="' +
      escapeHtml(venue.id) +
      '">Copy introduction + angle</button></div>' +
      phoneBlock +
      '<div class="card-actions">' +
      (venue.phoneHref
        ? '<a class="btn" href="' + escapeHtml(safeTelHref(venue.phoneHref)) + '">Call</a>'
        : '<span class="btn" aria-disabled="true">No phone</span>') +
      mapsBtn +
      "</div>" +
      summaryHtml(venue, visit) +
      formHtml(venue, visit) +
      removeBtn +
      "</article>"
    );
  }

  function render() {
    var places = allPlaces();
    var query = state.search.trim().toLowerCase();
    var html = "";
    var visibleCount = 0;

    for (var s = 0; s < SECTIONS.length; s++) {
      var section = SECTIONS[s];
      var sectionHasVisible = false;
      var sectionHtml = "";

      for (var i = 0; i < places.length; i++) {
        var venue = places[i];
        if (venue.section !== section.id) continue;
        var visit = getVisit(venue.id);
        if (!placeMatchesSearch(venue, visit, query)) continue;
        if (!placeMatchesFilter(venue, visit)) continue;
        sectionHasVisible = true;
        visibleCount += 1;
        sectionHtml += cardHtml(venue, visit);
      }

      if (sectionHasVisible) {
        html +=
          '<div class="leg-divider" role="heading" aria-level="2">' +
          escapeHtml(section.label) +
          "</div>" +
          sectionHtml;
      }
    }

    if (!visibleCount) {
      html =
        '<p class="empty-state">No places match this search or filter. Try All, or clear the search.</p>';
    }

    els.routeList.innerHTML = html;
    updateStats();
  }

  function readVisitForm(form) {
    var data = new FormData(form);
    return {
      outcome: String(data.get("outcome") || "not_visited"),
      person: String(data.get("person") || "").trim(),
      role: String(data.get("role") || "").trim(),
      email: String(data.get("email") || "").trim(),
      notes: String(data.get("notes") || "").trim(),
      warm: !!form.querySelector('[name="warm"]').checked,
      followUp: !!form.querySelector('[name="followUp"]').checked,
      savedAt: new Date().toISOString()
    };
  }

  async function onSaveVisit(form) {
    var id = form.getAttribute("data-visit-form");
    if (!id) return;
    var visit = readVisitForm(form);
    if (visit.email && !isValidEmail(visit.email)) {
      showToast("Please enter a valid email address.");
      var emailInput = form.querySelector('[name="email"]');
      if (emailInput) emailInput.focus();
      return;
    }
    state.visits[id] = visit;
    if (!persistVisits()) return;

    var cloudOk = await cloudUpsertVisit(id, visit);
    render();
    showToast(cloudOk ? "Visit saved to the cloud." : "Visit saved on this phone.");
    var card = document.querySelector('[data-venue-id="' + id + '"]');
    if (card) {
      var summary = card.querySelector(".visit-summary");
      if (summary) summary.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function onCopyAngle(venueId) {
    var places = allPlaces();
    var venue = null;
    for (var i = 0; i < places.length; i++) {
      if (places[i].id === venueId) {
        venue = places[i];
        break;
      }
    }
    if (!venue) return;
    var text =
      RECEPTION_INTRO +
      "\n\nTailored angle for " +
      venue.name +
      ":\n" +
      venue.angle;
    copyText(text).then(function (ok) {
      showToast(ok ? "Introduction and angle copied." : "Could not copy. Please copy manually.");
    });
  }

  function openSheet() {
    els.sheet.hidden = false;
    els.backdrop.hidden = false;
    document.body.classList.add("sheet-open");
    var first = document.getElementById("add-name");
    if (first) first.focus();
  }

  function closeSheet() {
    els.sheet.hidden = true;
    els.backdrop.hidden = true;
    document.body.classList.remove("sheet-open");
    els.addForm.reset();
  }

  async function onAddPlace(event) {
    event.preventDefault();
    var form = els.addForm;
    var name = String(form.name.value || "").trim();
    if (!name) {
      showToast("Company or venue name is required.");
      form.name.focus();
      return;
    }
    var email = String(form.email.value || "").trim();
    if (email && !isValidEmail(email)) {
      showToast("Please enter a valid email address.");
      form.email.focus();
      return;
    }

    var id = "custom-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
    var phone = String(form.phone.value || "").trim();
    var warm = !!form.warm.checked;
    var followUp = !!form.followUp.checked;
    var outcome = String(form.outcome.value || "not_visited");
    var person = String(form.person.value || "").trim();
    var role = String(form.role.value || "").trim();
    var notes = String(form.notes.value || "").trim();
    var address = String(form.address.value || "").trim();
    var type = String(form.type.value || "").trim();

    var place = {
      id: id,
      routeNumber: "+",
      name: name,
      address: address,
      type: type,
      phone: phone,
      warmSeed: warm
    };

    state.customPlaces.push(place);

    var shouldSaveVisit =
      outcome !== "not_visited" || person || role || email || notes || warm || followUp;

    var visit = null;
    if (shouldSaveVisit) {
      visit = {
        outcome: outcome,
        person: person,
        role: role,
        email: email,
        notes: notes,
        warm: warm,
        followUp: followUp,
        savedAt: new Date().toISOString()
      };
      state.visits[id] = visit;
    }

    var okPlaces = persistPlaces();
    var okVisits = shouldSaveVisit ? persistVisits() : true;
    if (!(okPlaces && okVisits)) return;

    var cloudPlaceOk = await cloudUpsertPlace(place);
    var cloudVisitOk = visit ? await cloudUpsertVisit(id, visit) : true;
    var cloudOk = cloudPlaceOk && cloudVisitOk;

    closeSheet();
    render();
    showToast(cloudOk ? "Place saved to the cloud." : "Place added and saved on this phone.");
    var card = document.querySelector('[data-venue-id="' + id + '"]');
    if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function onRemovePlace(id) {
    var isCustom = false;
    for (var i = 0; i < state.customPlaces.length; i++) {
      if (state.customPlaces[i].id === id) {
        isCustom = true;
        break;
      }
    }
    if (!isCustom) {
      showToast("Original route venues cannot be removed.");
      return;
    }
    if (!window.confirm("Remove this added place?")) return;
    state.customPlaces = state.customPlaces.filter(function (p) {
      return p.id !== id;
    });
    delete state.visits[id];
    persistPlaces();
    persistVisits();
    await cloudDeletePlace(id);
    render();
    showToast("Added place removed.");
  }

  function buildShareText() {
    var places = allPlaces();
    var lines = [];
    lines.push("Covent Garden Catering — Outreach Walk log");
    lines.push(formatDate());
    lines.push("Covent Garden");
    lines.push("");

    var count = 0;
    for (var i = 0; i < places.length; i++) {
      var venue = places[i];
      var visit = getVisit(venue.id);
      if (!isVisited(visit)) continue;
      count += 1;
      lines.push("• " + venue.name);
      lines.push("  Outcome: " + (OUTCOME_LABELS[visit.outcome] || visit.outcome));
      lines.push("  Contact: " + (visit.person || "—"));
      lines.push("  Role: " + (visit.role || "—"));
      lines.push("  Email: " + (visit.email || "—"));
      lines.push("  Notes: " + (visit.notes || "—"));
      lines.push("  Follow-up: " + (visit.followUp ? "Yes" : "No"));
      lines.push("");
    }

    if (!count) return null;
    lines.push(
      cloudReady
        ? "Shared from the Outreach Walk tracker. Data is saved in Supabase and on the device used for the walk."
        : "Shared from the Outreach Walk tracker. Data was saved on the device used for the walk."
    );
    return lines.join("\n");
  }

  async function onShareLog() {
    var text = buildShareText();
    if (!text) {
      showToast("No visits recorded yet. Log a visit first, then share.");
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Covent Garden Catering — Outreach Walk log",
          text: text
        });
        showToast("Log shared.");
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return;
        /* fall through to clipboard */
      }
    }

    var ok = await copyText(text);
    showToast(ok ? "Visit log copied. Paste it into WhatsApp, Messages or email." : "Could not share or copy the log.");
  }

  function onRouteClick(event) {
    var copyBtn = event.target.closest("[data-copy-angle]");
    if (copyBtn) {
      onCopyAngle(copyBtn.getAttribute("data-copy-angle"));
      return;
    }

    var removeBtn = event.target.closest("[data-remove-place]");
    if (removeBtn) {
      onRemovePlace(removeBtn.getAttribute("data-remove-place"));
    }
  }

  function onRouteSubmit(event) {
    var form = event.target.closest("[data-visit-form]");
    if (!form) return;
    event.preventDefault();
    onSaveVisit(form);
  }

  function bind() {
    els.copyIntro.addEventListener("click", function () {
      copyText(RECEPTION_INTRO).then(function (ok) {
        showToast(ok ? "Introduction copied." : "Could not copy. Please copy manually.");
      });
    });

    els.search.addEventListener("input", function () {
      state.search = els.search.value || "";
      render();
    });

    els.filters.forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.filter = btn.getAttribute("data-filter") || "all";
        els.filters.forEach(function (b) {
          var active = b === btn;
          b.classList.toggle("is-active", active);
          b.setAttribute("aria-pressed", active ? "true" : "false");
        });
        render();
      });
    });

    els.routeList.addEventListener("click", onRouteClick);
    els.routeList.addEventListener("submit", onRouteSubmit);

    els.shareBtn.addEventListener("click", function () {
      onShareLog();
    });

    els.addBtn.addEventListener("click", openSheet);
    els.closeSheet.addEventListener("click", closeSheet);
    els.backdrop.addEventListener("click", closeSheet);
    els.addForm.addEventListener("submit", onAddPlace);

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !els.sheet.hidden) {
        closeSheet();
      }
    });
  }

  function cacheEls() {
    els.routeList = document.getElementById("route-list");
    els.statToVisit = document.getElementById("stat-to-visit");
    els.statGood = document.getElementById("stat-good");
    els.statFollowup = document.getElementById("stat-followup");
    els.search = document.getElementById("search-input");
    els.filters = Array.prototype.slice.call(document.querySelectorAll(".filter-btn"));
    els.copyIntro = document.getElementById("copy-intro-btn");
    els.shareBtn = document.getElementById("share-log-btn");
    els.addBtn = document.getElementById("add-place-btn");
    els.sheet = document.getElementById("add-place-sheet");
    els.backdrop = document.getElementById("sheet-backdrop");
    els.closeSheet = document.getElementById("close-sheet-btn");
    els.addForm = document.getElementById("add-place-form");
    els.toast = document.getElementById("toast");
  }

  async function init() {
    cacheEls();
    setWalkDate();
    initSupabase();
    loadState();
    bind();
    render();
    updateSaveNotice();
    var synced = await loadFromCloud();
    updateSaveNotice();
    if (synced) {
      render();
      showToast("Cloud notes loaded.");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
