import {
  checkReleaseState,
  formatReleaseIssues,
  resolveReleaseTag,
} from "./lib/release.ts";

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

const requireTag = process.argv.includes("--require-tag");
const tag = resolveReleaseTag({
  explicit: readArg("--tag"),
  requireTag,
  githubRef: process.env.GITHUB_REF,
  githubRefName: process.env.GITHUB_REF_NAME,
});

const result = checkReleaseState({ tag, requireTag });
if (result.issues.length > 0) {
  console.error("release:check failed:");
  console.error(formatReleaseIssues(result.issues));
  process.exitCode = 1;
} else {
  const tagNote = tag ? `; tag ${tag}` : "";
  console.log(`release:check ok (${result.packages.length} packages at ${result.version}${tagNote})`);
}
