export const FUSION_TEMPLATE_WEIGHT = 0.65;
export const FUSION_ML_WEIGHT = 0.35;

export const fuseRecognitionScores = (
  templateScore: number,
  mlScore: number,
  mlAvailable = true,
): number => {
  if (!mlAvailable || !Number.isFinite(mlScore)) return templateScore;
  return templateScore * FUSION_TEMPLATE_WEIGHT + mlScore * FUSION_ML_WEIGHT;
};

export const candidateTemplateSignature = (
  templateIds: readonly string[],
): string =>
  [...templateIds].sort().join("|");