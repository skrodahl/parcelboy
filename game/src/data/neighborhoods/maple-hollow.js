// Maple Hollow: generated and validated. Copy verbatim. x = column, z = row, (0,0) = north-west corner.
// §2.18: the exit road gaps (forest → road) are cut by tools/neighborhoods/maple-hollow-exits.cjs —
// the one allowed edit to §6.1's layout. Regenerate with that tool (it re-runs validation).
export default {
  "id": "maple-hollow",
  "name": "Maple Hollow",
  "tileSize": 4,
  "map": [
    "######################RR########################",
    "######################RR########################",
    "##ssssssssssssssssssssssssssssssssssssssssssss##",
    "##sRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRs##",
    "##sRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRs##",
    "##sRRssssssssssssssssssRRssssssssssssssssssRRs##",
    "##sRRs.ood.ood.ood.oodsRRs.XXXXXXXX.......sRRs##",
    "##sRRs.HHd.HHd.HHd.HHdsRRs.XXXXXXXX.PPPPP.sRRs##",
    "##sRRs.HHd.HHd.HHd.HHdsRRs.XXXXXXXX.PPPPP.sRRs##",
    "##sRRs.t.t..t.t.tt..t.sRRs.XXXXXXXX.PPPPP.sRRs##",
    "##sRRs.....t..tt..t...sRRs.XXXXXXXX.PPPPP.sRRs##",
    "##sRRs.ttt............sRRs...t..t.t.......sRRs##",
    "##sRRs................sRRs................sRRs##",
    "##sRRs.HHd.HHd.HHd.HHdsRRs.HHd.HHd.HHd.HHdsRRs##",
    "##sRRs.HHd.HHd.HHd.HHdsRRs.HHd.HHd.HHd.HHdsRRs##",
    "##sRRs.ood.ood.ood.oodsRRs.ood.ood.ood.oodsRRs##",
    "##sRRssssssssssssssssssRRssssssssssssssssssRRs##",
    "##sRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRs##",
    "##sRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRsRR",
    "##sRRssssssssssssssssssRRssssssssRRssssssssRRsRR",
    "##sRRs.ood.ood.ood.oodsRRsoo.HHosRRsoHH.oosRRs##",
    "##sRRs.HHd.HHd.HHd.HHdsRRsHH.HHosRRsoHH.HHsRRs##",
    "##sRRs.HHd.HHd.HHd.HHdsRRsHH....sRRs....HHsRRs##",
    "##sRRs......t.......t.sRRst.....sRRs......sRRs##",
    "RRsRRsttt.t...t.......sRRs....sssRRsss...tsRRs##",
    "RRsRRs...tt.....t.....sRRs....sRRRRRRs....sRRs##",
    "##sRRs................sRRs.HHosRRRRRRsoHH.sRRs##",
    "##sRRs.HHd.HHd.HHd.HHdsRRs.HHosRRRRRRsoHH.sRRs##",
    "##sRRs.HHd.HHd.HHd.HHdsRRs....sRRRRRRs....sRRs##",
    "##sRRs.ood.ood.ood.oodsRRst...ssssssss...tsRRs##",
    "##sRRssssssssssssssssssRRssssssssssssssssssRRs##",
    "##sRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRs##",
    "##sRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRs##",
    "##ssssssssssssssssssssssssssssssssssssssssssss##",
    "##PpppppppppppppppppppP..LLLLLLLLLLLLLLLLLLLLL##",
    "##PPPPPPWWWWWWPPPpPPPPP..LLLLLLLLLLLLLLLLLLLLL##",
    "##PtPPPPWWWWWWPtPpPPtPP...XXXXXXXXX.XXXXXXXLLL##",
    "##PPPtPPPPPPPPPPPpPPPtP...XXXXXXXXX.XXXXXXXLLL##",
    "################################################",
    "################################################"
  ],
  "roads": [
    {
      "name": "North Road",
      "axis": "x",
      "x0": 3,
      "x1": 44,
      "z": 3
    },
    {
      "name": "Maple Avenue",
      "axis": "x",
      "x0": 3,
      "x1": 44,
      "z": 17
    },
    {
      "name": "Creek Road",
      "axis": "x",
      "x0": 3,
      "x1": 44,
      "z": 31
    },
    {
      "name": "West Lane",
      "axis": "z",
      "z0": 3,
      "z1": 32,
      "x": 3
    },
    {
      "name": "Oak Street",
      "axis": "z",
      "z0": 3,
      "z1": 32,
      "x": 23
    },
    {
      "name": "East Drive",
      "axis": "z",
      "z0": 3,
      "z1": 32,
      "x": 43
    },
    {
      "name": "Willow Court",
      "axis": "z",
      "z0": 19,
      "z1": 24,
      "x": 33,
      "bulb": {
        "x": 31,
        "z": 25,
        "w": 6,
        "d": 4
      }
    }
  ],
  "houses": [
    {
      "id": "h01",
      "x": 7,
      "z": 7,
      "facing": "N",
      "street": "North Road",
      "num": 2
    },
    {
      "id": "h02",
      "x": 11,
      "z": 7,
      "facing": "N",
      "street": "North Road",
      "num": 4
    },
    {
      "id": "h03",
      "x": 15,
      "z": 7,
      "facing": "N",
      "street": "North Road",
      "num": 6
    },
    {
      "id": "h04",
      "x": 19,
      "z": 7,
      "facing": "N",
      "street": "North Road",
      "num": 8
    },
    {
      "id": "h05",
      "x": 7,
      "z": 13,
      "facing": "S",
      "street": "Maple Avenue",
      "num": 1
    },
    {
      "id": "h06",
      "x": 11,
      "z": 13,
      "facing": "S",
      "street": "Maple Avenue",
      "num": 3
    },
    {
      "id": "h07",
      "x": 15,
      "z": 13,
      "facing": "S",
      "street": "Maple Avenue",
      "num": 5
    },
    {
      "id": "h08",
      "x": 19,
      "z": 13,
      "facing": "S",
      "street": "Maple Avenue",
      "num": 7
    },
    {
      "id": "h09",
      "x": 27,
      "z": 13,
      "facing": "S",
      "street": "Maple Avenue",
      "num": 21
    },
    {
      "id": "h10",
      "x": 31,
      "z": 13,
      "facing": "S",
      "street": "Maple Avenue",
      "num": 23
    },
    {
      "id": "h11",
      "x": 35,
      "z": 13,
      "facing": "S",
      "street": "Maple Avenue",
      "num": 25
    },
    {
      "id": "h12",
      "x": 39,
      "z": 13,
      "facing": "S",
      "street": "Maple Avenue",
      "num": 27
    },
    {
      "id": "h13",
      "x": 7,
      "z": 21,
      "facing": "N",
      "street": "Maple Avenue",
      "num": 2
    },
    {
      "id": "h14",
      "x": 11,
      "z": 21,
      "facing": "N",
      "street": "Maple Avenue",
      "num": 4
    },
    {
      "id": "h15",
      "x": 15,
      "z": 21,
      "facing": "N",
      "street": "Maple Avenue",
      "num": 6
    },
    {
      "id": "h16",
      "x": 19,
      "z": 21,
      "facing": "N",
      "street": "Maple Avenue",
      "num": 8
    },
    {
      "id": "h17",
      "x": 7,
      "z": 27,
      "facing": "S",
      "street": "Creek Road",
      "num": 1
    },
    {
      "id": "h18",
      "x": 11,
      "z": 27,
      "facing": "S",
      "street": "Creek Road",
      "num": 3
    },
    {
      "id": "h19",
      "x": 15,
      "z": 27,
      "facing": "S",
      "street": "Creek Road",
      "num": 5
    },
    {
      "id": "h20",
      "x": 19,
      "z": 27,
      "facing": "S",
      "street": "Creek Road",
      "num": 7
    },
    {
      "id": "h21",
      "x": 26,
      "z": 21,
      "facing": "N",
      "street": "Maple Avenue",
      "num": 22
    },
    {
      "id": "h22",
      "x": 40,
      "z": 21,
      "facing": "N",
      "street": "Maple Avenue",
      "num": 30
    },
    {
      "id": "h23",
      "x": 29,
      "z": 20,
      "facing": "E",
      "street": "Willow Court",
      "num": 1
    },
    {
      "id": "h24",
      "x": 37,
      "z": 20,
      "facing": "W",
      "street": "Willow Court",
      "num": 2
    },
    {
      "id": "h25",
      "x": 27,
      "z": 26,
      "facing": "E",
      "street": "Willow Court",
      "num": 3
    },
    {
      "id": "h26",
      "x": 39,
      "z": 26,
      "facing": "W",
      "street": "Willow Court",
      "num": 4
    }
  ],
  "buildings": [
    {
      "id": "school",
      "kind": "school",
      "name": "Hollow Elementary",
      "x": 27,
      "z": 6,
      "w": 8,
      "d": 5,
      "facing": "N"
    },
    {
      "id": "bakery",
      "kind": "shop",
      "name": "Crumb & Co.",
      "x": 26,
      "z": 36,
      "w": 3,
      "d": 2,
      "facing": "N",
      "deliverable": true,
      "accent": "#ff8fab"
    },
    {
      "id": "hardware",
      "kind": "shop",
      "name": "Nuts & Bolts",
      "x": 29,
      "z": 36,
      "w": 3,
      "d": 2,
      "facing": "N",
      "deliverable": true,
      "accent": "#4cc9f0"
    },
    {
      "id": "icecream",
      "kind": "shop",
      "name": "Scoops",
      "x": 32,
      "z": 36,
      "w": 3,
      "d": 2,
      "facing": "N",
      "deliverable": true,
      "accent": "#ffd166"
    },
    {
      "id": "depot",
      "kind": "depot",
      "name": "Quickbox Distribution Center",
      "x": 36,
      "z": 36,
      "w": 7,
      "d": 2,
      "facing": "N"
    }
  ],
  "playground": {
    "x": 36,
    "z": 7,
    "w": 5,
    "d": 4
  },
  "pond": {
    "x": 8,
    "z": 35,
    "w": 6,
    "d": 2
  },
  "spawn": {
    "x": 39,
    "z": 34,
    "facing": "N"
  },
  "restockZone": {
    "x0": 37,
    "z0": 35,
    "x1": 41,
    "z1": 35
  },
  "parcelLockers": [
    [
      5,
      5
    ],
    [
      41,
      5
    ],
    [
      5,
      30
    ]
  ],
  "traffic": {
    "outer": [
      [
        4,
        4
      ],
      [
        43,
        4
      ],
      [
        43,
        31
      ],
      [
        4,
        31
      ]
    ],
    "east": [
      [
        24,
        18
      ],
      [
        43,
        18
      ],
      [
        43,
        31
      ],
      [
        24,
        31
      ]
    ],
    "west": [
      [
        23,
        17
      ],
      [
        4,
        17
      ],
      [
        4,
        4
      ],
      [
        23,
        4
      ]
    ]
  },
  "sidewalkLoops": {
    "A": {
      "x0": 5,
      "z0": 5,
      "x1": 22,
      "z1": 16
    },
    "B": {
      "x0": 25,
      "z0": 5,
      "x1": 42,
      "z1": 16
    },
    "C": {
      "x0": 5,
      "z0": 19,
      "x1": 22,
      "z1": 30
    },
    "D": {
      "x0": 25,
      "z0": 19,
      "x1": 42,
      "z1": 30
    }
  },
  "hazardSpots": {
    "dog": [
      [
        12,
        12
      ],
      [
        16,
        23
      ],
      [
        40,
        28
      ]
    ],
    "sprinkler": [
      [
        6,
        6
      ],
      [
        6,
        15
      ],
      [
        26,
        15
      ],
      [
        6,
        29
      ]
    ],
    "beehive": [
      [
        8,
        11
      ],
      [
        15,
        36
      ],
      [
        41,
        24
      ]
    ]
  },
  "missionMarkers": [
    {
      "id": "dispatch",
      "x": 41,
      "z": 34,
      "color": "#00b4a6",
      "icon": "parcel"
    },
    {
      "id": "locker",
      "x": 37,
      "z": 34,
      "color": "#8338ec",
      "icon": "shirt"
    },
    {
      "id": "bakery",
      "x": 27,
      "z": 35,
      "color": "#ff8fab",
      "icon": "cake"
    },
    {
      "id": "hardware",
      "x": 30,
      "z": 35,
      "color": "#fb8500",
      "icon": "wrench"
    }
  ],
  "goldenParcels": [
    [
      6,
      12
    ],
    [
      41,
      6
    ],
    [
      35,
      10
    ],
    [
      38,
      9
    ],
    [
      21,
      24
    ],
    [
      26,
      27
    ],
    [
      33,
      26
    ],
    [
      8,
      37
    ],
    [
      23,
      35
    ],
    [
      14,
      35
    ],
    [
      28,
      24
    ],
    [
      20,
      12
    ]
  ],
  "gagSpots": {
    "trampoline": [
      [
        14,
        11
      ],
      [
        38,
        12
      ],
      [
        12,
        24
      ]
    ]
  },
  "exits": [
    {
      "id": "north",
      "to": "cedar-heights",
      "name": "Cedar Heights",
      "edge": "N",
      "tiles": [
        [
          22,
          2
        ]
      ],
      "entry": "spawn",
      "unlockStars": 8
    },
    {
      "id": "east",
      "to": "lakeside",
      "name": "Lakeside",
      "edge": "E",
      "tiles": [
        [
          44,
          18
        ]
      ],
      "entry": "spawn",
      "unlockStars": 3
    },
    {
      "id": "west",
      "to": "old-town",
      "name": "Old Town",
      "edge": "W",
      "tiles": [
        [
          2,
          24
        ]
      ],
      "entry": "spawn",
      "unlockStars": 3
    }
  ],
  "kiosk": {
    "x": 41,
    "z": 34,
    "name": "Quickbox Kiosk"
  },
  "region": "Maple Hollow — the Quickbox courier suburb: a tidy grid of houses, Hollow Elementary, and the Distribution Center."
}
;
