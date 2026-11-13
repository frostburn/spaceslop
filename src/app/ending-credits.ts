import markup from './ending-credits.html?raw';
import './ending-credits.css';

export const CREDITS_ROLL_DURATION = 20;

export function mountEndingCredits(parent: HTMLElement) {
  parent.insertAdjacentHTML('beforeend', markup);
  const credits = parent.querySelector<HTMLElement>('#ending-credits')!;
  credits.style.setProperty('--credits-duration', `${CREDITS_ROLL_DURATION}s`);
  return credits;
}
