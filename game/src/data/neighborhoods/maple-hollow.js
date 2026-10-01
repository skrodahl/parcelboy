// Maple Hollow: generated and validated. Copy verbatim. x = column, z = row, (0,0) = north-west corner.
export default {
  id: 'maple-hollow',
  name: 'Maple Hollow',
  tileSize: 4,
  map: [
    '################################################', // 0
    '################################################', // 1
    '##ssssssssssssssssssssssssssssssssssssssssssss##', // 2
    '##sRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRs##', // 3
    '##sRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRs##', // 4
    '##sRRssssssssssssssssssRRssssssssssssssssssRRs##', // 5
    '##sRRs.ood.ood.ood.oodsRRs.XXXXXXXX.......sRRs##', // 6
    '##sRRs.HHd.HHd.HHd.HHdsRRs.XXXXXXXX.PPPPP.sRRs##', // 7
    '##sRRs.HHd.HHd.HHd.HHdsRRs.XXXXXXXX.PPPPP.sRRs##', // 8
    '##sRRs.t.t..t.t.tt..t.sRRs.XXXXXXXX.PPPPP.sRRs##', // 9
    '##sRRs.....t..tt..t...sRRs.XXXXXXXX.PPPPP.sRRs##', // 10
    '##sRRs.ttt............sRRs...t..t.t.......sRRs##', // 11
    '##sRRs................sRRs................sRRs##', // 12
    '##sRRs.HHd.HHd.HHd.HHdsRRs.HHd.HHd.HHd.HHdsRRs##', // 13
    '##sRRs.HHd.HHd.HHd.HHdsRRs.HHd.HHd.HHd.HHdsRRs##', // 14
    '##sRRs.ood.ood.ood.oodsRRs.ood.ood.ood.oodsRRs##', // 15
    '##sRRssssssssssssssssssRRssssssssssssssssssRRs##', // 16
    '##sRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRs##', // 17
    '##sRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRs##', // 18
    '##sRRssssssssssssssssssRRssssssssRRssssssssRRs##', // 19
    '##sRRs.ood.ood.ood.oodsRRsoo.HHosRRsoHH.oosRRs##', // 20
    '##sRRs.HHd.HHd.HHd.HHdsRRsHH.HHosRRsoHH.HHsRRs##', // 21
    '##sRRs.HHd.HHd.HHd.HHdsRRsHH....sRRs....HHsRRs##', // 22
    '##sRRs......t.......t.sRRst.....sRRs......sRRs##', // 23
    '##sRRsttt.t...t.......sRRs....sssRRsss...tsRRs##', // 24
    '##sRRs...tt.....t.....sRRs....sRRRRRRs....sRRs##', // 25
    '##sRRs................sRRs.HHosRRRRRRsoHH.sRRs##', // 26
    '##sRRs.HHd.HHd.HHd.HHdsRRs.HHosRRRRRRsoHH.sRRs##', // 27
    '##sRRs.HHd.HHd.HHd.HHdsRRs....sRRRRRRs....sRRs##', // 28
    '##sRRs.ood.ood.ood.oodsRRst...ssssssss...tsRRs##', // 29
    '##sRRssssssssssssssssssRRssssssssssssssssssRRs##', // 30
    '##sRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRs##', // 31
    '##sRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRs##', // 32
    '##ssssssssssssssssssssssssssssssssssssssssssss##', // 33
    '##PpppppppppppppppppppP..LLLLLLLLLLLLLLLLLLLLL##', // 34
    '##PPPPPPWWWWWWPPPpPPPPP..LLLLLLLLLLLLLLLLLLLLL##', // 35
    '##PtPPPPWWWWWWPtPpPPtPP...XXXXXXXXX.XXXXXXXLLL##', // 36
    '##PPPtPPPPPPPPPPPpPPPtP...XXXXXXXXX.XXXXXXXLLL##', // 37
    '################################################', // 38
    '################################################', // 39
  ],
  roads: [
    { name: 'North Road',   axis: 'x', x0: 3,  x1: 44, z: 3 },  // occupies rows z and z+1
    { name: 'Maple Avenue', axis: 'x', x0: 3,  x1: 44, z: 17 },
    { name: 'Creek Road',   axis: 'x', x0: 3,  x1: 44, z: 31 },
    { name: 'West Lane',    axis: 'z', z0: 3,  z1: 32, x: 3 },  // occupies cols x and x+1
    { name: 'Oak Street',   axis: 'z', z0: 3,  z1: 32, x: 23 },
    { name: 'East Drive',   axis: 'z', z0: 3,  z1: 32, x: 43 },
    { name: 'Willow Court', axis: 'z', z0: 19, z1: 24, x: 33, bulb: { x: 31, z: 25, w: 6, d: 4 } },
  ],
  // footprint is 2x2 tiles with top-left (x,z); facing = side the front door is on
  houses: [
    { id: 'h01', x: 7, z: 7, facing: 'N', street: 'North Road', num: 2 },
    { id: 'h02', x: 11, z: 7, facing: 'N', street: 'North Road', num: 4 },
    { id: 'h03', x: 15, z: 7, facing: 'N', street: 'North Road', num: 6 },
    { id: 'h04', x: 19, z: 7, facing: 'N', street: 'North Road', num: 8 },
    { id: 'h05', x: 7, z: 13, facing: 'S', street: 'Maple Avenue', num: 1 },
    { id: 'h06', x: 11, z: 13, facing: 'S', street: 'Maple Avenue', num: 3 },
    { id: 'h07', x: 15, z: 13, facing: 'S', street: 'Maple Avenue', num: 5 },
    { id: 'h08', x: 19, z: 13, facing: 'S', street: 'Maple Avenue', num: 7 },
    { id: 'h09', x: 27, z: 13, facing: 'S', street: 'Maple Avenue', num: 21 },
    { id: 'h10', x: 31, z: 13, facing: 'S', street: 'Maple Avenue', num: 23 },
    { id: 'h11', x: 35, z: 13, facing: 'S', street: 'Maple Avenue', num: 25 },
    { id: 'h12', x: 39, z: 13, facing: 'S', street: 'Maple Avenue', num: 27 },
    { id: 'h13', x: 7, z: 21, facing: 'N', street: 'Maple Avenue', num: 2 },
    { id: 'h14', x: 11, z: 21, facing: 'N', street: 'Maple Avenue', num: 4 },
    { id: 'h15', x: 15, z: 21, facing: 'N', street: 'Maple Avenue', num: 6 },
    { id: 'h16', x: 19, z: 21, facing: 'N', street: 'Maple Avenue', num: 8 },
    { id: 'h17', x: 7, z: 27, facing: 'S', street: 'Creek Road', num: 1 },
    { id: 'h18', x: 11, z: 27, facing: 'S', street: 'Creek Road', num: 3 },
    { id: 'h19', x: 15, z: 27, facing: 'S', street: 'Creek Road', num: 5 },
    { id: 'h20', x: 19, z: 27, facing: 'S', street: 'Creek Road', num: 7 },
    { id: 'h21', x: 26, z: 21, facing: 'N', street: 'Maple Avenue', num: 22 },
    { id: 'h22', x: 40, z: 21, facing: 'N', street: 'Maple Avenue', num: 30 },
    { id: 'h23', x: 29, z: 20, facing: 'E', street: 'Willow Court', num: 1 },
    { id: 'h24', x: 37, z: 20, facing: 'W', street: 'Willow Court', num: 2 },
    { id: 'h25', x: 27, z: 26, facing: 'E', street: 'Willow Court', num: 3 },
    { id: 'h26', x: 39, z: 26, facing: 'W', street: 'Willow Court', num: 4 },
  ],
  buildings: [
    { id: 'school',    kind: 'school', name: 'Hollow Elementary',  x: 27, z: 6,  w: 8, d: 5, facing: 'N' },
    { id: 'bakery',    kind: 'shop',   name: 'Crumb & Co.',        x: 26, z: 36, w: 3, d: 2, facing: 'N', deliverable: true, accent: '#ff8fab' },
    { id: 'hardware',  kind: 'shop',   name: 'Nuts & Bolts',       x: 29, z: 36, w: 3, d: 2, facing: 'N', deliverable: true, accent: '#4cc9f0' },
    { id: 'icecream',  kind: 'shop',   name: 'Scoops',             x: 32, z: 36, w: 3, d: 2, facing: 'N', deliverable: true, accent: '#ffd166' },
    { id: 'depot',     kind: 'depot',  name: 'Quickbox Distribution Center', x: 36, z: 36, w: 7, d: 2, facing: 'N' },
  ],
  playground: { x: 36, z: 7, w: 5, d: 4 },
  pond: { x: 8, z: 35, w: 6, d: 2 },
  spawn: { x: 39, z: 34, facing: 'N' },
  restockZone: { x0: 37, z0: 35, x1: 41, z1: 35 },   // inclusive tile rect in front of the depot
  // §2.17: parcel lockers on sidewalks (2–4, away from the depot + pickup).
  parcelLockers: [[5, 5], [41, 5], [5, 30]],
  // Closed loops of tile waypoints, right-hand traffic, cars drive tile centers between them.
  traffic: {
    outer: [[4, 4], [43, 4], [43, 31], [4, 31]],
    east:  [[24, 18], [43, 18], [43, 31], [24, 31]],
    west:  [[23, 17], [4, 17], [4, 4], [23, 4]],
  },
  // Sidewalk rectangles (inclusive tile rects); walkers and skaters follow their perimeter.
  sidewalkLoops: {
    A: { x0: 5,  z0: 5,  x1: 22, z1: 16 },
    B: { x0: 25, z0: 5,  x1: 42, z1: 16 },
    C: { x0: 5,  z0: 19, x1: 22, z1: 30 },
    D: { x0: 25, z0: 19, x1: 42, z1: 30 },
  },
  hazardSpots: {
    dog:       [[12, 12], [16, 23], [40, 28]],
    sprinkler: [[6, 6], [6, 15], [26, 15], [6, 29]],
    beehive:   [[8, 11], [15, 36], [41, 24]],   // these are 't' tiles: the hive hangs from that tree
  },
  // Mission and locker markers (tile centers). `giver` ids referenced by shifts.
  missionMarkers: [
    { id: 'dispatch', x: 41, z: 34, color: '#00b4a6', icon: 'parcel' },
    { id: 'locker',   x: 37, z: 34, color: '#8338ec', icon: 'shirt' },
    { id: 'bakery',   x: 27, z: 35, color: '#ff8fab', icon: 'cake' },
    { id: 'hardware', x: 30, z: 35, color: '#fb8500', icon: 'wrench' },
  ],
  // Pickup zones for side missions = the shop's front row; the depot uses restockZone.
  // Hidden collectibles (walkable tiles, validated). Not shown on the radar.
  goldenParcels: [[6, 12], [41, 6], [35, 10], [38, 9], [21, 24], [26, 27], [33, 26], [8, 37], [23, 35], [14, 35], [28, 24], [20, 12]],
  gagSpots: {
    trampoline: [[14, 11], [38, 12], [12, 24]], // '.' back-yard tiles; trampoline radius 1.6 units, not solid
  },
};
