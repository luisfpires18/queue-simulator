// Past this many declines for the same group, an applicant can no longer
// re-apply - everyone gets a second chance, not unlimited chances. Shared
// between the data layer (server-side enforcement) and client components
// (UI messaging), so it can't live in src/data/source.ts (that pulls in
// Prisma, which can't bundle into the browser).
export const MAX_APPLICATION_DECLINES = 2;
