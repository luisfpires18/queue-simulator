// Next.js loads .env itself and sets cwd to the project root, so this just
// gives the wcl-analysis modules a stable root for cache/ and debug/ dirs —
// no .env parsing needed here (unlike the original standalone Express app).
export const PROJECT_ROOT = process.cwd();
