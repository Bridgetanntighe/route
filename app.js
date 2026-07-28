(function () {
  "use strict";

  var STORAGE_VISITS = "cgc-outreach-v1-visits";
  var STORAGE_PLACES = "cgc-outreach-v1-places";
  var STORAGE_AREA = "cgc-outreach-v1-selected-area";

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

  var AREAS = [
    { id: "covent-garden", label: "Covent Garden" },
    { id: "st-pauls-cheapside", label: "St Paul's & Cheapside" }
    // Future: { id: "soho-fitzrovia", label: "Soho & Fitzrovia" },
    // Future: { id: "holborn", label: "Holborn" },
    // Future: { id: "bank-monument", label: "Bank & Monument" }
  ];

  var CLUSTERS = [
    { id: "bow-street", area: "covent-garden", label: "Bow Street cluster", tone: "leg-a" },
    { id: "slingsby-st-martins", area: "covent-garden", label: "Slingsby Place & St Martin's Lane cluster", tone: "leg-b" },
    { id: "long-acre-parker", area: "covent-garden", label: "Long Acre & Parker Street cluster", tone: "leg-c" },
    { id: "holborn", area: "covent-garden", label: "Holborn cluster", tone: "leg-d" },
    { id: "shorts-gardens-kingsway", area: "covent-garden", label: "Short's Gardens & Kingsway cluster", tone: "leg-e" },
    { id: "return-to-base", area: "covent-garden", label: "Near base cluster", tone: "bonus" },
    { id: "fleet-street-ludgate", area: "st-pauls-cheapside", label: "Fleet Street & Ludgate cluster", tone: "leg-f" },
    { id: "st-pauls-cheapside", area: "st-pauls-cheapside", label: "St Paul's & Cheapside cluster", tone: "leg-g" },
    { id: "smithfield-farringdon", area: "st-pauls-cheapside", label: "Smithfield & Farringdon cluster", tone: "leg-h" },
    { id: "clerkenwell", area: "st-pauls-cheapside", label: "Clerkenwell cluster", tone: "leg-i" },
    { id: "added-nearby", area: null, label: "Added nearby", tone: "added" }
  ];

  
  function areaLabel(areaId) {
    if (areaId === "all") return "All areas";
    for (var i = 0; i < AREAS.length; i++) {
      if (AREAS[i].id === areaId) return AREAS[i].label;
    }
    return areaId || "Unknown area";
  }

  function normalizeAreaId(areaId) {
    if (!areaId || areaId === "all") return areaId || "covent-garden";
    if (areaId === "st-pauls") return "st-pauls-cheapside";
    return areaId;
  }

  function clusterMeta(clusterId) {
    for (var i = 0; i < CLUSTERS.length; i++) {
      if (CLUSTERS[i].id === clusterId) return CLUSTERS[i];
    }
    return { id: clusterId || "added-nearby", label: "Added nearby", tone: "added", area: null };
  }

  function clusterLabel(clusterId) {
    return clusterMeta(clusterId).label;
  }

  function clustersForArea(areaId) {
    return CLUSTERS.filter(function (c) {
      if (c.id === "added-nearby") return true;
      if (areaId === "all") return true;
      return c.area === areaId;
    });
  }

  /** Venue seed data — IDs must stay stable for saved visits. */
  var VENUES = [
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
      area: "covent-garden",
      cluster: "bow-street",
      routeOrder: 2,
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
      area: "covent-garden",
      cluster: "bow-street",
      routeOrder: 3,
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
      area: "covent-garden",
      cluster: "slingsby-st-martins",
      routeOrder: 1,
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
      area: "covent-garden",
      cluster: "slingsby-st-martins",
      routeOrder: 2,
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
      area: "covent-garden",
      cluster: "slingsby-st-martins",
      routeOrder: 3,
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
      area: "covent-garden",
      cluster: "slingsby-st-martins",
      routeOrder: 4,
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
      area: "covent-garden",
      cluster: "long-acre-parker",
      routeOrder: 1,
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
      area: "covent-garden",
      cluster: "long-acre-parker",
      routeOrder: 2,
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
      area: "covent-garden",
      cluster: "long-acre-parker",
      routeOrder: 3,
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
      area: "covent-garden",
      cluster: "holborn",
      routeOrder: 1,
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
      area: "covent-garden",
      cluster: "holborn",
      routeOrder: 2,
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
      area: "covent-garden",
      cluster: "holborn",
      routeOrder: 3,
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
      area: "covent-garden",
      cluster: "holborn",
      routeOrder: 4,
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
      area: "covent-garden",
      cluster: "shorts-gardens-kingsway",
      routeOrder: 1,
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
      area: "covent-garden",
      cluster: "shorts-gardens-kingsway",
      routeOrder: 2,
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
        "Brief drop on the way back. Leave menu + business card. \"Catering from The Market for client meetings — next-day delivery.\"",
      area: "covent-garden"
    },

    /* Walk B — St Paul's / Cheapside / Farringdon (mid-size, reception-accessible) */
    {
      id: "bell-yard-kysen",
      area: "st-pauls-cheapside",
      cluster: "fleet-street-ludgate",
      routeOrder: 1,
      name: "Bell Yard Kysen Communications",
      type: "Legal / Litigation PR Agency",
      address: "21 Fleet Street, EC4Y 1AA",
      walk: "5 min from St Paul's",
      score: 9,
      tags: [{ className: "tag-new", text: "High fit · mid-size specialist" }],
      phone: "+44 20 7936 2021",
      phoneHref: "+442079362021",
      phoneLabel: "+44 20 7936 2021",
      mapsQuery: "21 Fleet Street, London EC4Y 1AA",
      angle:
        "Specialist legal PR team — lots of client meetings. \"Hi — we're Covent Garden Catering from The Market. We deliver boardroom lunches and grazing boards for professional services teams, next-day for local offices. Who organises catering for client meetings here?\""
    },
    {
      id: "fortis-consulting",
      area: "st-pauls-cheapside",
      cluster: "fleet-street-ludgate",
      routeOrder: 2,
      name: "Fortis Consulting London",
      type: "Boutique Business Consultancy",
      address: "Office 7, 35–37 Ludgate Hill, EC4M 7JN",
      walk: "2 min",
      score: 7,
      tags: [{ className: "tag-new", text: "Small team · same building as other suites" }],
      phone: "+44 20 7193 6953",
      phoneHref: "+442071936953",
      phoneLabel: "+44 20 7193 6953",
      mapsQuery: "35-37 Ludgate Hill, London EC4M 7JN",
      angle:
        "Multi-suite building on Ludgate Hill — ask at reception for Fortis. \"Premium working lunches and client meeting boards from Covent Garden — could I leave a menu for whoever books catering?\""
    },
    {
      id: "tate-associates",
      area: "st-pauls-cheapside",
      cluster: "fleet-street-ludgate",
      routeOrder: 3,
      name: "Tate & Associates",
      type: "Recruitment Consultancy",
      address: "35–37 Ludgate Hill, EC4M 7JN",
      walk: "Same building as Fortis",
      score: 7,
      tags: [
        { className: "tag-new", text: "Recruitment · team lunches" },
        { className: "tag-multi", text: "2 stops, 1 building" }
      ],
      phone: "+44 20 7236 7766",
      phoneHref: "+442072367766",
      phoneLabel: "+44 20 7236 7766",
      mapsQuery: "35-37 Ludgate Hill, London EC4M 7JN",
      angle:
        "Recruitment teams host interviews and client lunches. \"Hi — Covent Garden Catering. We do breakfast boards and working lunches for City offices, next-day delivery. Could I leave a menu for your office manager?\""
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
      tags: [{ className: "tag-new", text: "Accessible City law office" }],
      phone: "+44 20 7160 9777",
      phoneHref: "+442071609777",
      phoneLabel: "+44 20 7160 9777",
      mapsQuery: "20 Old Bailey, London EC4M 1AN",
      angle:
        "Boardroom only: \"Premium boardroom platters and working lunches for client meetings — sourced properly, next-day from Covent Garden. Could I leave a menu for your EA or office manager?\""
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
      tags: [{ className: "tag-new", text: "Boutique · personal service culture" }],
      phone: "+44 20 7480 7865",
      phoneHref: "+442074807865",
      phoneLabel: "+44 20 7480 7865",
      mapsQuery: "Mermaid House, 2 Puddle Dock, London EC4V 3DS",
      angle:
        "Boutique firm — easier to reach a decision-maker. \"Hi — we're Covent Garden Catering. We deliver premium catering for client meetings and team days. Who usually organises food here?\""
    },
    {
      id: "russell-bedford",
      area: "st-pauls-cheapside",
      cluster: "st-pauls-cheapside",
      routeOrder: 2,
      name: "Russell Bedford International",
      type: "Accountancy / Advisory Network HQ",
      address: "Paternoster House, 65 St Paul's Churchyard, EC4M 8AB",
      walk: "4 min · manned building reception",
      score: 7,
      tags: [{ className: "tag-new", text: "Paternoster House" }],
      phone: "+44 20 7410 0339",
      phoneHref: "+442074100339",
      phoneLabel: "+44 20 7410 0339",
      mapsQuery: "Paternoster House, 65 St Paul's Churchyard, London EC4M 8AB",
      angle:
        "Ask at Paternoster House reception for Russell Bedford. \"Boardroom lunches and working platters for professional services — next-day delivery from Covent Garden. Could I leave a menu?\""
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
      tags: [{ className: "tag-new", text: "Larger team — still ask for office manager" }],
      phone: "+44 20 3465 4500",
      phoneHref: "+442034654500",
      phoneLabel: "+44 20 3465 4500",
      mapsQuery: "107 Cheapside, London EC2V 6DN",
      angle:
        "Larger consultancy — aim for reception → office manager. \"Hi — Covent Garden Catering. We deliver breakfasts, working lunches and grazing boards for City offices. Who books catering for team days or client meetings?\""
    },
    {
      id: "big-little-ldn",
      area: "st-pauls-cheapside",
      cluster: "smithfield-farringdon",
      routeOrder: 1,
      name: "BIG little LDN",
      type: "Boutique PR & Marketing Agency",
      address: "1st Floor, Abbey House, 74–76 St John Street, EC1M 4DZ",
      walk: "8 min toward Farringdon",
      score: 9,
      tags: [{ className: "tag-new", text: "Top fit · small agency culture" }],
      phone: "",
      phoneHref: "",
      phoneLabel: "",
      mapsQuery: "74-76 St John Street, London EC1M 4DZ",
      angle:
        "Small agency — ask for Emma's team / office manager by name if offered. \"Hi — we're Covent Garden Catering from The Market. We do team breakfasts and client meeting boards for creative agencies. Could I leave a menu and take an email for the digital version?\""
    },
    {
      id: "smithfield-agency",
      area: "st-pauls-cheapside",
      cluster: "smithfield-farringdon",
      routeOrder: 2,
      name: "Smithfield Agency",
      type: "Independent Media Planning Agency",
      address: "22 St James's Walk, EC1R 0AP",
      walk: "5 min · ~20 people",
      score: 9,
      tags: [{ className: "tag-new", text: "Top fit · mid-size media agency" }],
      phone: "+44 20 7257 2600",
      phoneHref: "+442072572600",
      phoneLabel: "+44 20 7257 2600",
      mapsQuery: "22 St James's Walk, London EC1R 0AP",
      angle:
        "Perfect size. \"Hi — Covent Garden Catering. We deliver premium office catering for agency teams — breakfast boards and working lunches, next-day. Who looks after catering here?\""
    },
    {
      id: "sec-newgate",
      area: "st-pauls-cheapside",
      cluster: "smithfield-farringdon",
      routeOrder: 3,
      name: "SEC Newgate UK",
      type: "Strategic Communications / Public Affairs",
      address: "14 Greville Street, EC1N 8SB",
      walk: "4 min · Farringdon",
      score: 8,
      tags: [{ className: "tag-new", text: "Comms HQ · meeting-heavy" }],
      phone: "+44 20 3757 6767",
      phoneHref: "+442037576767",
      phoneLabel: "+44 20 3757 6767",
      mapsQuery: "14 Greville Street, London EC1N 8SB",
      angle:
        "Meeting-heavy comms firm. \"Hi — we're Covent Garden Catering. Premium boardroom catering and team lunches from The Market, next-day for local offices. Who organises catering for client meetings?\""
    },
    {
      id: "flame-pr",
      area: "st-pauls-cheapside",
      cluster: "clerkenwell",
      routeOrder: 1,
      name: "Flame PR",
      type: "Full-Service Marketing Agency",
      address: "37 Pear Tree Street, EC1V 3AG",
      walk: "8 min north · Clerkenwell",
      score: 8,
      tags: [{ className: "tag-new", text: "Bonus stop if time" }],
      phone: "+44 20 3357 9740",
      phoneHref: "+442033579740",
      phoneLabel: "+44 20 3357 9740",
      mapsQuery: "37 Pear Tree Street, London EC1V 3AG",
      angle:
        "\"Hi — Covent Garden Catering. We deliver breakfast boards and working lunches for marketing teams. Could I leave a menu for your office manager?\""
    },
    {
      id: "words-pixels",
      area: "st-pauls-cheapside",
      cluster: "clerkenwell",
      routeOrder: 2,
      name: "Words+Pixels",
      type: "Award-Winning PR Agency (~25 people)",
      address: "Ground Floor, Silverlight House, 6–8 Standard Place, EC2A 3BE",
      walk: "10 min · only if energy left",
      score: 9,
      tags: [{ className: "tag-new", text: "Top fit · ground-floor PR" }],
      phone: "",
      phoneHref: "",
      phoneLabel: "",
      mapsQuery: "Silverlight House, 6-8 Standard Place, London EC2A 3BE",
      angle:
        "Ground-floor PR agency — good chance of speaking to someone. \"Hi — Covent Garden Catering from The Market. We do client meeting boards and team lunches for PR agencies. Could I leave a menu and grab an email for the digital version?\""
    }
  ];

  var state = {
    visits: {},
    customPlaces: [],
    search: "",
    filter: "all",
    area: "covent-garden"
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
      name: row.name || "",
      address: row.address || "",
      type: row.type || "",
      phone: row.phone || "",
      warmSeed: !!row.warm_seed,
      area: normalizeAreaId(row.area || "covent-garden"),
      cluster: row.cluster || "added-nearby",
      routeOrder: row.route_order != null ? row.route_order : 999
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
    var list = [];
    for (var v = 0; v < VENUES.length; v++) {
      var seed = VENUES[v];
      list.push(
        Object.assign({}, seed, {
          area: normalizeAreaId(seed.area || "covent-garden"),
          cluster: seed.cluster || "added-nearby",
          routeOrder: seed.routeOrder != null ? seed.routeOrder : 0
        })
      );
    }
    for (var i = 0; i < state.customPlaces.length; i++) {
      var p = state.customPlaces[i];
      var area = normalizeAreaId(p.area || "covent-garden");
      list.push({
        id: p.id,
        area: area,
        cluster: p.cluster || "added-nearby",
        routeOrder: p.routeOrder != null ? p.routeOrder : 999,
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
        angle: "Custom stop added in this area.",
        isCustom: true,
        warmSeed: !!p.warmSeed
      });
    }
    return list;
  }

  function placeMatchesArea(venue) {
    if (state.area === "all") return true;
    return normalizeAreaId(venue.area || "covent-garden") === state.area;
  }

  function placeMatchesSearch(venue, visit, query) {
    if (!query) return true;
    var hay = [
      venue.name,
      venue.type,
      venue.address,
      venue.walk,
      venue.angle,
      venue.area,
      venue.cluster,
      areaLabel(venue.area),
      clusterLabel(venue.cluster),
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
      if (!placeMatchesArea(places[i])) continue;
      var visit = getVisit(places[i].id);
      if (!isVisited(visit)) toVisit += 1;
      if (visit.outcome === "good_conversation") good += 1;
      if (visit.followUp) followUps += 1;
    }

    els.statToVisit.textContent = String(toVisit);
    els.statGood.textContent = String(good);
    els.statFollowup.textContent = String(followUps);
    updateAreaLocation();
  }

  function updateAreaLocation() {
    if (!els.areaLocation) return;
    els.areaLocation.textContent = areaLabel(state.area);
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
    var meta = clusterMeta(venue.cluster);
    var legClass = meta.tone || "added";
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
      '" data-area="' +
      escapeHtml(venue.area) +
      '" data-cluster="' +
      escapeHtml(venue.cluster || "") +
      '">' +
      '<div class="venue-head">' +
      '<div class="route-num ' +
      escapeHtml(legClass) +
      '" aria-hidden="true">' +
      escapeHtml(venue.routeOrder != null ? venue.routeOrder : "") +
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
    var clusterList = clustersForArea(state.area);

    for (var s = 0; s < clusterList.length; s++) {
      var cluster = clusterList[s];
      var clusterHasVisible = false;
      var clusterHtml = "";
      var clusterPlaces = places
        .filter(function (venue) {
          return (venue.cluster || "added-nearby") === cluster.id;
        })
        .sort(function (a, b) {
          return (a.routeOrder || 0) - (b.routeOrder || 0);
        });

      for (var i = 0; i < clusterPlaces.length; i++) {
        var venue = clusterPlaces[i];
        if (!placeMatchesArea(venue)) continue;
        var visit = getVisit(venue.id);
        if (!placeMatchesSearch(venue, visit, query)) continue;
        if (!placeMatchesFilter(venue, visit)) continue;
        clusterHasVisible = true;
        visibleCount += 1;
        clusterHtml += cardHtml(venue, visit);
      }

      if (clusterHasVisible) {
        html +=
          '<div class="cluster-divider" role="heading" aria-level="2">' +
          escapeHtml(cluster.label) +
          "</div>" +
          clusterHtml;
      }
    }

    if (!visibleCount) {
      html =
        '<p class="empty-state">No places match this search or filter. Try All areas, or clear the search.</p>';
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
    populateAddPlaceAreaFields();
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

    var selectedArea = normalizeAreaId(String(form.area ? form.area.value : "") || (state.area === "all" ? "covent-garden" : state.area));
    var selectedCluster = String(form.cluster ? form.cluster.value : "").trim() || "added-nearby";
    var place = {
      id: id,
      name: name,
      address: address,
      type: type,
      phone: phone,
      warmSeed: warm,
      area: selectedArea,
      cluster: selectedCluster,
      routeOrder: 999
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
    var places = allPlaces()
      .filter(function (venue) {
        return placeMatchesArea(venue) && isVisited(getVisit(venue.id));
      })
      .sort(function (a, b) {
        var aa = normalizeAreaId(a.area);
        var ba = normalizeAreaId(b.area);
        if (aa !== ba) return aa < ba ? -1 : 1;
        if ((a.cluster || "") !== (b.cluster || "")) return (a.cluster || "") < (b.cluster || "") ? -1 : 1;
        return (a.routeOrder || 0) - (b.routeOrder || 0);
      });

    if (!places.length) return null;

    var lines = [];
    lines.push("Covent Garden Catering — Outreach log");
    lines.push(formatDate());
    lines.push(areaLabel(state.area));
    lines.push("");

    var currentArea = null;
    for (var i = 0; i < places.length; i++) {
      var venue = places[i];
      var visit = getVisit(venue.id);
      var areaId = normalizeAreaId(venue.area);
      if (state.area === "all" && areaId !== currentArea) {
        currentArea = areaId;
        lines.push("— " + areaLabel(areaId) + " —");
        lines.push("");
      }
      lines.push("• " + venue.name);
      lines.push("  Area: " + areaLabel(areaId));
      lines.push("  Cluster: " + clusterLabel(venue.cluster));
      lines.push("  Outcome: " + (OUTCOME_LABELS[visit.outcome] || visit.outcome));
      lines.push("  Contact: " + (visit.person || "—"));
      lines.push("  Role: " + (visit.role || "—"));
      lines.push("  Email: " + (visit.email || "—"));
      lines.push("  Notes: " + (visit.notes || "—"));
      lines.push("  Follow-up: " + (visit.followUp ? "Yes" : "No"));
      lines.push("");
    }

    lines.push(
      cloudReady
        ? "Shared from the Outreach tracker. Data is saved in Supabase and on the device used."
        : "Shared from the Outreach tracker. Data was saved on the device used."
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

  
  function loadSelectedArea() {
    var saved = null;
    try {
      saved = localStorage.getItem(STORAGE_AREA);
    } catch (err) {
      saved = null;
    }
    if (saved === "all") {
      state.area = "all";
      return;
    }
    var normalized = normalizeAreaId(saved || "covent-garden");
    var known = AREAS.some(function (a) { return a.id === normalized; });
    state.area = known ? normalized : "covent-garden";
  }

  function persistSelectedArea() {
    try {
      localStorage.setItem(STORAGE_AREA, state.area);
    } catch (err) {
      /* ignore */
    }
  }

  function renderAreaTabs() {
    if (!els.areaTabsMount) return;
    var html = "";
    for (var i = 0; i < AREAS.length; i++) {
      var area = AREAS[i];
      var active = state.area === area.id;
      html +=
        '<button type="button" class="area-tab' +
        (active ? " is-active" : "") +
        '" data-area="' +
        escapeHtml(area.id) +
        '" aria-pressed="' +
        (active ? "true" : "false") +
        '">' +
        escapeHtml(area.label) +
        "</button>";
    }
    var allActive = state.area === "all";
    html +=
      '<button type="button" class="area-tab' +
      (allActive ? " is-active" : "") +
      '" data-area="all" aria-pressed="' +
      (allActive ? "true" : "false") +
      '">All areas</button>';
    els.areaTabsMount.innerHTML = html;
    els.areaTabs = Array.prototype.slice.call(els.areaTabsMount.querySelectorAll(".area-tab"));
    els.areaTabs.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var next = btn.getAttribute("data-area") || "covent-garden";
        state.area = next === "all" ? "all" : normalizeAreaId(next);
        persistSelectedArea();
        renderAreaTabs();
        populateAddPlaceAreaFields();
        render();
      });
    });
  }

  function populateAddPlaceAreaFields() {
    var areaSelect = document.getElementById("add-area");
    var clusterSelect = document.getElementById("add-cluster");
    if (!areaSelect || !clusterSelect) return;

    var areaHtml = "";
    for (var i = 0; i < AREAS.length; i++) {
      var area = AREAS[i];
      var selected =
        (state.area !== "all" && state.area === area.id) ||
        (state.area === "all" && i === 0);
      areaHtml +=
        '<option value="' +
        escapeHtml(area.id) +
        '"' +
        (selected ? " selected" : "") +
        ">" +
        escapeHtml(area.label) +
        "</option>";
    }
    areaSelect.innerHTML = areaHtml;

    function fillClusters() {
      var areaId = normalizeAreaId(areaSelect.value);
      var opts = '<option value="added-nearby">Added nearby (default)</option>';
      for (var c = 0; c < CLUSTERS.length; c++) {
        var cluster = CLUSTERS[c];
        if (!cluster.area || cluster.area !== areaId) continue;
        if (cluster.id === "added-nearby") continue;
        opts +=
          '<option value="' +
          escapeHtml(cluster.id) +
          '">' +
          escapeHtml(cluster.label) +
          "</option>";
      }
      clusterSelect.innerHTML = opts;
    }

    areaSelect.onchange = fillClusters;
    fillClusters();
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
    els.areaTabsMount = document.getElementById("area-tabs");
    els.areaLocation = document.getElementById("area-location");
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
    loadSelectedArea();
    renderAreaTabs();
    populateAddPlaceAreaFields();
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
