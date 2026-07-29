(function () {
  "use strict";

  var Core = window.OutreachCore;
  if (!Core) {
    document.addEventListener("DOMContentLoaded", function () {
      var err = document.getElementById("boot-error");
      if (err) {
        err.hidden = false;
        err.textContent = "Core module not loaded. Please reload the page.";
      }
    });
    return;
  }

  // ── Storage keys ─────────────────────────────────────────────────────────────

  var STORAGE_VISITS  = "cgc-outreach-v1-visits";
  var STORAGE_PLACES  = "cgc-outreach-v1-places";
  var STORAGE_AREA    = "cgc-outreach-v1-selected-area";
  var STORAGE_PENDING = "cgc-outreach-v1-pending";
  var STORAGE_LOCAL   = "cgc-outreach-v1-prefer-local";

  // ── Supabase ─────────────────────────────────────────────────────────────────

  var SUPABASE_URL             = "https://athqfnbwchxvtozrqfcj.supabase.co";
  var SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ciawUoKC7kWslcvOtEWS6g_BDhytl9P";

  var sb          = null;
  var cloudReady  = false;
  var currentUser = null;
  var savingIds   = new Set();

  // ── Offer + decision-maker ───────────────────────────────────────────────────

  var CURRENT_OFFER = {
    active:         true,
    title:          "Local office offer",
    bookingDeadline:"2026-08-07",
    wording:        "Free local delivery",
    detail:         "On all office orders placed by 7 August 2026.",
    radiusNote:     "Within the normal delivery radius and subject to availability."
  };

  var DECISION_MAKER_INTRO_BASE =
    "Hi, we\u2019re Covent Garden Catering, based just nearby in the Market. " +
    "We provide office breakfasts, meeting platters and team lunches. " +
    "I wanted to introduce us and leave our leaflet with you.";

  function isOfferActive() {
    if (!CURRENT_OFFER || !CURRENT_OFFER.active) return false;
    if (!CURRENT_OFFER.bookingDeadline) return true;
    var end = new Date(CURRENT_OFFER.bookingDeadline + "T23:59:59");
    if (isNaN(end.getTime())) return !!CURRENT_OFFER.active;
    return new Date() <= end;
  }

  function formatOfferDeadline(isoDate) {
    var parts = String(isoDate || "").split("-");
    if (parts.length !== 3) return String(isoDate || "");
    var months = [
      "January","February","March","April","May","June",
      "July","August","September","October","November","December"
    ];
    return String(parseInt(parts[2], 10)) + " " +
      (months[parseInt(parts[1], 10) - 1] || parts[1]) + " " + parts[0];
  }

  function getDecisionMakerScript() {
    var text = DECISION_MAKER_INTRO_BASE;
    if (isOfferActive()) {
      text +=
        " We\u2019re offering free local delivery on all office orders placed by " +
        formatOfferDeadline(CURRENT_OFFER.bookingDeadline) +
        ".";
    }
    return text;
  }

  // ── Areas & clusters ─────────────────────────────────────────────────────────

  var AREAS = [
    { id: "covent-garden",     label: "Covent Garden" },
    { id: "st-pauls-cheapside",label: "St Paul\u2019s & Cheapside" }
  ];

  var CLUSTERS = [
    { id: "additional-leaflet-targets-29-july", area: "covent-garden",      label: "New leaflet loop \u2014 follow 1\u20138", tone: "added" },
    { id: "new-targets-29-july",   area: "covent-garden",      label: "New targets \u2014 added 29 July",              tone: "bonus" },
    { id: "bow-street",            area: "covent-garden",      label: "Bow Street cluster",                           tone: "leg-a" },
    { id: "slingsby-st-martins",   area: "covent-garden",      label: "Slingsby Place & St Martin\u2019s Lane cluster",tone: "leg-b" },
    { id: "long-acre-parker",      area: "covent-garden",      label: "Long Acre & Parker Street cluster",            tone: "leg-c" },
    { id: "holborn",               area: "covent-garden",      label: "Holborn cluster",                              tone: "leg-d" },
    { id: "shorts-gardens-kingsway",area:"covent-garden",      label: "Short\u2019s Gardens & Kingsway cluster",      tone: "leg-e" },
    { id: "return-to-base",        area: "covent-garden",      label: "Near base cluster",                            tone: "bonus" },
    { id: "st-pauls-new-farringdon-clerkenwell", area: "st-pauls-cheapside", label: "St Paul\u2019s New Drop-Offs \u2014 Farringdon & Clerkenwell", tone: "added" },
    { id: "st-pauls-new-hatton-production",      area: "st-pauls-cheapside", label: "St Paul\u2019s New Drop-Offs \u2014 Hatton Wall & Production Studios", tone: "added" },
    { id: "fleet-street-ludgate",  area: "st-pauls-cheapside", label: "Fleet Street & Ludgate cluster",               tone: "leg-f" },
    { id: "st-pauls-cheapside",    area: "st-pauls-cheapside", label: "St Paul\u2019s & Cheapside cluster",           tone: "leg-g" },
    { id: "smithfield-farringdon", area: "st-pauls-cheapside", label: "Smithfield & Farringdon cluster",              tone: "leg-h" },
    { id: "clerkenwell",           area: "st-pauls-cheapside", label: "Clerkenwell cluster",                          tone: "leg-i" },
    { id: "added-nearby",          area: null,                 label: "Added nearby",                                 tone: "added" }
  ];

  var ST_PAULS_NEW_DROPOFF_CLUSTERS = {
    "st-pauls-new-farringdon-clerkenwell": true,
    "st-pauls-new-hatton-production": true
  };

  // ── Venues (verbatim from /tmp/venues-block.js) ───────────────────────────────

  /** Venue seed data — IDs must stay stable for saved visits. */
  var VENUES = [
    {
      id: "society-london-theatre-uk-theatre",
      area: "covent-garden",
      cluster: "additional-leaflet-targets-29-july",
      routeOrder: 1,
      name: "Society of London Theatre / UK Theatre",
      type: "Theatre / Industry Office",
      address: "32 Rose Street, London WC2E 9ET",
      walk: "",
      score: null,
      tags: [{ className: "tag-new", text: "NEW \u2014 NOT ON OLD ROUTE" }],
      phone: "+44 20 7557 6700",
      phoneHref: "+442075576700",
      phoneLabel: "+44 20 7557 6700",
      mapsQuery: "32 Rose Street, London WC2E 9ET",
      angle:
        "Ask for the office or events manager. Office meetings, training and industry events."
    },
    {
      id: "production-resource-group",
      area: "covent-garden",
      cluster: "additional-leaflet-targets-29-july",
      routeOrder: 2,
      name: "Production Resource Group",
      type: "Live Production",
      address: "1st Floor, 77 St Martin\u2019s Lane, London WC2N 4AA",
      walk: "",
      score: null,
      tags: [{ className: "tag-new", text: "NEW \u2014 NOT ON OLD ROUTE" }],
      phone: "+44 20 7632 1500",
      phoneHref: "+442076321500",
      phoneLabel: "+44 20 7632 1500",
      mapsQuery: "1st Floor, 77 St Martin's Lane, London WC2N 4AA",
      angle:
        "Ask for the production or office coordinator. Live-production schedules, project meetings and team working sessions."
    },
    {
      id: "aka-shaftesbury-avenue",
      area: "covent-garden",
      cluster: "additional-leaflet-targets-29-july",
      routeOrder: 3,
      name: "AKA",
      type: "Creative Marketing Agency",
      address: "117 Shaftesbury Avenue, London WC2H 8AF",
      walk: "",
      score: null,
      tags: [{ className: "tag-new", text: "NEW \u2014 NOT ON OLD ROUTE" }],
      phone: "+44 20 7836 4747",
      phoneHref: "+442078364747",
      phoneLabel: "+44 20 7836 4747",
      mapsQuery: "117 Shaftesbury Avenue, London WC2H 8AF",
      angle:
        "Ask for the office manager. Client meetings, campaign working lunches and tidy meeting platters."
    },
    {
      id: "liquid-violet",
      area: "covent-garden",
      cluster: "additional-leaflet-targets-29-july",
      routeOrder: 4,
      name: "Liquid Violet",
      type: "Recording Studio",
      address: "1st Floor, 39 Earlham Street, London WC2H 9LT",
      walk: "",
      score: null,
      tags: [{ className: "tag-new", text: "NEW \u2014 NOT ON OLD ROUTE" }],
      phone: "+44 20 3959 0770",
      phoneHref: "+442039590770",
      phoneLabel: "+44 20 3959 0770",
      mapsQuery: "1st Floor, 39 Earlham Street, London WC2H 9LT",
      angle:
        "Ask for the studio or production manager. Recording sessions, visiting talent and food arriving at the promised time."
    },
    {
      id: "storm-post-production",
      area: "covent-garden",
      cluster: "additional-leaflet-targets-29-july",
      routeOrder: 5,
      name: "Storm Post Production",
      type: "Post Production",
      address: "11\u201313 Neal\u2019s Yard, London WC2H 9DP",
      walk: "",
      score: null,
      tags: [{ className: "tag-new", text: "NEW \u2014 NOT ON OLD ROUTE" }],
      phone: "+44 20 7520 5000",
      phoneHref: "+442075205000",
      phoneLabel: "+44 20 7520 5000",
      mapsQuery: "11-13 Neal's Yard, London WC2H 9DP",
      angle:
        "Ask for the studio manager or client-services team. Long edit days, client reviews, changing schedules and clear dietary labelling."
    },
    {
      id: "commercials-unlimited",
      area: "covent-garden",
      cluster: "additional-leaflet-targets-29-july",
      routeOrder: 6,
      name: "Commercials Unlimited",
      type: "Production / Post Production",
      address: "Garden Studios, 11\u201315 Betterton Street, London WC2H 9BP",
      walk: "",
      score: null,
      tags: [{ className: "tag-new", text: "NEW \u2014 NOT ON OLD ROUTE" }],
      phone: "+44 20 7470 8791",
      phoneHref: "+442074708791",
      phoneLabel: "+44 20 7470 8791",
      mapsQuery: "Garden Studios, 11-15 Betterton Street, London WC2H 9BP",
      angle:
        "Ask for the production or office manager. Production days, client sessions and changing schedules."
    },
    {
      id: "lw-theatres-head-office",
      area: "covent-garden",
      cluster: "additional-leaflet-targets-29-july",
      routeOrder: 7,
      name: "LW Theatres Head Office",
      type: "Head Office",
      address: "65 Drury Lane, London WC2B 5SP",
      walk: "",
      score: null,
      tags: [{ className: "tag-new", text: "NEW \u2014 NOT ON OLD ROUTE" }],
      phone: "",
      phoneHref: "",
      phoneLabel: "",
      mapsQuery: "65 Drury Lane, London WC2B 5SP",
      angle:
        "Ask for the office manager. Head-office meetings and team lunches."
    },
    {
      id: "dewynters",
      area: "covent-garden",
      cluster: "additional-leaflet-targets-29-july",
      routeOrder: 8,
      name: "Dewynters",
      type: "Live Entertainment Creative Agency",
      address: "Wellington House, 125 Strand, London WC2R 0AP",
      walk: "",
      score: null,
      tags: [{ className: "tag-new", text: "NEW \u2014 NOT ON OLD ROUTE" }],
      phone: "+44 20 7321 0488",
      phoneHref: "+442073210488",
      phoneLabel: "+44 20 7321 0488",
      mapsQuery: "Wellington House, 125 Strand, London WC2R 0AP",
      angle:
        "Ask for the office manager or EA. Client meetings, campaign work and team lunches."
    },
    {
      id: "prosek-partners",
      area: "covent-garden",
      cluster: "new-targets-29-july",
      routeOrder: 1,
      name: "Prosek Partners",
      type: "Communications / PR",
      address: "14 Upper St Martin\u2019s Lane, WC2H 9FB",
      walk: "",
      score: null,
      tags: [{ className: "tag-new", text: "NEW \u2014 NOT ON OLD ROUTE" }],
      phone: "",
      phoneHref: "",
      phoneLabel: "",
      mapsQuery: "14 Upper St Martin's Lane, London WC2H 9FB",
      angle:
        "Ask for the office / reception manager. Client meeting boards and team lunches."
    },
    {
      id: "adelphoi-music",
      area: "covent-garden",
      cluster: "new-targets-29-july",
      routeOrder: 2,
      name: "Adelphoi Music",
      type: "Music / Production",
      address: "26 Litchfield Street, WC2H 9TZ",
      walk: "",
      score: null,
      tags: [{ className: "tag-new", text: "NEW \u2014 NOT ON OLD ROUTE" }],
      phone: "",
      phoneHref: "",
      phoneLabel: "",
      mapsQuery: "26 Litchfield Street, London WC2H 9TZ",
      angle:
        "Ask for the studio or office manager. Session catering and creative-team boards."
    },
    {
      id: "runway-east-covent-garden",
      area: "covent-garden",
      cluster: "new-targets-29-july",
      routeOrder: 3,
      name: "Runway East Covent Garden",
      type: "Flexible Workspace",
      address: "189 Shaftesbury Avenue, WC2H 8TJ",
      walk: "",
      score: null,
      tags: [{ className: "tag-new", text: "NEW \u2014 NOT ON OLD ROUTE" }],
      phone: "",
      phoneHref: "",
      phoneLabel: "",
      mapsQuery: "189 Shaftesbury Avenue, London WC2H 8TJ",
      angle:
        "Ask for the community or events manager. Member breakfasts and meeting-room catering."
    },
    {
      id: "midas-vfx",
      area: "covent-garden",
      cluster: "new-targets-29-july",
      routeOrder: 4,
      name: "Midas VFX",
      type: "VFX Studio",
      address: "13 Monmouth Street, WC2H 9DA",
      walk: "",
      score: null,
      tags: [{ className: "tag-new", text: "NEW \u2014 NOT ON OLD ROUTE" }],
      phone: "",
      phoneHref: "",
      phoneLabel: "",
      mapsQuery: "13 Monmouth Street, London WC2H 9DA",
      angle:
        "Ask for the studio or production manager. Shoot-day and review-room catering."
    },
    {
      id: "neal-street-productions",
      area: "covent-garden",
      cluster: "new-targets-29-july",
      routeOrder: 5,
      name: "Neal Street Productions",
      type: "Film / Theatre Production",
      address: "26\u201328 Neal Street, WC2H 9QQ",
      walk: "",
      score: null,
      tags: [{ className: "tag-new", text: "NEW \u2014 NOT ON OLD ROUTE" }],
      phone: "",
      phoneHref: "",
      phoneLabel: "",
      mapsQuery: "26-28 Neal Street, London WC2H 9QQ",
      angle:
        "Ask for the production or office manager. Production boards and meeting catering."
    },
    {
      id: "cinecentre-london-film-school",
      area: "covent-garden",
      cluster: "new-targets-29-july",
      routeOrder: 6,
      name: "Cinecentre / London Film School",
      type: "Film School / Screening",
      address: "39\u201341 Parker Street, WC2B 5PQ",
      walk: "",
      score: null,
      tags: [
        { className: "tag-new", text: "NEW \u2014 NOT ON OLD ROUTE" },
        { className: "tag-multi", text: "Not PB Creative at 40\u201342" }
      ],
      phone: "",
      phoneHref: "",
      phoneLabel: "",
      mapsQuery: "39-41 Parker Street, London WC2B 5PQ",
      angle:
        "Ask for the office or events manager at 39\u201341 Parker Street \u2014 not PB Creative next door. Screening and course catering."
    },
    {
      id: "msq-partners",
      area: "covent-garden",
      cluster: "bow-street",
      routeOrder: 1,
      name: "MSQ Partners",
      type: "Marketing Agency Group",
      address: "34 Bow St, WC2E 7AU",
      walk: "2 min walk",
      score: 10,
      tags: [
        { className: "tag-known", text: "Known contact \u2014 Jessica Smith" },
        { className: "tag-multi", text: "+The Gate same building" }
      ],
      phone: "+44 20 3026 6000",
      phoneHref: "+442030266000",
      phoneLabel: "+44 20 3026 6000",
      mapsQuery: "34 Bow St, London WC2E 7AU",
      askFor: [
        {
          name: "Jessica Smith",
          role: "Executive Assistant",
          linkedin: "https://www.linkedin.com/in/jessica-smith-7a0a61b6"
        }
      ],
      angle:
        "Ask for Jessica Smith (EA). Neighbours from The Market \u2014 boardroom boards & team lunches. Then The Gate."
    },
    {
      id: "the-gate-london",
      area: "covent-garden",
      cluster: "bow-street",
      routeOrder: 2,
      name: "The Gate London",
      type: "Creative / Integrated Agency",
      address: "34 Bow St, WC2E 7AU",
      walk: "Same building as MSQ",
      score: 9,
      tags: [],
      phone: "+44 20 7927 3555",
      phoneHref: "+442079273555",
      phoneLabel: "+44 20 7927 3555",
      mapsQuery: "34 Bow St, London WC2E 7AU",
      angle:
        "Ask for The Gate\u2019s floor / office manager (not MSQ). Client presentation boards & team lunches."
    },
    {
      id: "kearney-consulting",
      area: "covent-garden",
      cluster: "bow-street",
      routeOrder: 3,
      name: "Kearney Consulting",
      type: "Global Management Consultancy",
      address: "The Adelphi, 1\u201311 John Adam St, WC2N 6HT",
      walk: "4 min",
      score: 10,
      tags: [],
      phone: "+44 20 7468 8000",
      phoneHref: "+442074688000",
      phoneLabel: "+44 20 7468 8000",
      mapsQuery: "The Adelphi, 1 John Adam St, London WC2N 6HT",
      angle:
        "Formal reception \u2014 ask EA/PA who books client meeting catering. Boardroom platters."
    },
    {
      id: "pha-group",
      area: "covent-garden",
      cluster: "slingsby-st-martins",
      routeOrder: 1,
      name: "The PHA Group",
      type: "PR & Communications Agency",
      address: "11 Slingsby Pl, WC2E 9AB",
      walk: "5 min",
      score: 9,
      tags: [],
      phone: "+44 20 7025 1350",
      phoneHref: "+442070251350",
      phoneLabel: "+44 20 7025 1350",
      mapsQuery: "11 Slingsby Place, London WC2E 9AB",
      angle:
        "Ask office manager. Breakfasts before media days & campaign lunches."
    },
    {
      id: "rooster-marketing",
      area: "covent-garden",
      cluster: "slingsby-st-martins",
      routeOrder: 2,
      name: "Rooster Marketing",
      type: "Boutique Marketing Agency",
      address: "60 St Martin\u2019s Ln, WC2N 4JS",
      walk: "5 min",
      score: 9,
      tags: [],
      phone: "+44 20 3621 6644",
      phoneHref: "+442036216644",
      phoneLabel: "+44 20 3621 6644",
      mapsQuery: "60 St Martin's Lane, London WC2N 4JS",
      angle:
        "Ask office manager. Team lunches & client catch-ups."
    },
    {
      id: "carnival-film",
      area: "covent-garden",
      cluster: "slingsby-st-martins",
      routeOrder: 3,
      name: "Carnival Film & Television",
      type: "TV / Film Production Company",
      address: "101 St Martin\u2019s Ln, WC2N 4AZ",
      walk: "7 min",
      score: 8,
      tags: [],
      phone: "+44 20 3618 6600",
      phoneHref: "+442036186600",
      phoneLabel: "+44 20 3618 6600",
      mapsQuery: "101 St Martin's Lane, London WC2N 4AZ",
      angle:
        "Ask production coordinator / office manager. Shoot-day platters; next-day when schedules move."
    },
    {
      id: "covent-garden-recruitment",
      area: "covent-garden",
      cluster: "slingsby-st-martins",
      routeOrder: 4,
      name: "Covent Garden Recruitment",
      type: "Recruitment Agency",
      address: "3rd Floor, 9 Irving St, WC2H 7AH",
      walk: "7 min",
      score: 8,
      tags: [],
      phone: "+44 20 3675 8800",
      phoneHref: "+442036758800",
      phoneLabel: "+44 20 3675 8800",
      mapsQuery: "9 Irving Street, London WC2H 7AH",
      angle:
        "Ask office manager. Interview breakfasts & client meeting platters."
    },
    {
      id: "me-and-you-productions",
      area: "covent-garden",
      cluster: "long-acre-parker",
      routeOrder: 1,
      name: "Me and You Productions",
      type: "Production Company",
      address: "39 Long Acre, WC2E 9LG",
      walk: "",
      score: 9,
      tags: [{ className: "tag-multi", text: "Same building as Curious PR" }],
      phone: "",
      phoneHref: "",
      phoneLabel: "",
      mapsQuery: "39 Long Acre, London WC2E 9LG",
      angle:
        "Ask for Me and You Productions. Shoot boards & production catering. Curious PR is the same building."
    },
    {
      id: "curious-pr",
      area: "covent-garden",
      cluster: "long-acre-parker",
      routeOrder: 2,
      name: "Curious PR",
      type: "PR Agency",
      address: "39 Long Acre, WC2E 9LG",
      walk: "",
      score: 9,
      tags: [{ className: "tag-multi", text: "Same building as Me and You" }],
      phone: "+44 20 3397 9111",
      phoneHref: "+442033979111",
      phoneLabel: "+44 20 3397 9111",
      mapsQuery: "39 Long Acre, London WC2E 9LG",
      angle:
        "Ask for Curious PR. Client meetings & campaign catering. Me and You Productions is the same building."
    },
    {
      id: "pb-creative",
      area: "covent-garden",
      cluster: "long-acre-parker",
      routeOrder: 3,
      name: "PB Creative",
      type: "Design / Creative Agency",
      address: "40\u201342 Parker St, WC2B 5PQ",
      walk: "7 min",
      score: 8,
      tags: [],
      phone: "+44 20 7836 3067",
      phoneHref: "+442078363067",
      phoneLabel: "+44 20 7836 3067",
      mapsQuery: "40 Parker Street, London WC2B 5PQ",
      angle:
        "Ask studio manager. Creative-team lunches & client review boards."
    },
    {
      id: "kindred-agency",
      area: "covent-garden",
      cluster: "long-acre-parker",
      routeOrder: 4,
      name: "Kindred Agency",
      type: "Creative Agency",
      address: "17 Macklin St, WC2B 5NR",
      walk: "8 min",
      score: 9,
      tags: [{ className: "tag-known", text: "Known contact \u2014 hello@wearekindred.com" }],
      phone: "+44 20 4524 5900",
      phoneHref: "+442045245900",
      phoneLabel: "+44 20 4524 5900",
      mapsQuery: "17 Macklin Street, London WC2B 5NR",
      angle:
        "Mention hello@wearekindred.com. Ask office / studio manager."
    },
    {
      id: "academy-films",
      area: "covent-garden",
      cluster: "holborn",
      routeOrder: 1,
      name: "Academy Films",
      type: "Award-Winning Film Production",
      address: "16 W Central St, WC1A 1JJ",
      walk: "6 min",
      score: 8,
      tags: [],
      phone: "+44 20 7395 4155",
      phoneHref: "+442073954155",
      phoneLabel: "+44 20 7395 4155",
      mapsQuery: "16 West Central Street, London WC1A 1JJ",
      angle:
        "Ask production coordinator / office manager. Shoot-day & team lunch platters."
    },
    {
      id: "blick-rothenberg",
      area: "covent-garden",
      cluster: "holborn",
      routeOrder: 2,
      name: "Blick Rothenberg",
      type: "Accountancy & Advisory (100\u2013200 staff)",
      address: "16 Great Queen St, WC2B 5AH",
      walk: "4 min",
      score: 8,
      tags: [],
      phone: "+44 20 7486 0111",
      phoneHref: "+442074860111",
      phoneLabel: "+44 20 7486 0111",
      mapsQuery: "16 Great Queen Street, London WC2B 5AH",
      angle:
        "Ask EA/PA. Client meeting platters & partner working lunches."
    },
    {
      id: "collective-london",
      area: "covent-garden",
      cluster: "holborn",
      routeOrder: 3,
      name: "Collective London",
      type: "Creative & Marketing Agency",
      address: "20 Red Lion St, WC1R 4PS",
      walk: "5 min",
      score: 9,
      tags: [],
      phone: "+44 20 7843 3555",
      phoneHref: "+442078433555",
      phoneLabel: "+44 20 7843 3555",
      mapsQuery: "20 Red Lion Street, London WC1R 4PS",
      angle:
        "Ask office manager. Creative-office catering & team days."
    },
    {
      id: "passion-digital",
      area: "covent-garden",
      cluster: "holborn",
      routeOrder: 4,
      name: "Passion Digital",
      type: "Digital Marketing Agency",
      address: "4th Floor, 137\u2013144 New Oxford St, WC1V 6PL",
      walk: "4 min",
      score: 8,
      tags: [],
      phone: "+44 20 3432 1360",
      phoneHref: "+442034321360",
      phoneLabel: "+44 20 3432 1360",
      mapsQuery: "Holborn Tower 137 New Oxford Street London WC1V 6PL",
      angle:
        "Ask who handles team catering. Office breakfasts & campaign lunches."
    },
    {
      id: "karma-live",
      area: "covent-garden",
      cluster: "shorts-gardens-kingsway",
      routeOrder: 1,
      name: "Karma (Live Production)",
      type: "Video & Live Events Production",
      address: "56 Short\u2019s Gardens, WC2H 9AN",
      walk: "5 min back toward base",
      score: 9,
      tags: [],
      phone: "",
      phoneHref: "",
      phoneLabel: "",
      mapsQuery: "56 Short's Gardens, London WC2H 9AN",
      angle:
        "Ask production / ops. Crew & shoot-day breakfast boards."
    },
    {
      id: "purple-pr",
      area: "covent-garden",
      cluster: "shorts-gardens-kingsway",
      routeOrder: 2,
      name: "Purple PR Westminster",
      type: "PR Agency",
      address: "7th Floor, 1 Kingsway, WC2B 4BG",
      walk: "10 min",
      score: 8,
      tags: [],
      phone: "+44 20 7439 9888",
      phoneHref: "+442074399888",
      phoneLabel: "+44 20 7439 9888",
      mapsQuery: "1 Kingsway, London WC2B 4BG",
      angle:
        "Say Purple PR, 7th floor. Ask office manager. Client meetings & team lunches."
    },
    {
      id: "greenwich-consulting",
      area: "covent-garden",
      cluster: "return-to-base",
      routeOrder: 1,
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
        "Quick stop \u2014 leave leaflet. Ask who books client meeting catering."
    },

    /* Walk B \u2014 St Paul\u2019s / Cheapside / Farringdon (mid-size, reception-accessible) */
    {
      id: "bell-yard-kysen",
      area: "st-pauls-cheapside",
      cluster: "fleet-street-ludgate",
      routeOrder: 1,
      name: "Bell Yard Kysen Communications",
      type: "Legal / Litigation PR Agency",
      address: "21 Fleet Street, EC4Y 1AA",
      walk: "5 min from St Paul\u2019s",
      score: 9,
      tags: [],
      phone: "+44 20 7936 2021",
      phoneHref: "+442079362021",
      phoneLabel: "+44 20 7936 2021",
      mapsQuery: "21 Fleet Street, London EC4Y 1AA",
      angle:
        "Ask who books client/counsel meeting catering. Boardroom lunches."
    },
    {
      id: "fortis-consulting",
      area: "st-pauls-cheapside",
      cluster: "fleet-street-ludgate",
      routeOrder: 2,
      name: "Fortis Consulting London",
      type: "Boutique Business Consultancy",
      address: "Office 7, 35\u201337 Ludgate Hill, EC4M 7JN",
      walk: "2 min",
      score: 7,
      tags: [],
      phone: "+44 20 7193 6953",
      phoneHref: "+442071936953",
      phoneLabel: "+44 20 7193 6953",
      mapsQuery: "35-37 Ludgate Hill, London EC4M 7JN",
      angle:
        "Ask for Fortis by name. Who books client lunches \u2014 leave leaflet."
    },
    {
      id: "tate-associates",
      area: "st-pauls-cheapside",
      cluster: "fleet-street-ludgate",
      routeOrder: 3,
      name: "Tate & Associates",
      type: "Recruitment Consultancy",
      address: "35\u201337 Ludgate Hill, EC4M 7JN",
      walk: "Same building as Fortis",
      score: 7,
      tags: [{ className: "tag-multi", text: "2 stops, 1 building" }],
      phone: "+44 20 7236 7766",
      phoneHref: "+442072367766",
      phoneLabel: "+44 20 7236 7766",
      mapsQuery: "35-37 Ludgate Hill, London EC4M 7JN",
      angle:
        "Ask for Tate & Associates. Interview breakfasts & client lunch platters."
    },
    {
      id: "richard-nelson-llp",
      area: "st-pauls-cheapside",
      cluster: "fleet-street-ludgate",
      routeOrder: 4,
      name: "Richard Nelson LLP",
      type: "Law Firm (national, City office)",
      address: "20 Old Bailey, EC4M 1AN",
      walk: "3 min",
      score: 8,
      tags: [],
      phone: "+44 20 7160 9777",
      phoneHref: "+442071609777",
      phoneLabel: "+44 20 7160 9777",
      mapsQuery: "20 Old Bailey, London EC4M 1AN",
      angle:
        "Ask EA/office manager. Boardroom platters \u2014 keep it brief."
    },
    {
      id: "raymond-saul",
      area: "st-pauls-cheapside",
      cluster: "st-pauls-cheapside",
      routeOrder: 1,
      name: "Raymond Saul Solicitors",
      type: "Boutique City Law Firm",
      address: "3rd Floor, Mermaid House, 2 Puddle Dock, EC4V 3DS",
      walk: "6 min via river side",
      score: 8,
      tags: [],
      phone: "+44 20 7480 7865",
      phoneHref: "+442074807865",
      phoneLabel: "+44 20 7480 7865",
      mapsQuery: "Mermaid House, 2 Puddle Dock, London EC4V 3DS",
      angle:
        "Ask who organises client meeting food. Leave leaflet with them."
    },
    {
      id: "russell-bedford",
      area: "st-pauls-cheapside",
      cluster: "st-pauls-cheapside",
      routeOrder: 2,
      name: "Russell Bedford International",
      type: "Accountancy / Advisory Network HQ",
      address: "Paternoster House, 65 St Paul\u2019s Churchyard, EC4M 8AB",
      walk: "4 min \u00b7 manned building reception",
      score: 7,
      tags: [],
      phone: "+44 20 7410 0339",
      phoneHref: "+442074100339",
      phoneLabel: "+44 20 7410 0339",
      mapsQuery: "Paternoster House, 65 St Paul's Churchyard, London EC4M 8AB",
      angle:
        "Building reception \u2192 Russell Bedford. Boardroom meeting platters."
    },
    {
      id: "proxima-cheapside",
      area: "st-pauls-cheapside",
      cluster: "st-pauls-cheapside",
      routeOrder: 3,
      name: "Proxima",
      type: "Procurement & Supply Chain Consultancy",
      address: "107 Cheapside, EC2V 6DN",
      walk: "5 min toward Bank (avoid bank towers)",
      score: 7,
      tags: [],
      phone: "+44 20 3465 4500",
      phoneHref: "+442034654500",
      phoneLabel: "+44 20 3465 4500",
      mapsQuery: "107 Cheapside, London EC2V 6DN",
      angle:
        "Reception \u2192 office manager (stay at 107 Cheapside). Team days & client meetings."
    },
    {
      id: "big-little-ldn",
      area: "st-pauls-cheapside",
      cluster: "smithfield-farringdon",
      routeOrder: 1,
      name: "BIG little LDN",
      type: "Boutique PR & Marketing Agency",
      address: "1st Floor, Abbey House, 74\u201376 St John Street, EC1M 4DZ",
      walk: "8 min toward Farringdon",
      score: 9,
      tags: [],
      phone: "",
      phoneHref: "",
      phoneLabel: "",
      mapsQuery: "74-76 St John Street, London EC1M 4DZ",
      askFor: [
        {
          name: "Emma Critchley-Lloyd",
          role: "Founder",
          linkedin: "https://www.linkedin.com/in/emmacritchley"
        }
      ],
      angle:
        "Ask office manager or Emma\u2019s team. Team breakfasts & client boards."
    },
    {
      id: "smithfield-agency",
      area: "st-pauls-cheapside",
      cluster: "smithfield-farringdon",
      routeOrder: 2,
      name: "Smithfield Agency",
      type: "Independent Media Planning Agency",
      address: "22 St James\u2019s Walk, EC1R 0AP",
      walk: "5 min \u00b7 ~20 people",
      score: 9,
      tags: [],
      phone: "+44 20 7257 2600",
      phoneHref: "+442072572600",
      phoneLabel: "+44 20 7257 2600",
      mapsQuery: "22 St James's Walk, London EC1R 0AP",
      angle:
        "Ask who looks after catering. Breakfast boards & working lunches."
    },
    {
      id: "sec-newgate",
      area: "st-pauls-cheapside",
      cluster: "smithfield-farringdon",
      routeOrder: 3,
      name: "SEC Newgate UK",
      type: "Strategic Communications / Public Affairs",
      address: "14 Greville Street, EC1N 8SB",
      walk: "4 min \u00b7 Farringdon",
      score: 8,
      tags: [],
      phone: "+44 20 3757 6767",
      phoneHref: "+442037576767",
      phoneLabel: "+44 20 3757 6767",
      mapsQuery: "14 Greville Street, London EC1N 8SB",
      angle:
        "Ask who books client/stakeholder meeting catering. Boardroom & team lunches."
    },
    {
      id: "flame-pr",
      area: "st-pauls-cheapside",
      cluster: "clerkenwell",
      routeOrder: 1,
      name: "Flame PR",
      type: "Full-Service Marketing Agency",
      address: "37 Pear Tree Street, EC1V 3AG",
      walk: "8 min north \u00b7 Clerkenwell",
      score: 8,
      tags: [],
      phone: "+44 20 3357 9740",
      phoneHref: "+442033579740",
      phoneLabel: "+44 20 3357 9740",
      mapsQuery: "37 Pear Tree Street, London EC1V 3AG",
      angle:
        "Ask office manager. Breakfast boards & campaign working lunches."
    },
    {
      id: "words-pixels",
      area: "st-pauls-cheapside",
      cluster: "clerkenwell",
      routeOrder: 2,
      name: "Words+Pixels",
      type: "Award-Winning PR Agency (~25 people)",
      address: "Ground Floor, Silverlight House, 6\u20138 Standard Place, EC2A 3BE",
      walk: "10 min \u00b7 only if energy left",
      score: 9,
      tags: [],
      phone: "",
      phoneHref: "",
      phoneLabel: "",
      mapsQuery: "Silverlight House, 6-8 Standard Place, London EC2A 3BE",
      angle:
        "Ground floor \u2014 ask office manager. Client meeting boards & team lunches."
    },

    /* NEW DROP-OFFS \u2014 NOT VISITED (St Paul\u2019s) \u2014 separate from prior visited clusters */
    {
      id: "seventy-two-point-farringdon",
      area: "st-pauls-cheapside",
      cluster: "st-pauls-new-farringdon-clerkenwell",
      routeOrder: 1,
      name: "72Point",
      type: "Media / Content Agency",
      address: "21 Farringdon Road, London, EC1M 3HA",
      walk: "",
      score: null,
      tags: [{ className: "tag-new", text: "NEW DROP-OFF \u2014 NOT VISITED" }],
      phone: "",
      phoneHref: "",
      phoneLabel: "",
      mapsQuery: "21 Farringdon Road, London EC1M 3HA",
      angle: "Ask for the operations manager."
    },
    {
      id: "mnc-britton-street",
      area: "st-pauls-cheapside",
      cluster: "st-pauls-new-farringdon-clerkenwell",
      routeOrder: 2,
      name: "MNC",
      type: "Office / Creative Business",
      address: "30 Britton Street, London, EC1M 5UH",
      walk: "",
      score: null,
      tags: [{ className: "tag-new", text: "NEW DROP-OFF \u2014 NOT VISITED" }],
      phone: "",
      phoneHref: "",
      phoneLabel: "",
      mapsQuery: "30 Britton Street, London EC1M 5UH",
      angle: "Ask for the office manager."
    },
    {
      id: "kota-clerkenwell-road",
      area: "st-pauls-cheapside",
      cluster: "st-pauls-new-farringdon-clerkenwell",
      routeOrder: 3,
      name: "KOTA",
      type: "Design / Creative Agency",
      address: "1\u20135 Clerkenwell Road, London, EC1M 5PA",
      walk: "",
      score: null,
      tags: [{ className: "tag-new", text: "NEW DROP-OFF \u2014 NOT VISITED" }],
      phone: "",
      phoneHref: "",
      phoneLabel: "",
      mapsQuery: "1-5 Clerkenwell Road, London EC1M 5PA",
      angle: "Ask for the office or operations manager."
    },
    {
      id: "rogue-films-reset-great-sutton",
      area: "st-pauls-cheapside",
      cluster: "st-pauls-new-farringdon-clerkenwell",
      routeOrder: 4,
      name: "Rogue Films + RESET",
      type: "Production / Creative Studios",
      address: "19\u201320 Great Sutton Street, London, EC1V 0DR",
      walk: "",
      score: null,
      tags: [
        { className: "tag-new", text: "NEW DROP-OFF \u2014 NOT VISITED" },
        { className: "tag-multi", text: "2 companies, 1 building" }
      ],
      phone: "",
      phoneHref: "",
      phoneLabel: "",
      mapsQuery: "19-20 Great Sutton Street, London EC1V 0DR",
      angle:
        "One stop for both Rogue Films and RESET. Ask for the production coordinator or office manager. Leave leaflets for both companies."
    },
    {
      id: "ami-clerkenwell-green",
      area: "st-pauls-cheapside",
      cluster: "st-pauls-new-farringdon-clerkenwell",
      routeOrder: 5,
      name: "AMI",
      type: "Office / Creative Business",
      address: "3rd Floor, Cornwell House, 21 Clerkenwell Green, London, EC1R 0DX",
      walk: "",
      score: null,
      tags: [{ className: "tag-new", text: "NEW DROP-OFF \u2014 NOT VISITED" }],
      phone: "",
      phoneHref: "",
      phoneLabel: "",
      mapsQuery: "Cornwell House, 21 Clerkenwell Green, London EC1R 0DX",
      angle: "3rd Floor, Cornwell House. Ask for the office manager."
    },
    {
      id: "frank-pr-spreckley-pr-hatton-wall",
      area: "st-pauls-cheapside",
      cluster: "st-pauls-new-hatton-production",
      routeOrder: 1,
      name: "Frank PR + Spreckley PR",
      type: "PR Agencies",
      address: "5\u20139 Hatton Wall, London, EC1N 8HX",
      walk: "",
      score: null,
      tags: [
        { className: "tag-new", text: "NEW DROP-OFF \u2014 NOT VISITED" },
        { className: "tag-multi", text: "2 companies, 1 building" }
      ],
      phone: "",
      phoneHref: "",
      phoneLabel: "",
      mapsQuery: "5-9 Hatton Wall, London EC1N 8HX",
      angle:
        "One stop for both. Frank PR is on the 4th Floor \u2014 entrance is the first door after the Hat & Tun pub. Spreckley PR is also in this building. Ask for the office or operations manager. Leave leaflets for both."
    },
    {
      id: "ukie-black-bull-yard",
      area: "st-pauls-cheapside",
      cluster: "st-pauls-new-hatton-production",
      routeOrder: 2,
      name: "Ukie",
      type: "Games Industry Trade Body",
      address: "18a Black Bull Yard, 24\u201328 Hatton Wall, London, EC1N 8JH",
      walk: "",
      score: null,
      tags: [{ className: "tag-new", text: "NEW DROP-OFF \u2014 NOT VISITED" }],
      phone: "",
      phoneHref: "",
      phoneLabel: "",
      mapsQuery: "18a Black Bull Yard, 24-28 Hatton Wall, London EC1N 8JH",
      angle:
        "Ask for the office or events manager. They host meetings and events and provide catering for office bookings."
    },
    {
      id: "forge-entertainment-zeppelin",
      area: "st-pauls-cheapside",
      cluster: "st-pauls-new-hatton-production",
      routeOrder: 3,
      name: "The Forge Entertainment",
      type: "TV / Entertainment Production",
      address: "2nd Floor, The Zeppelin Building, 59\u201361 Farringdon Road, London, EC1M 3JB",
      walk: "",
      score: null,
      tags: [{ className: "tag-new", text: "NEW DROP-OFF \u2014 NOT VISITED" }],
      phone: "",
      phoneHref: "",
      phoneLabel: "",
      mapsQuery: "The Zeppelin Building, 59-61 Farringdon Road, London EC1M 3JB",
      angle: "2nd Floor, The Zeppelin Building. Ask for Annelise, Head of Operations."
    },
    {
      id: "nineteen-twenty-vfx-farringdon",
      area: "st-pauls-cheapside",
      cluster: "st-pauls-new-hatton-production",
      routeOrder: 4,
      name: "1920 VFX",
      type: "VFX Studio",
      address: "1st Floor, 109\u2013111 Farringdon Road, London, EC1R 3BW",
      walk: "",
      score: null,
      tags: [{ className: "tag-new", text: "NEW DROP-OFF \u2014 NOT VISITED" }],
      phone: "",
      phoneHref: "",
      phoneLabel: "",
      mapsQuery: "109-111 Farringdon Road, London EC1R 3BW",
      angle: "1st Floor. Ask for the production manager or production desk."
    },
    {
      id: "piano-works-found-mainframe-purple",
      area: "st-pauls-cheapside",
      cluster: "st-pauls-new-hatton-production",
      routeOrder: 5,
      name: "The Piano Works \u2014 Found Studio, Mainframe and Purple Creative",
      type: "Production / Creative Studios",
      address: "113\u2013117 Farringdon Road, London, EC1R 3BX",
      walk: "",
      score: null,
      tags: [
        { className: "tag-new", text: "NEW DROP-OFF \u2014 NOT VISITED" },
        { className: "tag-multi", text: "3 companies, 1 building" }
      ],
      phone: "",
      phoneHref: "",
      phoneLabel: "",
      mapsQuery: "113-117 Farringdon Road, London EC1R 3BX",
      angle:
        "One physical stop \u2014 take leaflets for all three companies inside. Found Studio \u2014 Unit 4; Mainframe \u2014 Studio 10; Purple Creative \u2014 Third Floor. Ask for the studio, production or office manager."
    },
    {
      id: "mount-pleasant-studio",
      area: "st-pauls-cheapside",
      cluster: "st-pauls-new-hatton-production",
      routeOrder: 6,
      name: "Mount Pleasant Studio",
      type: "Studio",
      address: "51\u201353 Mount Pleasant, London, WC1X 0AE",
      walk: "",
      score: null,
      tags: [{ className: "tag-new", text: "NEW DROP-OFF \u2014 NOT VISITED" }],
      phone: "",
      phoneHref: "",
      phoneLabel: "",
      mapsQuery: "51-53 Mount Pleasant, London WC1X 0AE",
      angle: "Ask for Simon, the studio contact."
    }
  ];

  // ── State ─────────────────────────────────────────────────────────────────────

  var state = {
    visits:       {},
    customPlaces: [],
    search:       "",
    filter:       "all",
    area:         "covent-garden"
  };

  var els        = {};
  var toastTimer = null;
  var scrollToTopOnNextRender = false;

  // ── Utility helpers ───────────────────────────────────────────────────────────

  function on(el, event, handler) {
    if (!el) return;
    el.addEventListener(event, handler);
  }

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

  // ── Local storage helpers ─────────────────────────────────────────────────────

  function loadJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (err) {
      return fallback;
    }
  }

  function saveJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      showToast("Could not save. Storage may be full.");
      return false;
    }
  }

  function persistVisits() { return saveJson(STORAGE_VISITS, state.visits); }
  function persistPlaces() { return saveJson(STORAGE_PLACES, state.customPlaces); }

  function persistSelectedArea() {
    try { localStorage.setItem(STORAGE_AREA, state.area); } catch (e) { /* ignore */ }
  }

  // ── Pending IDs ───────────────────────────────────────────────────────────────

  function loadPendingIds() {
    var arr = loadJson(STORAGE_PENDING, []);
    return Array.isArray(arr) ? arr : [];
  }

  function savePendingIds(ids) { saveJson(STORAGE_PENDING, ids); }

  function addPending(id) {
    var ids = loadPendingIds();
    if (ids.indexOf(id) === -1) ids.push(id);
    savePendingIds(ids);
  }

  function removePending(id) {
    savePendingIds(loadPendingIds().filter(function (x) { return x !== id; }));
  }

  // ── Supabase init ─────────────────────────────────────────────────────────────

  function initSupabase() {
    try {
      if (window.supabase && typeof window.supabase.createClient === "function") {
        sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: { persistSession: true, detectSessionInUrl: true }
        });
        sb.auth.onAuthStateChange(function (event, session) {
          if (event === "SIGNED_IN" && session && session.user) {
            hideAuthGate();
            checkMembership(session.user).then(function () {
              updateSaveNotice();
              if (cloudReady) {
                loadFromCloud().then(function () {
                  retryPending();
                  render();
                  showToast("Cloud notes loaded.");
                });
              }
            });
          } else if (event === "SIGNED_OUT") {
            currentUser = null;
            cloudReady  = false;
            updateSaveNotice();
          }
        });
      }
    } catch (err) {
      sb = null;
    }
  }

  // ── Auth gate ─────────────────────────────────────────────────────────────────

  function ensureAuthGate() {
    var existing = document.getElementById("auth-gate");
    if (existing) return existing;
    var div = document.createElement("div");
    div.id = "auth-gate";
    div.setAttribute("role", "dialog");
    div.setAttribute("aria-modal", "true");
    div.setAttribute("aria-label", "Sign in to sync");
    div.hidden = true;
    div.innerHTML =
      '<div class="auth-gate-inner">' +
        '<p class="auth-gate-brand">Covent Garden Catering</p>' +
        '<h2 class="auth-gate-title">Team outreach</h2>' +
        '<p class="auth-gate-sub">Sign in to sync visits across phones.</p>' +
        '<form id="auth-form" novalidate>' +
          '<label class="field-label" for="auth-email">Email address</label>' +
          '<input type="email" id="auth-email" name="email" inputmode="email" ' +
            'autocomplete="email" placeholder="you@example.com" class="auth-email-input">' +
          '<button type="submit" class="btn btn-primary btn-block" style="margin-top:10px">' +
            'Send magic link</button>' +
        '</form>' +
        '<p id="auth-msg" class="auth-msg" aria-live="polite"></p>' +
        '<button type="button" id="auth-skip" class="btn btn-ghost btn-block" style="margin-top:8px">' +
          'Continue on this phone (local only)</button>' +
      '</div>';
    document.body.appendChild(div);
    return div;
  }

  function showAuthGate() {
    var gate = ensureAuthGate();
    gate.hidden = false;

    var form = document.getElementById("auth-form");
    if (form) {
      form.onsubmit = function (e) {
        e.preventDefault();
        var emailInput = document.getElementById("auth-email");
        var email = String((emailInput && emailInput.value) || "").trim();
        if (!email) return;
        sendMagicLink(email);
      };
    }

    var skipBtn = document.getElementById("auth-skip");
    if (skipBtn) {
      skipBtn.onclick = function () {
        cloudReady = false;
        try { localStorage.setItem(STORAGE_LOCAL, "1"); } catch (e) { /* ignore */ }
        gate.hidden = true;
        updateSaveNotice();
      };
    }

    var emailInput = document.getElementById("auth-email");
    if (emailInput) setTimeout(function () { emailInput.focus(); }, 60);
  }

  function hideAuthGate() {
    var gate = document.getElementById("auth-gate");
    if (gate) gate.hidden = true;
  }

  function showAuthMsg(msg) {
    var el = document.getElementById("auth-msg");
    if (el) el.textContent = msg;
  }

  function sendMagicLink(email) {
    if (!sb) return;
    showAuthMsg("Sending\u2026");
    sb.auth.signInWithOtp({
      email: email,
      options: { emailRedirectTo: location.origin + location.pathname }
    }).then(function (res) {
      if (res.error) {
        showAuthMsg("Error: " + res.error.message);
      } else {
        showAuthMsg("Magic link sent! Check your email.");
      }
    }).catch(function () {
      showAuthMsg("Could not send link. Check your connection.");
    });
  }

  function checkMembership(user) {
    if (!sb || !user) { cloudReady = false; return Promise.resolve(); }
    return sb.from("outreach_members").select("user_id").eq("user_id", user.id).maybeSingle()
      .then(function (res) {
        if (res.data) {
          cloudReady  = true;
          currentUser = user;
        } else {
          cloudReady = false;
          showToast("Not an outreach member. Using local only.");
        }
      })
      .catch(function () { cloudReady = false; });
  }

  function initAuth() {
    // Login gate disabled for now — phone-local saves only.
    // Cloud sync stays off until member auth is re-enabled intentionally.
    cloudReady = false;
    currentUser = null;
    hideAuthGate();
    updateSaveNotice();
    return Promise.resolve();
  }

  // ── Save notice ───────────────────────────────────────────────────────────────

  function updateSaveNotice() {
    var el = document.getElementById("save-notice");
    if (!el) return;
    el.textContent = "Saved on this phone.";
    var oldBtns = el.querySelectorAll("button");
    for (var i = 0; i < oldBtns.length; i++) oldBtns[i].remove();
  }

  // ── Cloud helpers ─────────────────────────────────────────────────────────────

  function cloudErrIsSchema(msg) {
    return /schema cache|does not exist|Could not find the table/i.test(msg || "");
  }

  function cloudUpsertVisit(id, visit) {
    if (!sb || !cloudReady) return Promise.resolve(false);
    if (savingIds.has(id)) return Promise.resolve(false);
    savingIds.add(id);
    var row = Core.visitToRow(id, visit);
    return sb.from("outreach_visits").upsert(row, { onConflict: "venue_id" })
      .then(function (res) {
        savingIds.delete(id);
        if (res.error) {
          if (cloudErrIsSchema(res.error.message)) { cloudReady = false; updateSaveNotice(); }
          addPending(id);
          return false;
        }
        removePending(id);
        return true;
      })
      .catch(function () { savingIds.delete(id); addPending(id); return false; });
  }

  function cloudUpsertPlace(place) {
    if (!sb || !cloudReady) return Promise.resolve(false);
    var row = Core.placeToRow(place);
    return sb.from("outreach_places").upsert(row, { onConflict: "id" })
      .then(function (res) {
        if (res.error) {
          if (cloudErrIsSchema(res.error.message)) { cloudReady = false; updateSaveNotice(); }
          return false;
        }
        return true;
      })
      .catch(function () { return false; });
  }

  function cloudDeletePlace(id) {
    if (!sb || !cloudReady) return Promise.resolve(false);
    return Promise.all([
      sb.from("outreach_places").delete().eq("id", id),
      sb.from("outreach_visits").delete().eq("venue_id", id)
    ]).then(function () { return true; }).catch(function () { return false; });
  }

  function loadFromCloud() {
    if (!sb || !cloudReady) return Promise.resolve(false);
    return Promise.all([
      sb.from("outreach_visits").select("*"),
      sb.from("outreach_places").select("*")
    ]).then(function (results) {
      var visitsRes = results[0];
      var placesRes = results[1];
      if (visitsRes.error || placesRes.error) {
        var msg = (visitsRes.error && visitsRes.error.message) || (placesRes.error && placesRes.error.message) || "";
        if (cloudErrIsSchema(msg)) {
          showToast("Cloud tables not set up yet. Run schema.sql in Supabase.");
          cloudReady = false;
        } else {
          showToast("Could not load from cloud. Using phone backup.");
          cloudReady = false;
        }
        return false;
      }

      var cloudVisitMap = {};
      (visitsRes.data || []).forEach(function (row) {
        cloudVisitMap[row.venue_id] = Core.visitFromRow(row);
      });

      var cloudPlaceList = (placesRes.data || []).map(function (row) {
        return Core.placeFromRow(row);
      });

      var mergedVisits = Core.mergeVisitMaps(state.visits, cloudVisitMap);
      state.visits = mergedVisits.visits;
      (mergedVisits.pendingIds || []).forEach(addPending);

      var mergedPlaces = Core.mergePlaceLists(state.customPlaces, cloudPlaceList);
      state.customPlaces = mergedPlaces.places;

      persistVisits();
      persistPlaces();
      return true;
    }).catch(function () {
      cloudReady = false;
      return false;
    });
  }

  function retryPending() {
    if (!sb || !cloudReady) return Promise.resolve();
    var ids = loadPendingIds();
    var chain = Promise.resolve();
    ids.forEach(function (id) {
      chain = chain.then(function () {
        var visit = state.visits[id];
        var placePromise = Promise.resolve();
        var customPlace = null;
        for (var j = 0; j < state.customPlaces.length; j++) {
          if (state.customPlaces[j].id === id) { customPlace = state.customPlaces[j]; break; }
        }
        if (customPlace) placePromise = cloudUpsertPlace(customPlace);
        if (visit) return placePromise.then(function () { return cloudUpsertVisit(id, visit); });
        return placePromise;
      });
    });
    return chain;
  }

  // ── Area / cluster helpers ────────────────────────────────────────────────────

  function areaLabel(areaId) {
    if (areaId === "all") return "All areas";
    for (var i = 0; i < AREAS.length; i++) {
      if (AREAS[i].id === areaId) return AREAS[i].label;
    }
    return areaId || "Unknown area";
  }

  function clusterMeta(clusterId) {
    for (var i = 0; i < CLUSTERS.length; i++) {
      if (CLUSTERS[i].id === clusterId) return CLUSTERS[i];
    }
    return { id: clusterId || "added-nearby", label: "Added nearby", tone: "added", area: null };
  }

  function clusterLabel(clusterId) { return clusterMeta(clusterId).label; }

  function clustersForArea(areaId) {
    return CLUSTERS.filter(function (c) {
      if (c.id === "added-nearby") return true;
      if (areaId === "all") return true;
      return c.area === areaId;
    });
  }

  // ── Places ────────────────────────────────────────────────────────────────────

  function allPlaces() {
    var list = [];
    for (var v = 0; v < VENUES.length; v++) {
      var seed = VENUES[v];
      list.push(Object.assign({}, seed, {
        area:       Core.normalizeAreaId(seed.area || "covent-garden"),
        cluster:    seed.cluster || "added-nearby",
        routeOrder: seed.routeOrder != null ? seed.routeOrder : 0
      }));
    }
    for (var i = 0; i < state.customPlaces.length; i++) {
      var p    = state.customPlaces[i];
      var area = Core.normalizeAreaId(p.area || "covent-garden");
      list.push({
        id:         p.id,
        area:       area,
        cluster:    p.cluster || "added-nearby",
        routeOrder: p.routeOrder != null ? p.routeOrder : 999,
        name:       p.name || "Untitled place",
        type:       p.type || "",
        address:    p.address || "",
        score:      null,
        tags:       [],
        phone:      p.phone || "",
        phoneHref:  String(p.phone || "").replace(/[^\d+]/g, ""),
        phoneLabel: p.phone || "",
        mapsQuery:  p.address || p.name || "",
        angle:      "Custom stop added in this area.",
        isCustom:   true,
        warmSeed:   !!p.warmSeed
      });
    }
    return list;
  }

  function getVenueById(id) {
    var places = allPlaces();
    for (var i = 0; i < places.length; i++) {
      if (places[i].id === id) return places[i];
    }
    return null;
  }

  function placeMatchesArea(venue) {
    if (state.area === "all") return true;
    return Core.normalizeAreaId(venue.area || "covent-garden") === state.area;
  }

  function placeMatchesFilter(venue, visit) {
    if (state.filter === "all")         return true;
    if (state.filter === "visited")     return Core.isVisited(visit);
    if (state.filter === "not_visited") return !Core.isVisited(visit);
    if (state.filter === "warm")        return !!(visit.warm || visit.followUp);
    return true;
  }

  function placeMatchesSearch(venue, visit, query) {
    if (!query) return true;
    var askText = (venue.askFor && venue.askFor[0])
      ? (venue.askFor[0].name || "") + " " + (venue.askFor[0].role || "")
      : "";
    var hay = [
      venue.name, venue.type, venue.address, venue.angle,
      venue.area, venue.cluster,
      areaLabel(venue.area), clusterLabel(venue.cluster),
      askText,
      visit.person, visit.email, visit.notes
    ].join(" ").toLowerCase();
    return hay.indexOf(query) !== -1;
  }

  // ── Visit helpers ─────────────────────────────────────────────────────────────

  function getVisit(id) {
    var v = state.visits[id];
    if (!v) return Core.emptyVisit();
    return {
      outcome:  v.outcome  || "not_visited",
      person:   v.person   || "",
      role:     v.role     || "",
      email:    v.email    || "",
      linkedin: v.linkedin || "",
      notes:    v.notes    || "",
      warm:     !!v.warm,
      followUp: !!v.followUp,
      savedAt:  v.savedAt  || null,
      updatedAt:v.updatedAt|| null
    };
  }

  function isWarmCard(visit) { return !!(visit && visit.warm); }

  // ── Toast ─────────────────────────────────────────────────────────────────────

  function showToast(message) {
    if (!els.toast) {
      var t = document.getElementById("toast");
      if (!t) return;
      els.toast = t;
    }
    els.toast.textContent = message;
    els.toast.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      if (els.toast) els.toast.hidden = true;
    }, 2800);
  }

  // ── Stats / framing ───────────────────────────────────────────────────────────

  function filterLabel(filterId) {
    if (filterId === "warm")        return "Warm & follow-up";
    if (filterId === "not_visited") return "Not visited";
    if (filterId === "visited")     return "Visited";
    return "All";
  }

  function updateAreaLocation() {
    var label = areaLabel(state.area);
    if (els.areaLocation)   els.areaLocation.textContent   = label;
    if (els.controlsCurrent) els.controlsCurrent.textContent = label;
    if (els.controlsHint) {
      var q      = (state.search || "").trim();
      var filter = filterLabel(state.filter || "all");
      if (q) {
        els.controlsHint.textContent = "Search: \u201c" + q + "\u201d \u00b7 " + filter;
      } else if (state.filter && state.filter !== "all") {
        els.controlsHint.textContent = filter + " \u00b7 Tap for search";
      } else {
        els.controlsHint.textContent = "Search & filters";
      }
    }
  }

  function updateStats() {
    var places = allPlaces();
    var toVisit = 0, good = 0, followUps = 0;
    for (var i = 0; i < places.length; i++) {
      if (!placeMatchesArea(places[i])) continue;
      var visit = getVisit(places[i].id);
      if (!Core.isVisited(visit))             toVisit  += 1;
      if (visit.outcome === "good_conversation") good    += 1;
      if (visit.followUp)                        followUps += 1;
    }
    if (els.statToVisit)  els.statToVisit.textContent  = String(toVisit);
    if (els.statGood)     els.statGood.textContent     = String(good);
    if (els.statFollowup) els.statFollowup.textContent = String(followUps);
    updateAreaLocation();
  }

  function renderOfferBox() {
    var mount = document.getElementById("offer-box");
    if (!mount) return;
    if (!isOfferActive()) { mount.hidden = true; mount.innerHTML = ""; return; }
    mount.hidden = false;
    mount.innerHTML =
      '<p class="offer-eyebrow">' + escapeHtml(CURRENT_OFFER.title) + "</p>" +
      '<p class="offer-main">'   + escapeHtml(CURRENT_OFFER.wording) + "</p>" +
      '<p class="offer-detail">' + escapeHtml(CURRENT_OFFER.detail || "") + "</p>";
  }

  function renderDecisionMakerCopy() {
    var el = document.getElementById("decision-maker-script");
    if (!el) return;
    el.textContent = getDecisionMakerScript();
  }

  // ── HTML generators ───────────────────────────────────────────────────────────

  var CONTACT_OUTCOMES = ["good_conversation", "leaflet_left", "reception_only"];
  var OUTCOME_LABELS   = Core.OUTCOME_LABELS;

  function tagsHtml(venue, visit) {
    var bits = [];
    if (venue.tags) {
      for (var i = 0; i < venue.tags.length; i++) {
        var t = venue.tags[i];
        bits.push('<span class="tag ' + escapeHtml(t.className) + '">' + escapeHtml(t.text) + "</span>");
      }
    }
    if (visit.warm) {
      bits.push('<span class="tag tag-warm">Warm lead</span>');
    } else if (visit.followUp) {
      bits.push('<span class="tag tag-followup">Follow-up</span>');
    }
    return bits.join("");
  }

  function visitChipHtml(visit) {
    if (!visit.savedAt || !Core.isVisited(visit)) return "";
    var label       = escapeHtml(OUTCOME_LABELS[visit.outcome] || visit.outcome);
    var contactLine = "";
    if (visit.person) {
      contactLine =
        '<span class="visit-chip-contact">' +
        escapeHtml(visit.person) +
        (visit.role ? " \u00b7 " + escapeHtml(visit.role) : "") +
        "</span>";
    }
    return '<div class="visit-chip">' +
      '<span class="visit-chip-outcome">' + label + "</span>" +
      contactLine + "</div>";
  }

  function compactAskForHtml(venue) {
    if (!venue || !venue.askFor || !venue.askFor.length) return "";
    var c = venue.askFor[0];
    if (!c || !c.name) return "";
    // Avoid duplicating a name already present in the at-the-door instruction.
    var angle = String(venue.angle || "").toLowerCase();
    if (angle && angle.indexOf(String(c.name).toLowerCase()) !== -1) return "";
    return '<p class="compact-ask-for">Ask for <strong>' + escapeHtml(c.name) + "</strong>" +
      (c.role ? " \u00b7 " + escapeHtml(c.role) : "") + "</p>";
  }

  function outcomeGridHtml(visit, id) {
    var saveable = Core.SAVEABLE_OUTCOMES;
    var html = '<div class="outcome-grid">';
    for (var i = 0; i < saveable.length; i++) {
      var o      = saveable[i];
      var active = visit.outcome === o;
      html +=
        '<button type="button" class="outcome-btn' + (active ? " is-active" : "") + '"' +
        ' data-outcome="' + escapeHtml(o) + '" data-id="' + escapeHtml(id) + '">' +
        escapeHtml(OUTCOME_LABELS[o] || o) + "</button>";
    }
    html += "</div>";
    return html;
  }

  function contactFieldsHtml(visit, id) {
    var show = CONTACT_OUTCOMES.indexOf(visit.outcome) !== -1;
    var eid  = escapeHtml(id);
    return (
      '<div class="contact-fields"' + (show ? "" : " hidden") + ' data-contact-for="' + eid + '">' +
        '<div class="field">' +
          '<label class="field-label" for="cf-person-' + eid + '">Name</label>' +
          '<input type="text" id="cf-person-' + eid + '" name="person" value="' + escapeHtml(visit.person) +
            '" autocomplete="name" placeholder="Contact name" enterkeyhint="next">' +
        "</div>" +
        '<div class="field">' +
          '<label class="field-label" for="cf-email-' + eid + '">Email</label>' +
          '<input type="email" id="cf-email-' + eid + '" name="email" value="' + escapeHtml(visit.email) +
            '" inputmode="email" autocomplete="email" placeholder="email@company.com" enterkeyhint="next">' +
        "</div>" +
        '<div class="field">' +
          '<label class="field-label" for="cf-notes-' + eid + '">Notes</label>' +
          '<textarea id="cf-notes-' + eid + '" name="notes" rows="3" placeholder="What they said, next step\u2026">' +
            escapeHtml(visit.notes) + "</textarea>" +
        "</div>" +
        '<button type="button" class="btn btn-primary btn-block save-details-btn" data-id="' + eid + '">' +
          "Save details</button>" +
      "</div>"
    );
  }

  function logPanelHtml(venue, visit) {
    var saved  = !!(visit.savedAt && Core.isVisited(visit));
    var eid    = escapeHtml(venue.id);
    return (
      '<details class="visit-collapse' + (saved ? " is-saved" : "") +
        '" data-visit-panel="' + eid + '">' +
        '<summary class="visit-collapse-summary">' +
          '<span class="visit-collapse-title">' + (saved ? "Update log" : "Log visit") + "</span>" +
          '<span class="visit-collapse-hint">' + (saved ? "Tap to edit" : "Tap to open") + "</span>" +
        "</summary>" +
        '<div class="visit-panel">' +
          outcomeGridHtml(visit, venue.id) +
          contactFieldsHtml(visit, venue.id) +
          (saved
            ? '<button type="button" class="btn btn-ghost btn-small btn-block clear-log-btn"' +
                ' data-id="' + eid + '" style="margin-top:10px">Clear log</button>'
            : "") +
        "</div>" +
      "</details>"
    );
  }

  function cardHtml(venue, visit) {
    var meta     = clusterMeta(venue.cluster);
    var legClass = meta.tone || "added";
    var warm     = isWarmCard(visit);
    var good     = visit.outcome === "good_conversation";
    var classes  = "venue-card" + (warm ? " is-warm" : "") + (good ? " is-good" : "");
    var maps     = mapsHref(venue.mapsQuery || venue.address || venue.name);

    var mapsBtn = maps
      ? '<a class="btn" href="' + escapeHtml(maps) + '" target="_blank" rel="noopener noreferrer">Maps</a>'
      : '<span class="btn" aria-disabled="true">No map</span>';

    var callBtn = venue.phoneHref
      ? '<a class="btn" href="' + escapeHtml(safeTelHref(venue.phoneHref)) + '">Call</a>'
      : '<span class="btn" aria-disabled="true">No phone</span>';

    var removeBtn = venue.isCustom
      ? '<button type="button" class="btn btn-danger btn-small btn-block remove-place"' +
          ' data-remove-place="' + escapeHtml(venue.id) + '" style="margin:0 14px 14px">Remove this place</button>'
      : "";

    var tagsStr = tagsHtml(venue, visit);

    return (
      '<article class="' + classes + '" data-venue-id="' + escapeHtml(venue.id) + '"' +
        ' data-area="' + escapeHtml(venue.area) + '" data-cluster="' + escapeHtml(venue.cluster || "") + '">' +
        '<div class="venue-head">' +
          '<div class="route-num ' + escapeHtml(legClass) + '" aria-hidden="true">' +
            escapeHtml(venue.routeOrder != null ? String(venue.routeOrder) : "") + "</div>" +
          '<div class="venue-info">' +
            '<h3 class="venue-name">' + escapeHtml(venue.name) + "</h3>" +
            (venue.type    ? '<p class="venue-type">' + escapeHtml(venue.type)    + "</p>" : "") +
            (venue.address ? '<p class="venue-addr">' + escapeHtml(venue.address) + "</p>" : "") +
            (tagsStr ? '<div class="tags">' + tagsStr + "</div>" : "") +
          "</div>" +
        "</div>" +
        (venue.angle
          ? '<div class="angle"><p class="angle-label">At the door</p>' +
              '<p class="angle-text">' + escapeHtml(venue.angle) + "</p></div>"
          : "") +
        compactAskForHtml(venue) +
        '<div class="card-actions">' + callBtn + mapsBtn + "</div>" +
        visitChipHtml(visit) +
        logPanelHtml(venue, visit) +
        removeBtn +
      "</article>"
    );
  }

  function clusterRouteUrl(places, areaId) {
    if (!places || !places.length) return "";
    var stops = places.map(function (place) {
      return place.mapsQuery || place.address || place.name;
    }).filter(Boolean);
    if (!stops.length) return "";

    var resolvedArea = areaId || (places[0] && places[0].area) || "";
    var isStPauls = resolvedArea === "st-pauls-cheapside";

    // St Paul's routes: first listed place is origin, last is destination.
    // Never prepend Courtyard / 17 The Market.
    if (isStPauls) {
      var origin = stops[0];
      var destination = stops[stops.length - 1];
      var middle = stops.slice(1, -1);
      var stPaulsUrl =
        "https://www.google.com/maps/dir/?api=1&origin=" +
        encodeURIComponent(origin) +
        "&destination=" +
        encodeURIComponent(destination) +
        "&travelmode=walking";
      if (middle.length) {
        stPaulsUrl +=
          "&waypoints=" +
          middle.map(function (stop) { return encodeURIComponent(stop); }).join("%7C");
      }
      return stPaulsUrl;
    }

    // Covent Garden (and other areas): keep Market as start/finish hub.
    var marketOrigin = "17 The Market, Covent Garden, London WC2E 8RB";
    return (
      "https://www.google.com/maps/dir/?api=1&origin=" +
      encodeURIComponent(marketOrigin) +
      "&destination=" +
      encodeURIComponent(marketOrigin) +
      "&travelmode=walking&waypoints=" +
      stops.map(function (stop) { return encodeURIComponent(stop); }).join("%7C")
    );
  }

  function clusterIntroHtml(cluster, places) {
    if (!cluster || !places || !places.length) return "";
    var routeUrl = clusterRouteUrl(places, cluster.area);
    if (!routeUrl) return "";
    var isStPauls = cluster.area === "st-pauls-cheapside";
    var isNewDropOff = !!ST_PAULS_NEW_DROPOFF_CLUSTERS[cluster.id];
    var startLabel = places[0].name || places[0].address || "First stop";
    var endLabel =
      places[places.length - 1].name ||
      places[places.length - 1].address ||
      "Last stop";
    var stopCount = places.length;

    var bodyLines;
    if (isStPauls) {
      bodyLines =
        (isNewDropOff
          ? '<p class="route-panel-line"><strong>NEW DROP-OFFS \u2014 NOT VISITED</strong></p>'
          : "") +
        '<p class="route-panel-line"><strong>Start:</strong> ' + escapeHtml(startLabel) + "</p>" +
        '<p class="route-panel-line"><strong>Finish:</strong> ' + escapeHtml(endLabel) + "</p>" +
        '<p class="route-panel-line">' +
          stopCount + " stop" + (stopCount === 1 ? "" : "s") +
          " \u00b7 open in Google Maps in listed order</p>";
    } else if (cluster.id === "additional-leaflet-targets-29-july") {
      bodyLines =
        '<p class="route-panel-line"><strong>Start and finish:</strong> 17 The Market</p>' +
        '<p class="route-panel-line">1.6 miles \u00b7 approximately 36 minutes walking</p>' +
        '<p class="route-panel-line">Allow 90\u2013120 minutes with conversations</p>';
    } else {
      bodyLines =
        '<p class="route-panel-line"><strong>Start and finish:</strong> 17 The Market</p>' +
        '<p class="route-panel-line">Open this cluster in Google Maps in stop order.</p>';
    }

    var btnLabel =
      cluster.id === "additional-leaflet-targets-29-july" || isNewDropOff
        ? "Open full walking route"
        : "Open cluster route";

    return (
      '<div class="route-panel" role="note" aria-label="Cluster walking route">' +
        bodyLines +
        '<a class="btn btn-secondary btn-small route-panel-btn" href="' + escapeHtml(routeUrl) + '" target="_blank" rel="noopener noreferrer">' +
          btnLabel +
        "</a>" +
      "</div>"
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  function render() {
    if (!els.routeList) return;
    var savedY = window.scrollY;

    // Preserve open log panels across re-renders
    var openPanels = {};
    var openDetails = els.routeList.querySelectorAll(".visit-collapse[open]");
    for (var d = 0; d < openDetails.length; d++) {
      var pid = openDetails[d].getAttribute("data-visit-panel");
      if (pid) openPanels[pid] = true;
    }

    var places      = allPlaces();
    var query       = (state.search || "").trim().toLowerCase();
    var html        = "";
    var visibleCount= 0;
    var clusterList = clustersForArea(state.area);
    var showedNewDropOffsBanner = false;

    for (var s = 0; s < clusterList.length; s++) {
      var cluster         = clusterList[s];
      var clusterHtml     = "";
      var clusterVisible  = false;
      var clusterPlaces   = [];

      for (var p = 0; p < places.length; p++) {
        if ((places[p].cluster || "added-nearby") === cluster.id) clusterPlaces.push(places[p]);
      }
      clusterPlaces.sort(function (a, b) { return (a.routeOrder || 0) - (b.routeOrder || 0); });

      for (var i = 0; i < clusterPlaces.length; i++) {
        var venue = clusterPlaces[i];
        if (!placeMatchesArea(venue)) continue;
        var visit = getVisit(venue.id);
        if (!placeMatchesSearch(venue, visit, query)) continue;
        if (!placeMatchesFilter(venue, visit)) continue;
        clusterVisible = true;
        visibleCount  += 1;
        clusterHtml   += cardHtml(venue, visit);
      }

      if (clusterVisible) {
        if (ST_PAULS_NEW_DROPOFF_CLUSTERS[cluster.id] && !showedNewDropOffsBanner) {
          showedNewDropOffsBanner = true;
          html +=
            '<div class="cluster-divider cluster-divider-section" role="heading" aria-level="2">' +
            "NEW DROP-OFFS \u2014 NOT VISITED</div>";
        }
        html +=
          '<div class="cluster-divider" role="heading" aria-level="2">' +
          escapeHtml(cluster.label) + "</div>" +
          clusterIntroHtml(cluster, clusterPlaces) +
          clusterHtml;
      }
    }

    if (!visibleCount) {
      html = '<p class="empty-state">No places match. Try All areas or clear the search.</p>';
    }

    els.routeList.innerHTML = html;

    // Restore open panels
    var panelIds = Object.keys(openPanels);
    for (var k = 0; k < panelIds.length; k++) {
      var panel = els.routeList.querySelector(
        '.visit-collapse[data-visit-panel="' + panelIds[k] + '"]'
      );
      if (panel) panel.open = true;
    }

    updateStats();
    if (scrollToTopOnNextRender) {
      scrollToTopOnNextRender = false;
      window.scrollTo(0, 0);
    } else {
      window.scrollTo(0, savedY);
    }
  }

  // ── Visit event handlers ──────────────────────────────────────────────────────

  function onOutcomeClick(id, outcome) {
    var prev  = getVisit(id);
    var visit = Core.normalizeVisitForSave({
      outcome:  outcome,
      person:   prev.person,
      email:    prev.email,
      notes:    prev.notes,
      role:     prev.role,
      linkedin: prev.linkedin,
      savedAt:  prev.savedAt || new Date().toISOString()
    }, prev);
    state.visits[id] = visit;
    persistVisits();
    addPending(id);
    render();
    cloudUpsertVisit(id, visit).then(function (ok) {
      showToast(ok ? "Visit saved." : "Saved on phone.");
    });
  }

  function onSaveDetails(id, container) {
    var personInput = container.querySelector('[name="person"]');
    var emailInput  = container.querySelector('[name="email"]');
    var notesInput  = container.querySelector('[name="notes"]');
    var person = personInput ? String(personInput.value || "").trim() : "";
    var email  = emailInput  ? String(emailInput.value  || "").trim() : "";
    var notes  = notesInput  ? String(notesInput.value  || "").trim() : "";

    if (email && !Core.isValidEmail(email)) {
      showToast("Please enter a valid email address.");
      if (emailInput) emailInput.focus();
      return;
    }

    var prev  = getVisit(id);
    var visit = Core.normalizeVisitForSave({
      outcome:  prev.outcome,
      person:   person,
      email:    email,
      notes:    notes,
      role:     prev.role,
      linkedin: prev.linkedin,
      savedAt:  prev.savedAt || new Date().toISOString()
    }, prev);
    state.visits[id] = visit;
    persistVisits();
    addPending(id);
    render();
    cloudUpsertVisit(id, visit).then(function (ok) {
      showToast(ok ? "Details saved." : "Saved on phone.");
    });
  }

  function onClearLog(id) {
    if (!window.confirm("Clear log for this place?")) return;
    var visit = Core.normalizeVisitForSave({ outcome: "not_visited" }, getVisit(id));
    state.visits[id] = visit;
    persistVisits();
    render();
    cloudUpsertVisit(id, visit);
    showToast("Log cleared.");
  }

  function onRemovePlace(id) {
    var isCustom = state.customPlaces.some(function (p) { return p.id === id; });
    if (!isCustom) { showToast("Original route venues cannot be removed."); return; }
    if (!window.confirm("Remove this added place?")) return;
    state.customPlaces = state.customPlaces.filter(function (p) { return p.id !== id; });
    delete state.visits[id];
    persistPlaces();
    persistVisits();
    cloudDeletePlace(id);
    render();
    showToast("Place removed.");
  }

  function onRouteClick(event) {
    var outcomeBtn = event.target.closest(".outcome-btn");
    if (outcomeBtn) {
      var oid = outcomeBtn.getAttribute("data-id");
      var outcome = outcomeBtn.getAttribute("data-outcome");
      if (oid && outcome) onOutcomeClick(oid, outcome);
      return;
    }

    var saveBtn = event.target.closest(".save-details-btn");
    if (saveBtn) {
      var sid = saveBtn.getAttribute("data-id");
      var cf  = saveBtn.closest(".contact-fields");
      if (sid && cf) onSaveDetails(sid, cf);
      return;
    }

    var clearBtn = event.target.closest(".clear-log-btn");
    if (clearBtn) {
      var cid = clearBtn.getAttribute("data-id");
      if (cid) onClearLog(cid);
      return;
    }

    var removeBtn = event.target.closest("[data-remove-place]");
    if (removeBtn) {
      onRemovePlace(removeBtn.getAttribute("data-remove-place"));
      return;
    }
  }

  // ── Add-place sheet ───────────────────────────────────────────────────────────

  function openSheet() {
    populateAddSheet();
    if (els.sheet)   els.sheet.hidden   = false;
    if (els.backdrop) els.backdrop.hidden = false;
    document.body.classList.add("sheet-open");
    var first = document.getElementById("add-name");
    if (first) setTimeout(function () { first.focus(); }, 60);
  }

  function closeSheet() {
    if (els.sheet)   els.sheet.hidden   = true;
    if (els.backdrop) els.backdrop.hidden = true;
    document.body.classList.remove("sheet-open");
    if (els.addForm) els.addForm.reset();
  }

  function populateAddSheet() {
    var areaField = document.getElementById("add-area-field");
    if (areaField) {
      var needArea = state.area === "all";
      areaField.hidden = !needArea;
      if (needArea) {
        var areaSelect = document.getElementById("add-area");
        if (areaSelect) {
          var areaHtml = "";
          for (var i = 0; i < AREAS.length; i++) {
            areaHtml += '<option value="' + escapeHtml(AREAS[i].id) + '">' + escapeHtml(AREAS[i].label) + "</option>";
          }
          areaSelect.innerHTML = areaHtml;
        }
      }
    }
  }

  function onAddPlace(event) {
    event.preventDefault();
    var form = els.addForm;
    if (!form) return;

    var nameEl = form.elements["name"] || document.getElementById("add-name");
    var name   = String((nameEl && nameEl.value) || "").trim();
    if (!name) {
      showToast("Company or venue name is required.");
      if (nameEl) nameEl.focus();
      return;
    }

    var emailEl = form.elements["email"] || document.getElementById("add-email");
    var email   = String((emailEl && emailEl.value) || "").trim();
    if (email && !Core.isValidEmail(email)) {
      showToast("Please enter a valid email address.");
      if (emailEl) emailEl.focus();
      return;
    }

    var addrEl   = form.elements["address"] || document.getElementById("add-address");
    var address  = String((addrEl && addrEl.value) || "").trim();
    var outcomeEl= form.elements["outcome"] || document.getElementById("add-outcome");
    var outcome  = String((outcomeEl && outcomeEl.value) || "not_visited");
    var personEl = form.elements["person"] || document.getElementById("add-person");
    var person   = String((personEl && personEl.value) || "").trim();
    var notesEl  = form.elements["notes"] || document.getElementById("add-notes");
    var notes    = String((notesEl && notesEl.value) || "").trim();

    var selectedArea;
    if (state.area === "all") {
      var areaEl = form.elements["area"] || document.getElementById("add-area");
      selectedArea = Core.normalizeAreaId(String((areaEl && areaEl.value) || "covent-garden")) || "covent-garden";
    } else {
      selectedArea = state.area;
    }

    var id    = "custom-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
    var place = {
      id:         id,
      name:       name,
      address:    address,
      type:       "",
      phone:      "",
      warmSeed:   false,
      area:       selectedArea,
      cluster:    "added-nearby",
      routeOrder: 999,
      updatedAt:  new Date().toISOString()
    };
    state.customPlaces.push(place);

    var visit      = null;
    var shouldSave = outcome !== "not_visited" || person || email || notes;
    if (shouldSave) {
      visit = Core.normalizeVisitForSave({
        outcome: outcome, person: person, email: email, notes: notes,
        savedAt: new Date().toISOString()
      }, Core.emptyVisit());
      state.visits[id] = visit;
    }

    persistPlaces();
    if (shouldSave) persistVisits();
    closeSheet();
    render();
    showToast("Place added.");

    cloudUpsertPlace(place).then(function (ok) {
      if (!ok) return;
      if (visit) cloudUpsertVisit(id, visit);
    });
  }

  // ── Area tabs / controls ──────────────────────────────────────────────────────

  function renderAreaTabs() {
    if (!els.areaTabsMount) return;
    var html = "";
    for (var i = 0; i < AREAS.length; i++) {
      var a      = AREAS[i];
      var active = state.area === a.id;
      html += '<button type="button" class="area-tab' + (active ? " is-active" : "") +
        '" data-area="' + escapeHtml(a.id) + '" aria-pressed="' + (active ? "true" : "false") + '">' +
        escapeHtml(a.label) + "</button>";
    }
    var allActive = state.area === "all";
    html += '<button type="button" class="area-tab' + (allActive ? " is-active" : "") +
      '" data-area="all" aria-pressed="' + (allActive ? "true" : "false") + '">All areas</button>';
    els.areaTabsMount.innerHTML = html;

    var tabs = els.areaTabsMount.querySelectorAll(".area-tab");
    for (var t = 0; t < tabs.length; t++) {
      (function (btn) {
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          var next    = btn.getAttribute("data-area") || "covent-garden";
          state.area  = next === "all" ? "all" : Core.normalizeAreaId(next);
          persistSelectedArea();
          scrollToTopOnNextRender = true;
          closeControlsPanel();
          renderAreaTabs();
          render();
        });
      })(tabs[t]);
    }
    els.areaTabs = Array.prototype.slice.call(tabs);
  }

  function closeControlsPanel() {
    if (!els.controlsCollapse) return;
    els.controlsCollapse.open = false;
    window.setTimeout(function () {
      if (els.controlsCollapse) els.controlsCollapse.open = false;
    }, 0);
  }

  function loadSelectedArea() {
    var saved = null;
    try { saved = localStorage.getItem(STORAGE_AREA); } catch (e) { /* ignore */ }
    if (saved === "all") { state.area = "all"; return; }
    var normalized = Core.normalizeAreaId(saved || "covent-garden");
    var known      = AREAS.some(function (a) { return a.id === normalized; });
    state.area     = known ? normalized : "covent-garden";
  }

  // ── State load ────────────────────────────────────────────────────────────────

  function loadState() {
    state.visits       = loadJson(STORAGE_VISITS, {}) || {};
    state.customPlaces = loadJson(STORAGE_PLACES, []) || [];
    if (!Array.isArray(state.customPlaces)) state.customPlaces = [];

    // Legacy migration: me-and-you-curious → me-and-you-productions
    var needsMigration = !!(state.visits["me-and-you-curious"] && !state.visits["me-and-you-productions"]);
    state.visits = Core.migrateLegacyCombinedVenue(state.visits);
    if (needsMigration) persistVisits();
  }

  // ── Bind ──────────────────────────────────────────────────────────────────────

  function bind() {
    on(els.search, "input", function () {
      state.search = els.search.value || "";
      updateAreaLocation();
      render();
    });

    on(els.search, "keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        closeControlsPanel();
        if (els.search && typeof els.search.blur === "function") els.search.blur();
      }
    });

    if (els.filters) {
      els.filters.forEach(function (btn) {
        btn.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          state.filter = btn.getAttribute("data-filter") || "all";
          els.filters.forEach(function (b) {
            var active = b === btn;
            b.classList.toggle("is-active", active);
            b.setAttribute("aria-pressed", active ? "true" : "false");
          });
          closeControlsPanel();
          render();
        });
      });
    }

    on(els.routeList, "click", onRouteClick);
    on(els.addBtn,    "click", openSheet);
    on(els.closeSheet,"click", closeSheet);
    on(els.backdrop,  "click", closeSheet);
    on(els.addForm,   "submit", onAddPlace);

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        if (els.sheet && !els.sheet.hidden) closeSheet();
        if (els.controlsCollapse && els.controlsCollapse.open) closeControlsPanel();
      }
    });

    document.addEventListener("click", function (event) {
      if (!els.controlsCollapse || !els.controlsCollapse.open) return;
      if (els.controlsCollapse.contains(event.target)) return;
      closeControlsPanel();
    });
  }

  // ── Cache elements (crash-proof) ──────────────────────────────────────────────

  function safeGet(id) {
    try { return document.getElementById(id); } catch (e) { return null; }
  }

  function cacheEls() {
    try {
      els.routeList        = safeGet("route-list");
      els.statToVisit      = safeGet("stat-to-visit");
      els.statGood         = safeGet("stat-good");
      els.statFollowup     = safeGet("stat-followup");
      els.search           = safeGet("search-input");
      els.areaTabsMount    = safeGet("area-tabs");
      els.controlsCollapse = safeGet("controls-collapse");
      els.controlsCurrent  = safeGet("controls-current");
      els.controlsHint     = safeGet("controls-hint");
      els.areaLocation     = safeGet("area-location");
      els.addBtn           = safeGet("add-place-btn");
      els.sheet            = safeGet("add-place-sheet");
      els.backdrop         = safeGet("sheet-backdrop");
      els.closeSheet       = safeGet("close-sheet-btn");
      els.addForm          = safeGet("add-place-form");
      els.toast            = safeGet("toast");
      try {
        els.filters = Array.prototype.slice.call(document.querySelectorAll(".filter-btn") || []);
      } catch (e2) {
        els.filters = [];
      }
    } catch (e) { /* crash-proof: ignore element caching failures */ }
  }

  // ── Init ──────────────────────────────────────────────────────────────────────

  function init() {
    try {
      cacheEls();
      loadState();
      loadSelectedArea();
      renderAreaTabs();
      renderOfferBox();
      renderDecisionMakerCopy();
      render();    // render BEFORE bind
      bind();
      updateSaveNotice();
      initSupabase();
      initAuth();
    } catch (err) {
      var bootErr = document.getElementById("boot-error");
      if (!bootErr) bootErr = safeGet("boot-error");
      if (bootErr) {
        bootErr.hidden  = false;
        bootErr.textContent = "App failed to start. Reload to try again." +
          (err && err.message ? " (" + err.message + ")" : "");
      }
      // Still try to show the route list
      if (!els.routeList) els.routeList = document.getElementById("route-list");
      try { render(); } catch (e2) { /* ignore */ }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
