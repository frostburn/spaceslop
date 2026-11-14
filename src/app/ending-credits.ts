import markup from './ending-credits.html?raw';
import '../spaceslop-logo.css';
import './ending-credits.css';

export const CREDITS_ROLL_DURATION = 20;
export const endingMessages = {
  regular: 'Bullet Hell mode unlocked',
  'bullet-hell': 'Bullet Hell Hardcore mode unlocked',
  hardcore: 'Thank you for playing!',
} as const;

export function endingMessage(mode: keyof typeof endingMessages, completedChallenge: boolean, unlockedBulletHell: boolean) {
  if (mode === 'hardcore') return endingMessages.hardcore;
  if (mode === 'bullet-hell' && completedChallenge) return endingMessages['bullet-hell'];
  if (mode === 'regular' && unlockedBulletHell) return endingMessages.regular;
}

export function mountEndingCredits(parent: HTMLElement) {
  parent.insertAdjacentHTML('beforeend', markup);
  const credits = parent.querySelector<HTMLElement>('#ending-credits')!;
  credits.style.setProperty('--credits-duration', `${CREDITS_ROLL_DURATION}s`);
  return credits;
}
