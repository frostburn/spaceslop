export const fonsVariants = ['normal', 'rex', 'invictus'] as const;
export type FonsVariant = typeof fonsVariants[number];

export const fonsNames: Record<FonsVariant, string> = {
  normal: 'Fons Inversus',
  rex: 'Fons Inversus Rex',
  invictus: 'Fons Inversus Invictus',
};
