import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({
  root: new URL('..', import.meta.url).pathname, configFile: false,
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, entries: [] }, appType: 'custom',
});
after(() => server.close());
const { levels } = await server.ssrLoadModule('/src/levels.ts');
const { campaign, missionFor, officers } = await server.ssrLoadModule('/src/campaign/missions.ts');
const { decodeCampaignClears, campaignStatus, recordCampaignClear } = await server.ssrLoadModule('/src/campaign/progress.ts');
const { ranks, rankAtlasOrder, rankAtlasCell, RANK_ATLAS_ROWS, RANK_ATLAS_COLUMNS } = await server.ssrLoadModule('/src/campaign/ranks.ts');
const { levelBriefingFiles, rankInsigniaFile } = await server.ssrLoadModule('/src/assets/catalog.ts');

test('the briefing route visits each sector once and takes Io, Europa and Titan in order', () => {
  const route = campaign.map(mission => mission.level);
  assert.deepEqual(route.toSorted(), Object.keys(levels).toSorted());
  assert.deepEqual(route.slice(0, 5), ['broodlock', 'io', 'vents', 'titan', 'heliostat']);
  assert.equal(route.at(-1), 'wormhole');
  assert.equal(levels.vents.name, 'Hadal Cable · Europa');
  for (const mission of campaign) {
    assert.equal(missionFor[mission.level], mission);
    assert(mission.brief.length && mission.objective.length);
    assert(Object.hasOwn(officers, mission.officer));
    assert(Object.hasOwn(ranks, mission.pilotRank));
    assert(Object.hasOwn(ranks, officers[mission.officer].rank));
    assert.deepEqual(levelBriefingFiles(mission.level), [`officers/${mission.officer}.png`, rankInsigniaFile]);
  }
});

test('campaign clears advance in order and promote at the agreed milestones', () => {
  let cleared = decodeCampaignClears('not JSON');
  assert.deepEqual(campaignStatus(cleared), { next: 'broodlock', rank: 'specialist4' });
  assert.equal(recordCampaignClear(cleared, 'wormhole').cleared.size, 0);
  const promotions = [];
  for (const mission of campaign) {
    assert.equal(campaignStatus(cleared).next, mission.level);
    const report = recordCampaignClear(cleared, mission.level);
    assert(report.cleared.has(mission.level));
    assert.equal(report.cleared.size, cleared.size + 1);
    cleared = decodeCampaignClears(JSON.stringify([...report.cleared, 'unknown-sector', 4, mission.level]));
    if (report.promoted) promotions.push([mission.level, report.promoted]);
    assert.equal(recordCampaignClear(cleared, mission.level).promoted, undefined);
  }
  assert.deepEqual(promotions, [
    ['titan', 'sergeant'], ['heliostat', 'secondLt'], ['preserve', 'firstLt'],
    ['fleet', 'captain'], ['wormhole', 'major'],
  ]);
  assert.deepEqual(campaignStatus(cleared), { next: undefined, rank: 'major' });
  assert.equal(cleared.size, campaign.length);
});

test('all campaign and briefing ranks fit in distinct atlas cells', () => {
  const used = new Set([...campaign.map(mission => mission.pilotRank), ...Object.values(officers).map(officer => officer.rank), 'major']);
  assert.deepEqual(new Set(rankAtlasOrder), used);
  const cells = rankAtlasOrder.map(rankAtlasCell);
  assert(cells.every(({ row, column }) => row < RANK_ATLAS_ROWS && column < RANK_ATLAS_COLUMNS));
  assert.equal(new Set(cells.map(({ row, column }) => `${row},${column}`)).size, cells.length);
});
