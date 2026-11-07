// Mixed security craft and feathered patrols, with short quiet stretches at
// habitat changes and a clear last approach to the nest. At most three raptors.
export const preserveWaves = [
  {time:2,lanes:[-2.5,0,2.5],carrier:1,drop:'homing'},
  {time:8,lanes:[-1.8,1.8],carrier:1,drop:'cannon'},
  {time:14,lanes:[-2,2],raptor:0,carrier:1,drop:'laser'},
  {time:19,lanes:[0],raptor:0,carrier:0,drop:'omega'},
  {time:24,lanes:[-2.5,2.5],raptor:0},
  {time:29,lanes:[-2,0,2],carrier:0,drop:'homing'},
  {time:35,lanes:[-1.6,1.6],raptor:0,carrier:1,drop:'cannon'},
  {time:40,lanes:[2.3],raptor:0,carrier:0,drop:'laser'},
  {time:45,lanes:[-2.4,0,2.4],carrier:2,drop:'omega'},
  {time:51,lanes:[-2.5,2],raptor:1},
  {time:56,lanes:[-1.3,1.3],raptor:0,carrier:1,drop:'homing'},
  {time:62,lanes:[0],raptor:0,carrier:0,drop:'cannon'},
  {time:67,lanes:[-2.7,0,2.7],carrier:1,drop:'laser'},
  {time:72,lanes:[-2,2],raptor:1,carrier:0,drop:'omega'},
  {time:78,lanes:[-2.2],raptor:0},
  {time:83,lanes:[-2.3,0,2.3],carrier:0,drop:'homing'},
  {time:88,lanes:[1.8],raptor:0,carrier:0,drop:'laser'},
  {time:93,lanes:[-2.4,2.4],raptor:0,carrier:1,drop:'omega'},
] as const;
