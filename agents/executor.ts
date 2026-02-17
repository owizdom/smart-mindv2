import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import type {
  AgentDecision,
  DecisionResult,
  Artifact,
  CodeChange,
  ExecutionPlan,
  AutonomousAgentState,
  RepoContext,
  GitHubIssue,
} from "./types";
import {
  buildRepoContext,
  cloneRepo,
  createBranch,
  commitAndPush,
  createPR,
  readRepoFile,
  getActionableIssues,
  discoverRepos,
  scoreFiles,
} from "./github";
import {
  formThought,
  analyzeRepo,
  analyzeIssue,
  generateCode,
  reviewCode,
  synthesizeKnowledge,
} from "./thinker";

const MAX_ITERATIONS = 3;

export async function executeDecision(
  agentState: AutonomousAgentState,
  decision: AgentDecision
): Promise<DecisionResult> {
  const action = decision.action;

  try {
    switch (action.type) {
      case "study_repo":
        return await handleStudyRepo(agentState, action.owner, action.repo, action.topic);
      case "fix_issue":
        return await handleFixIssue(agentState, action.owner, action.repo, action.issueNumber);
      case "write_code":
        return await handleWriteCode(agentState, action.description, action.targetRepo);
      case "refactor":
        return await handleRefactor(agentState, action.owner, action.repo, action.target);
      case "share_technique":
        return await handleShareTechnique(agentState, action.technique, action.sourceRepo);
      case "contribute_pr":
        return await handleContributePR(agentState, action.owner, action.repo, action.description);
      case "document":
        return await handleDocument(agentState, action.owner, action.repo, action.target);
      case "explore_topic":
        return await handleExploreTopic(agentState, action.topic);
      default:
        return { success: false, summary: "Unknown action type", artifacts: [], tokensUsed: 0 };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      summary: `Execution error: ${message.slice(0, 200)}`,
      artifacts: [],
      tokensUsed: 0,
    };
  }
}

// ── Action Handlers ──

async function handleStudyRepo(
  agentState: AutonomousAgentState,
  owner: string,
  repo: string,
  topic?: string
): Promise<DecisionResult> {
  agentState.currentAction = `studying ${owner}/${repo}`;

  const context = buildRepoContext(owner, repo, topic);
  if (!context) {
    return { success: false, summary: `Could not build context for ${owner}/${repo}`, artifacts: [], tokensUsed: 0 };
  }

  const { thought, tokensUsed } = await analyzeRepo(agentState, context);
  agentState.thoughts.push(thought);
  agentState.tokensUsed += tokensUsed;

  if (!agentState.reposStudied.includes(`${owner}/${repo}`)) {
    agentState.reposStudied.push(`${owner}/${repo}`);
  }

  const artifact: Artifact = {
    type: "analysis",
    content: `## ${owner}/${repo}\n\n${thought.conclusion}\n\nSuggested: ${thought.suggestedActions.join(", ")}`,
  };

  return {
    success: true,
    summary: `Studied ${owner}/${repo}: ${thought.conclusion.slice(0, 100)}`,
    artifacts: [artifact],
    tokensUsed,
  };
}

async function handleFixIssue(
  agentState: AutonomousAgentState,
  owner: string,
  repo: string,
  issueNumber: number
): Promise<DecisionResult> {
  agentState.currentAction = `fixing #${issueNumber} in ${owner}/${repo}`;
  let totalTokens = 0;

  // Get issue details
  const issues = getActionableIssues(owner, repo, 20);
  const issue = issues.find((i) => i.number === issueNumber);
  if (!issue) {
    return { success: false, summary: `Issue #${issueNumber} not found in ${owner}/${repo}`, artifacts: [], tokensUsed: 0 };
  }

  // Build context
  const context = buildRepoContext(owner, repo);
  if (!context) {
    return { success: false, summary: `Could not build context for ${owner}/${repo}`, artifacts: [], tokensUsed: 0 };
  }

  // Score files relevant to this issue
  const relevantFiles = scoreFiles(context.structure, [], issue);

  // Analyze the issue
  const { thought, tokensUsed: analyzeTokens } = await analyzeIssue(agentState, issue, relevantFiles);
  agentState.thoughts.push(thought);
  totalTokens += analyzeTokens;

  // Check if the analysis says we can fix it
  if (thought.confidence < 0.4 || thought.conclusion.toLowerCase().includes("too-complex")) {
    agentState.tokensUsed += totalTokens;
    return {
      success: false,
      summary: `Issue #${issueNumber} assessed as too complex: ${thought.conclusion.slice(0, 100)}`,
      artifacts: [],
      tokensUsed: totalTokens,
    };
  }

  // Read relevant files
  const fileContents = relevantFiles.slice(0, 3).map((f) => ({
    path: f.path,
    content: readRepoFile(owner, repo, f.path),
  })).filter((f) => f.content.length > 0);

  // Plan-implement-review loop
  const result = await planImplementReviewLoop(
    agentState,
    `Fix issue #${issueNumber}: ${issue.title}`,
    fileContents,
    `Fix must address: ${issue.body.slice(0, 500)}`,
    { owner, repo, issue }
  );

  totalTokens += result.tokensUsed;
  agentState.tokensUsed += totalTokens;

  return { ...result, tokensUsed: totalTokens };
}

async function handleWriteCode(
  agentState: AutonomousAgentState,
  description: string,
  targetRepo?: string
): Promise<DecisionResult> {
  agentState.currentAction = `writing code: ${description.slice(0, 30)}`;

  const files: Array<{ path: string; content: string }> = [];
  if (targetRepo) {
    const [owner, repo] = targetRepo.split("/");
    if (owner && repo) {
      const context = buildRepoContext(owner, repo);
      if (context) {
        for (const f of context.keyFiles.slice(0, 3)) {
          const content = readRepoFile(owner, repo, f.path);
          if (content) files.push({ path: f.path, content });
        }
      }
    }
  }

  const result = await planImplementReviewLoop(
    agentState,
    description,
    files,
    "Write clean, well-structured code following the existing patterns",
  );

  agentState.tokensUsed += result.tokensUsed;
  return result;
}

async function handleRefactor(
  agentState: AutonomousAgentState,
  owner: string,
  repo: string,
  target: string
): Promise<DecisionResult> {
  agentState.currentAction = `refactoring ${owner}/${repo}`;

  const context = buildRepoContext(owner, repo);
  if (!context) {
    return { success: false, summary: `Could not build context for ${owner}/${repo}`, artifacts: [], tokensUsed: 0 };
  }

  const files = context.keyFiles.slice(0, 3).map((f) => ({
    path: f.path,
    content: readRepoFile(owner, repo, f.path),
  })).filter((f) => f.content.length > 0);

  const result = await planImplementReviewLoop(
    agentState,
    `Refactor: ${target}`,
    files,
    "Maintain backward compatibility. Improve code quality without changing behavior.",
  );

  agentState.tokensUsed += result.tokensUsed;
  return result;
}

async function handleShareTechnique(
  agentState: AutonomousAgentState,
  technique: string,
  _sourceRepo?: string
): Promise<DecisionResult> {
  agentState.currentAction = "sharing technique";

  // Use recent thoughts + pheromone knowledge to generate a technique description
  const recentThoughts = agentState.thoughts.slice(-5);
  const context = recentThoughts.map((t) => t.conclusion).join("\n");

  const { thought, tokensUsed } = await formThought(
    agentState,
    "share_technique",
    `Sharing engineering technique: ${technique}`,
    `Based on recent analysis:\n${context}`
  );

  agentState.thoughts.push(thought);
  agentState.tokensUsed += tokensUsed;

  const artifact: Artifact = {
    type: "technique",
    content: `## Technique: ${technique}\n\n${thought.reasoning}\n\n**Conclusion:** ${thought.conclusion}`,
  };

  return {
    success: true,
    summary: `Shared technique: ${thought.conclusion.slice(0, 100)}`,
    artifacts: [artifact],
    tokensUsed,
  };
}

async function handleContributePR(
  agentState: AutonomousAgentState,
  owner: string,
  repo: string,
  description: string
): Promise<DecisionResult> {
  agentState.currentAction = `preparing PR for ${owner}/${repo}`;
  let totalTokens = 0;

  // Clone the repo
  let repoDir: string;
  try {
    repoDir = await cloneRepo(owner, repo);
  } catch {
    return { success: false, summary: `Failed to clone ${owner}/${repo}`, artifacts: [], tokensUsed: 0 };
  }

  // Build context
  const context = buildRepoContext(owner, repo);
  if (!context) {
    return { success: false, summary: `Could not build context for ${owner}/${repo}`, artifacts: [], tokensUsed: 0 };
  }

  // Read relevant files
  const files = context.keyFiles.slice(0, 3).map((f) => ({
    path: f.path,
    content: readRepoFile(owner, repo, f.path),
  })).filter((f) => f.content.length > 0);

  // Plan-implement-review loop
  const result = await planImplementReviewLoop(
    agentState,
    description,
    files,
    "Follow existing code style. Add tests if the repo has test infrastructure.",
    { owner, repo }
  );

  totalTokens += result.tokensUsed;

  if (result.success && result.artifacts.some((a) => a.type === "code_change")) {
    // Write changes to disk
    const codeChanges = result.artifacts.filter((a) => a.type === "code_change");
    for (const change of codeChanges) {
      if (change.filePath) {
        const fullPath = path.join(repoDir, change.filePath);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullPath, change.content);
      }
    }

    // Create branch, commit, and PR
    const slug = description.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase().slice(0, 40);
    await createBranch(repoDir, agentState.name, slug);
    await commitAndPush(repoDir, description.slice(0, 72), agentState.name);

    const prUrl = await createPR(
      repoDir,
      description.slice(0, 72),
      `## Changes\n\n${description}\n\nGenerated by ${agentState.name} (Swarm Mind v2)`
    );

    if (prUrl) {
      agentState.prsCreated.push(prUrl);
      result.artifacts.push({ type: "pr_url", content: prUrl, prUrl });
      result.summary += ` | PR: ${prUrl}`;
    }
  }

  agentState.tokensUsed += totalTokens;
  return { ...result, tokensUsed: totalTokens };
}

async function handleDocument(
  agentState: AutonomousAgentState,
  owner: string,
  repo: string,
  target: string
): Promise<DecisionResult> {
  agentState.currentAction = `documenting ${owner}/${repo}`;

  const context = buildRepoContext(owner, repo);
  if (!context) {
    return { success: false, summary: `Could not build context for ${owner}/${repo}`, artifacts: [], tokensUsed: 0 };
  }

  const { thought, tokensUsed } = await analyzeRepo(agentState, context);
  agentState.thoughts.push(thought);
  agentState.tokensUsed += tokensUsed;

  const artifact: Artifact = {
    type: "analysis",
    content: `## Documentation Notes: ${owner}/${repo}\n\nTarget: ${target}\n\n${thought.reasoning}\n\n${thought.conclusion}`,
  };

  return {
    success: true,
    summary: `Documented ${owner}/${repo}: ${thought.conclusion.slice(0, 100)}`,
    artifacts: [artifact],
    tokensUsed,
  };
}

async function handleExploreTopic(
  agentState: AutonomousAgentState,
  topic: string
): Promise<DecisionResult> {
  agentState.currentAction = `exploring ${topic}`;

  // Discover repos related to the topic
  const repos = discoverRepos(topic, { limit: 5 });

  if (repos.length === 0) {
    const { thought, tokensUsed } = await formThought(
      agentState,
      "explore_topic",
      `Exploring topic: ${topic}`,
      "No repos found. Forming thoughts from existing knowledge."
    );
    agentState.thoughts.push(thought);
    agentState.tokensUsed += tokensUsed;
    return {
      success: true,
      summary: `Explored ${topic} (no repos found): ${thought.conclusion.slice(0, 100)}`,
      artifacts: [{ type: "analysis", content: thought.conclusion }],
      tokensUsed,
    };
  }

  // Study the top repo
  const topRepo = repos[0];
  return handleStudyRepo(agentState, topRepo.owner, topRepo.repo, topic);
}

// ── Plan-Implement-Review Loop ──

async function planImplementReviewLoop(
  agentState: AutonomousAgentState,
  objective: string,
  files: Array<{ path: string; content: string }>,
  constraints: string,
  repoInfo?: { owner: string; repo: string; issue?: GitHubIssue }
): Promise<DecisionResult> {
  const plan: ExecutionPlan = {
    steps: ["plan", "implement", "review"],
    status: "planning",
    iteration: 0,
    maxIterations: MAX_ITERATIONS,
  };

  let totalTokens = 0;
  let lastChanges: CodeChange[] = [];
  let previousAttempt: string | undefined;
  const allArtifacts: Artifact[] = [];

  while (plan.iteration < plan.maxIterations) {
    plan.iteration++;

    // 1. Generate code
    plan.status = "implementing";
    agentState.currentAction = `implementing (attempt ${plan.iteration}/${plan.maxIterations})`;

    const { changes, tokensUsed: genTokens } = await generateCode(
      agentState,
      objective,
      files,
      constraints,
      previousAttempt
    );

    totalTokens += genTokens;
    lastChanges = changes;

    if (changes.length === 0) {
      return {
        success: false,
        summary: `No code changes generated for: ${objective}`,
        artifacts: allArtifacts,
        tokensUsed: totalTokens,
      };
    }

    // 2. Review
    plan.status = "reviewing";
    agentState.currentAction = `reviewing (attempt ${plan.iteration}/${plan.maxIterations})`;

    const { feedback, tokensUsed: reviewTokens } = await reviewCode(
      agentState,
      changes,
      objective
    );
    totalTokens += reviewTokens;

    if (feedback.passed || plan.iteration >= plan.maxIterations) {
      // Ship it
      plan.status = "done";
      for (const change of changes) {
        allArtifacts.push({
          type: "code_change",
          content: change.modified,
          filePath: change.filePath,
        });
      }

      return {
        success: feedback.passed,
        summary: feedback.passed
          ? `Generated ${changes.length} code changes (score: ${feedback.score}/10)`
          : `Best attempt after ${plan.iteration} iterations (score: ${feedback.score}/10): ${feedback.issues.join("; ")}`,
        artifacts: allArtifacts,
        tokensUsed: totalTokens,
      };
    }

    // Not passed — iterate
    previousAttempt = `Issues: ${feedback.issues.join("; ")}. Suggestions: ${feedback.suggestions.join("; ")}`;
  }

  return {
    success: false,
    summary: `Exceeded max iterations for: ${objective}`,
    artifacts: allArtifacts,
    tokensUsed: totalTokens,
  };
}

// ── Sandbox Execution ──

export function runInSandbox(
  dir: string,
  command: string,
  timeoutMs = 30000
): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(command, {
      cwd: dir,
      encoding: "utf-8",
      timeout: timeoutMs,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err: unknown) {
    const execErr = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: execErr.stdout || "",
      stderr: execErr.stderr || "",
      exitCode: execErr.status || 1,
    };
  }
}
