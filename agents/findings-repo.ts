/**
 * Findings Repository — Git-committed science discoveries
 *
 * High-confidence agent findings (confidence ≥ 0.75) are committed
 * to a local git repo at workspace/findings/. Each domain gets its
 * own markdown file. Commits include the agent name, EigenDA commitment
 * (when available), and confidence score.
 *
 * Optional: set FINDINGS_REPO_REMOTE in .env to auto-push after each commit.
 */

import fs from "fs";
import path from "path";
import simpleGit, { SimpleGit } from "simple-git";

const FINDINGS_DIR = path.join(process.cwd(), "workspace", "findings");
const MIN_CONFIDENCE = 0.75;

let git: SimpleGit | null = null;
let initialized = false;

// ── Setup ──

export async function initFindingsRepo(): Promise<void> {
  if (initialized) return;

  if (!fs.existsSync(FINDINGS_DIR)) {
    fs.mkdirSync(FINDINGS_DIR, { recursive: true });
  }

  git = simpleGit(FINDINGS_DIR);

  const isRepo = await git.checkIsRepo().catch(() => false);
  if (!isRepo) {
    await git.init();
    await git.addConfig("user.name", "Swarm Mind");
    await git.addConfig("user.email", "swarm@swarm-mind.local");

    // Initial commit
    const readmePath = path.join(FINDINGS_DIR, "README.md");
    fs.writeFileSync(
      readmePath,
      [
        "# Swarm Mind — Science Findings",
        "",
        "Auto-committed research findings from the autonomous swarm.",
        "Each domain has its own markdown file. Findings are ordered by timestamp.",
        "",
        `Initialized: ${new Date().toISOString()}`,
      ].join("\n"),
      "utf-8"
    );
    await git.add("README.md");
    await git.commit("chore: initialize findings repository");
    console.log("[FINDINGS] Git repo initialized at workspace/findings/");
  }

  // Set remote if configured
  const remote = process.env.FINDINGS_REPO_REMOTE;
  if (remote) {
    const remotes = await git.getRemotes();
    if (!remotes.find((r) => r.name === "origin")) {
      await git.addRemote("origin", remote);
      console.log(`[FINDINGS] Remote set: ${remote}`);
    }
  }

  initialized = true;
}

// ── Core commit function ──

export interface FindingCommit {
  agentName: string;
  domain: string;
  content: string;
  confidence: number;
  eigendaCommitment?: string;
  timestamp: number;
}

export async function commitFinding(finding: FindingCommit): Promise<boolean> {
  if (!initialized || !git) return false;
  if (finding.confidence < MIN_CONFIDENCE) return false;

  try {
    const domainSlug = finding.domain.toLowerCase().replace(/\s+/g, "-");
    const filePath = path.join(FINDINGS_DIR, `${domainSlug}.md`);

    // Append to domain file
    const entry = formatFindingEntry(finding);
    fs.appendFileSync(filePath, entry, "utf-8");

    await git.add(`${domainSlug}.md`);

    const confidencePct = Math.round(finding.confidence * 100);
    const daRef = finding.eigendaCommitment
      ? ` | DA: ${finding.eigendaCommitment.slice(0, 18)}…`
      : "";

    const message = `[${finding.agentName}] ${finding.domain} (${confidencePct}% confidence)${daRef}`;
    await git.commit(message);

    // Push if remote configured
    const remote = process.env.FINDINGS_REPO_REMOTE;
    if (remote) {
      await git.push("origin", "main").catch(() => git!.push("origin", "master").catch(() => {}));
    }

    console.log(`  [FINDINGS] Committed: ${message.slice(0, 80)}`);
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  [FINDINGS] Commit failed: ${msg.slice(0, 100)}`);
    return false;
  }
}

function formatFindingEntry(f: FindingCommit): string {
  const date = new Date(f.timestamp).toISOString();
  const confidencePct = Math.round(f.confidence * 100);
  const lines = [
    ``,
    `---`,
    ``,
    `## ${date} — ${f.agentName} (${confidencePct}% confidence)`,
    ``,
    f.content,
  ];
  if (f.eigendaCommitment) {
    lines.push(``, `> **EigenDA:** \`${f.eigendaCommitment}\``);
  }
  lines.push(``);
  return lines.join("\n");
}

// ── Stats ──

export function findingsStats(): { domains: string[]; totalCommits: number } {
  if (!fs.existsSync(FINDINGS_DIR)) return { domains: [], totalCommits: 0 };
  const files = fs.readdirSync(FINDINGS_DIR).filter((f) => f.endsWith(".md") && f !== "README.md");
  const domains = files.map((f) => f.replace(".md", "").replace(/-/g, " "));

  let totalCommits = 0;
  try {
    if (git) {
      // Count commits synchronously via log length — best effort
      const logRaw = fs.readFileSync(path.join(FINDINGS_DIR, ".git", "COMMIT_EDITMSG"), "utf-8");
      totalCommits = logRaw ? 1 : 0; // approximate — real count needs async
    }
  } catch { /* not critical */ }

  return { domains, totalCommits };
}
