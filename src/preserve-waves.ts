// Small four-winged flocks alternate with the larger diving raptors. Mixed
// waves assign the raptor slot first; every other member is a Microraptor.
export const preserveWaves = [
  {time:2,lanes:[-2.3,0,2.3],flyer:{formation:'chevron',mirror:1},drop:'homing'},
  {time:8,lanes:[-2.1,2.1],flyer:{formation:'crossing',mirror:1},drop:'cannon'},
  {time:14,lanes:[-2,2],raptor:0,flyer:{formation:'swoop',mirror:-1},drop:'homing'},
  {time:19,lanes:[0],raptor:0,drop:'homing'},
  {time:24,lanes:[-2.5,2.5],raptor:0,flyer:{formation:'crossing',mirror:-1},drop:'laser'},
  {time:29,lanes:[0,0,0],flyer:{formation:'slalom',mirror:1},drop:'omega'},
  {time:35,lanes:[-1.6,1.6],raptor:0,flyer:{formation:'swoop',mirror:1},drop:'cannon'},
  {time:40,lanes:[2.3],raptor:0,drop:'laser'},
  {time:45,lanes:[0,0,0,0],flyer:{formation:'loop',mirror:1},drop:'omega'},
  {time:51,lanes:[-2.5,2],raptor:1,flyer:{formation:'swoop',mirror:-1}},
  {time:56,lanes:[-1.3,1.3],raptor:0,flyer:{formation:'slalom',mirror:-1},drop:'homing'},
  {time:62,lanes:[-2.3,0,2.3],raptor:1,flyer:{formation:'crossing',mirror:-1},drop:'cannon'},
  {time:67,lanes:[-2.3,0,2.3],flyer:{formation:'chevron',mirror:-1},drop:'laser'},
  {time:72,lanes:[-2.2,-.65,.65,2.2],raptor:3,flyer:{formation:'swoop',mirror:1},drop:'omega'},
  {time:78,lanes:[-2.2,1.65],raptor:0,flyer:{formation:'crossing',mirror:-1}},
  {time:83,lanes:[0,0,0,0],flyer:{formation:'loop',mirror:-1},drop:'homing'},
  {time:88,lanes:[1.8],raptor:0,drop:'laser'},
  {time:93,lanes:[-2.4,-.7,.75,2.4],raptor:0,flyer:{formation:'swoop',mirror:1},drop:'omega'},
] as const;
