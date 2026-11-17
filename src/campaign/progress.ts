import type { LevelId } from '../levels';
import { campaign, missionFor } from './missions';
import type { Rank } from './ranks';

export const CAMPAIGN_SAVE_KEY = 'spaceslop.campaign-clears';

export function campaignClearIds(ids: unknown): LevelId[] {
  return Array.isArray(ids)
    ? ids.filter((id): id is LevelId => typeof id === 'string' && Object.hasOwn(missionFor, id)) : [];
}

export function decodeCampaignClears(value: string | null): Set<LevelId> {
  try {
    return new Set(campaignClearIds(JSON.parse(value ?? 'null')));
  } catch { /* An invalid save starts at the first mission. */ }
  return new Set();
}

export function campaignStatus(cleared: ReadonlySet<LevelId>) {
  const next = campaign.find(mission => !cleared.has(mission.level));
  const rank: Rank = next?.pilotRank ?? 'major';
  return { next: next?.level, rank };
}

export function recordCampaignClear(cleared: ReadonlySet<LevelId>, level: LevelId) {
  const before = campaignStatus(cleared);
  const updated = new Set(cleared);
  if (level === before.next) updated.add(level);
  const after = campaignStatus(updated);
  return {
    cleared: updated,
    next: after.next,
    promoted: after.rank === before.rank ? undefined : after.rank,
    unlockedBulletHell: before.next !== undefined && after.next === undefined,
  };
}
