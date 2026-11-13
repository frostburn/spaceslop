import type { LevelId } from '../levels';
import { campaignClearIds, campaignStatus } from './progress';

export const CHALLENGE_LEVEL = 'broodlock' satisfies LevelId;
export const CHALLENGE_SAVE_KEY = 'spaceslop.challenge-progress';
export const challengeModes = ['bullet-hell', 'hardcore'] as const;
export type ChallengeMode = typeof challengeModes[number];
export type FlightMode = 'regular' | ChallengeMode;

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
};

export function decodeChallengeProgress(value: string | null): ChallengeProgress {
  try {
    const save = JSON.parse(value ?? 'null') as {
      unlocked?: unknown;
      cleared?: Partial<Record<ChallengeMode, unknown>>;
    } | null;
    const unlocked = save?.unlocked;
    return {
      unlocked: Array.isArray(unlocked) ? challengeModes.filter(mode => unlocked.includes(mode)) : [],
      cleared: {
        'bullet-hell': [...new Set(campaignClearIds(save?.cleared?.['bullet-hell']))],
        hardcore: [...new Set(campaignClearIds(save?.cleared?.hardcore))],
      },
    };
  } catch {
    return { unlocked: [], cleared: { 'bullet-hell': [], hardcore: [] } };
  }
}

export function unlockChallenge(progress: ChallengeProgress, mode: ChallengeMode) {
  if (progress.unlocked.includes(mode)) return false;
  progress.unlocked.push(mode);
  return true;
}

export function challengeAvailable(progress: ChallengeProgress, mode: ChallengeMode, campaignClears: ReadonlySet<LevelId>) {
  return progress.unlocked.includes(mode) || (mode === 'bullet-hell' && campaignStatus(campaignClears).next === undefined);
}

export function recordChallengeClear(progress: ChallengeProgress, mode: ChallengeMode) {
  const cleared = progress.cleared[mode];
  if (!cleared.includes(CHALLENGE_LEVEL)) cleared.push(CHALLENGE_LEVEL);
  // Broodlock is the full challenge route until later missions are added.
  return mode === 'bullet-hell' && unlockChallenge(progress, 'hardcore');
}

export function resetHardcoreProgress(progress: ChallengeProgress) {
  progress.cleared.hardcore = [];
}
