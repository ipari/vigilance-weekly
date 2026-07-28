export type RunCheckpoint = {
  completedSteps: number;
  lastActivityAt: string | null;
  literatureResults: string;
  regulatoryResults: string;
};

export function shouldRestartLegacyRun(checkpoint: RunCheckpoint) {
  return (
    checkpoint.completedSteps > 0 &&
    checkpoint.lastActivityAt === null &&
    checkpoint.literatureResults === "[]" &&
    checkpoint.regulatoryResults === "[]"
  );
}
