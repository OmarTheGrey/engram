// Where a recording may write its cassettes (card B3 review R5-4; moved here
// from packages/runner/src/live.ts by card B10's review fix, B10-8, so the
// runner's live mode and the cassette proxy apply one guard). A recording
// never writes a committed cassette or a committed folder: its directory is
// under the repository's `.engram/` (which .gitignore keeps out of the
// repository) or outside the repository, and it never overlaps `fixtures/`
// or another committed cassette directory. Scripted cassettes under
// `fixtures/` are recorded only by `make fixtures`.
import { isAbsolute, join, relative, resolve } from "node:path";

/** `child` is `parent` or inside it. */
export const within = (parent: string, child: string) => {
  const rel = relative(resolve(parent), resolve(child));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
};

export interface RecordingPlace {
  /** The repository root: only its `.engram/` folder may be written. */
  repo: string;
  /** Committed cassette directories besides `fixtures/` (a config's own cassettes). */
  committed?: readonly string[];
}

/**
 * Why a recording into `dir` is refused, or undefined when it may record
 * there: `dir` overlaps `<repo>/fixtures` or a committed directory, or lies
 * inside the repository but not under `<repo>/.engram/`.
 */
export function recordingRefusal(dir: string, place: RecordingPlace): string | undefined {
  const cassettes = resolve(dir);
  for (const committed of [join(place.repo, "fixtures"), ...(place.committed ?? [])]) {
    if (within(committed, cassettes) || within(cassettes, committed)) {
      return `cassette directory ${cassettes} overlaps the committed cassettes at ${resolve(committed)}`;
    }
  }
  const scratch = join(place.repo, ".engram");
  if (
    within(place.repo, cassettes) &&
    !(within(scratch, cassettes) && cassettes !== resolve(scratch))
  ) {
    return `cassette directory ${cassettes} is inside the repository but not under ${resolve(scratch)}; live cassettes go under .engram/ or outside the repository`;
  }
  return undefined;
}
