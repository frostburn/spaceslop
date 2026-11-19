import type { LevelId } from '../levels';
import { campaign } from './missions';
import { campaignClearIds, campaignStatus } from './progress';

export const CHALLENGE_SAVE_KEY = 'spaceslop.challenge-progress';
export const challengeModes = ['bullet-hell', 'hardcore'] as const;
export type ChallengeMode = typeof challengeModes[number];
export type FlightMode = 'regular' | ChallengeMode;

const route = campaign.map(mission => mission.level);
export const challengeRoutes: Record<ChallengeMode, readonly LevelId[]> = { 'bullet-hell': route, hardcore: route };

export const challengeNames = {
  'bullet-hell': 'Bullet Hell',
  hardcore: 'Bullet Hell Hardcore',
} satisfies Record<ChallengeMode, string>;

export function readChallengeCode(value: string) {
  const code = value.trim().toLowerCase();
  return challengeModes.find(mode => challengeNames[mode].toLowerCase() === code);
}

type ChallengeProgress = {
  unlocked: ChallengeMode[];
  cleared: Record<ChallengeMode, LevelId[]>;
  hardcoreBest: number;
};

export function hardcoreClearedCount(progress: ChallengeProgress) {
  const next = route.findIndex(level => !progress.cleared.hardcore.includes(level));
  return next < 0 ? route.length : next;
}

export function decodeChallengeProgress(value: string | null): ChallengeProgress {
  const progress: ChallengeProgress = {
    unlocked: [], cleared: { 'bullet-hell': [], hardcore: [] }, hardcoreBest: 0,
  };
  try {
    const save = JSON.parse(value ?? 'null') as {
      unlocked?: unknown;
      cleared?: Partial<Record<ChallengeMode, unknown>>;
      hardcoreBest?: unknown;
    } | null;
    const unlocked = save?.unlocked;
    progress.unlocked = Array.isArray(unlocked) ? challengeModes.filter(mode => unlocked.includes(mode)) : [];
    for (const mode of challengeModes) progress.cleared[mode] = [...new Set(campaignClearIds(save?.cleared?.[mode]))];
    const best = save?.hardcoreBest;
    const validBest = typeof best === 'number' && Number.isInteger(best) && best >= 0 && best <= route.length;
    progress.hardcoreBest = Math.max(validBest ? best : 0, hardcoreClearedCount(progress));
  } catch { /* An unreadable save starts with empty progress. */ }
  return progress;
}

export function unlockChallenge(progress: ChallengeProgress, mode: ChallengeMode) {
  if (progress.unlocked.includes(mode)) return false;
  progress.unlocked.push(mode);
  return true;
}

export function challengeAvailable(progress: ChallengeProgress, mode: ChallengeMode, campaignClears: ReadonlySet<LevelId>) {
  return progress.unlocked.includes(mode) || (mode === 'bullet-hell' && campaignStatus(campaignClears).next === undefined);
}

export function nextChallengeLevel(progress: ChallengeProgress, mode: ChallengeMode) {
  return challengeRoutes[mode].find(level => !progress.cleared[mode].includes(level));
}

export function selectableChallengeLevel(progress: ChallengeProgress, mode: ChallengeMode, level: LevelId) {
  return progress.cleared[mode].includes(level) ? level : nextChallengeLevel(progress, mode) ?? challengeRoutes[mode].at(-1)!;
}

export function recordChallengeClear(progress: ChallengeProgress, mode: ChallengeMode, level: LevelId) {
  const frontier = nextChallengeLevel(progress, mode);
  const cleared = progress.cleared[mode];
  if (level === frontier) {
    cleared.push(level);
    if (mode === 'hardcore') progress.hardcoreBest = Math.max(progress.hardcoreBest, hardcoreClearedCount(progress));
  }
  const next = nextChallengeLevel(progress, mode);
  return { next, unlockedHardcore: mode === 'bullet-hell' && level === frontier && next === undefined && unlockChallenge(progress, 'hardcore') };
}

export function resetHardcoreProgress(progress: ChallengeProgress) {
  progress.cleared.hardcore = [];
}
