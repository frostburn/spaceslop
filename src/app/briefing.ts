import { officerPortraitFile, rankInsigniaFile } from '../assets/catalog';
import { drawRankInsignia } from '../campaign/insignia';
import { missionFor, officers } from '../campaign/missions';
import { rankAtlasCell, ranks, RANK_ATLAS_CELL, RANK_ATLAS_COLUMNS, RANK_ATLAS_ROWS, type Rank } from '../campaign/ranks';
import type { LevelId } from '../levels';
import { createPortrait } from '../pilots';

declare const __BRIEFING_URLS__: Partial<Record<string, string>>;

function briefingUrl(path: string) {
  const versioned = __BRIEFING_URLS__[path];
  return versioned ? import.meta.env.BASE_URL + versioned : undefined;
}

export function createRankDisplays(signal: AbortSignal) {
  const badges = new Map<HTMLCanvasElement, Rank>();
  let atlas: HTMLImageElement | undefined;
  let atlasCellSize = 0;
  function draw(canvas: HTMLCanvasElement, rank: Rank) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = canvas.width;
    ctx.clearRect(0, 0, size, size);
    const cell = rankAtlasCell(rank);
    if (atlas && atlasCellSize && cell) {
      const { column, row } = cell;
      ctx.drawImage(atlas, column * atlasCellSize, row * atlasCellSize, atlasCellSize, atlasCellSize, 0, 0, size, size);
    } else drawRankInsignia(ctx, rank);
  }

  const url = briefingUrl(rankInsigniaFile);
  if (url) {
    const image = new Image();
    image.addEventListener('load', () => {
      const cell = image.naturalWidth / RANK_ATLAS_COLUMNS;
      if (!Number.isInteger(cell) || cell < 8 || image.naturalHeight !== cell * RANK_ATLAS_ROWS) return;
      atlas = image;
      atlasCellSize = cell;
      for (const [canvas, rank] of badges) draw(canvas, rank);
    }, { once: true, signal });
    signal.addEventListener('abort', () => image.removeAttribute('src'), { once: true });
    image.src = url;
  }

  return (slot: HTMLElement, compact = false) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = RANK_ATLAS_CELL;
    canvas.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    slot.replaceChildren(canvas, label);
    return (rank: Rank) => {
      if (badges.get(canvas) === rank) return;
      badges.set(canvas, rank);
      label.textContent = compact ? ranks[rank].short : ranks[rank].name;
      slot.title = ranks[rank].name;
      draw(canvas, rank);
    };
  };
}

export function setupBriefing(level: LevelId, brief: HTMLElement, signal: AbortSignal) {
  const mission = missionFor[level], officer = officers[mission.officer];
  const rankDisplay = createRankDisplays(signal);
  const initials = officer.name.split(' ').map(name => name[0]).join('');
  brief.querySelector('.brief-portrait')!.replaceChildren(createPortrait(initials, '#a9d8e8', briefingUrl(officerPortraitFile(mission.officer)), signal));
  brief.querySelector('.officer-name')!.textContent = officer.name;
  brief.querySelector('.brief-quote')!.textContent = mission.brief;
  brief.querySelector('.brief-objective p')!.textContent = mission.objective;
  rankDisplay(brief.querySelector<HTMLElement>('.officer-rank')!)(officer.rank);
  rankDisplay(brief.querySelector<HTMLElement>('#brief-pilot-rank')!)(mission.pilotRank);
}
