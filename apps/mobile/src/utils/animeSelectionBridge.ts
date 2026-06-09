// Simple bridge to pass anime selection data back from the selector screen
// This avoids navigation stack issues when passing data back

let pendingAnimeSelection: string[] | null = null;

export const setPendingAnimeSelection = (animes: string[]) => {
  pendingAnimeSelection = animes;
};

export const consumePendingAnimeSelection = (): string[] | null => {
  const selection = pendingAnimeSelection;
  pendingAnimeSelection = null;
  return selection;
};
