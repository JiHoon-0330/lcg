import chalk from "chalk";
import ora from "ora";
import { confirm } from "@inquirer/prompts";
import { execa } from "execa";
import { ensureGlobalConfig, resolveProjectContext } from "../lib/config.js";
import { getGit } from "../lib/git.js";

interface PrInfo {
  number: number;
  title: string;
  body: string;
  headRefName: string;
  baseRefName: string;
  url: string;
}

async function getOpenPrs(repoPath: string): Promise<PrInfo[]> {
  const { stdout } = await execa(
    "gh",
    [
      "pr",
      "list",
      "--state",
      "open",
      "--json",
      "number,title,body,headRefName,baseRefName,url",
      "--limit",
      "100",
    ],
    { cwd: repoPath },
  );
  return JSON.parse(stdout) as PrInfo[];
}

/**
 * Trace the PR chain from target branch up to the root base.
 * Returns ordered list from root (closest to base) to target.
 */
function traceChainToRoot(prs: PrInfo[], targetBranch: string): PrInfo[] {
  const chain: PrInfo[] = [];
  let current = targetBranch;

  while (true) {
    const pr = prs.find((p) => p.headRefName === current);
    if (!pr) break;
    chain.unshift(pr); // prepend — we're tracing upward
    current = pr.baseRefName;
  }

  return chain;
}

async function getCurrentBranch(repoPath: string): Promise<string> {
  const git = getGit(repoPath);
  const branch = await git.revparse(["--abbrev-ref", "HEAD"]);
  return branch.trim();
}

async function generatePrBody(
  repoPath: string,
  headBranch: string,
  baseBranch: string,
): Promise<string> {
  const git = getGit(repoPath);
  const log = await git.log([`origin/${baseBranch}..origin/${headBranch}`]);

  if (log.total === 0) {
    return "No new commits.";
  }

  const commitLines = log.all.map((c) => `- ${c.message.split("\n")[0]}`);

  return ["## Changes", "", ...commitLines, "", `Base: \`${baseBranch}\``].join(
    "\n",
  );
}

export async function syncCommand(targetBranch?: string): Promise<void> {
  ensureGlobalConfig();
  const { repoPath } = await resolveProjectContext();

  // If no target specified, use current branch
  if (!targetBranch) {
    try {
      targetBranch = await getCurrentBranch(process.cwd());
    } catch {
      targetBranch = await getCurrentBranch(repoPath);
    }
  }

  const spinner = ora("Fetching PR information...").start();

  let prs: PrInfo[];
  try {
    prs = await getOpenPrs(repoPath);
  } catch (err) {
    spinner.fail(
      "Failed to fetch PRs. Is `gh` CLI installed and authenticated?",
    );
    console.error(chalk.red(String(err)));
    process.exit(1);
  }

  const git = getGit(repoPath);
  await git.fetch(["--all"]);

  const chain = traceChainToRoot(prs, targetBranch);
  spinner.stop();

  if (chain.length === 0) {
    console.log(chalk.yellow(`No PR found for branch "${targetBranch}".`));
    return;
  }

  const rootBase = chain[0].baseRefName;
  console.log(chalk.bold("\nSync chain:"));
  console.log(`  ${chalk.gray(rootBase)}`);
  for (const pr of chain) {
    console.log(
      `  ${chalk.gray("└─")} ${chalk.cyan(`#${pr.number}`)} ${pr.title} ${chalk.gray(`(${pr.headRefName})`)}`,
    );
  }
  console.log();

  const proceed = await confirm({
    message: `Merge and update ${chain.length} PR(s)?`,
    default: true,
  });
  if (!proceed) {
    console.log(chalk.gray("Cancelled."));
    return;
  }

  // Create temporary worktree for merge operations
  const tmpWorktree = `${repoPath}/../.lcg-sync-tmp-${Date.now()}`;
  try {
    await git.raw([
      "worktree",
      "add",
      tmpWorktree,
      `origin/${chain[0].headRefName}`,
      "--detach",
    ]);

    const tmpGit = getGit(tmpWorktree);

    for (const pr of chain) {
      const mergeSpinner = ora(
        `Merging ${chalk.gray(pr.baseRefName)} into ${chalk.cyan(pr.headRefName)}...`,
      ).start();

      try {
        await tmpGit.checkout(pr.headRefName);
        await tmpGit.merge([`origin/${pr.baseRefName}`]);
        await tmpGit.push(["origin", pr.headRefName]);

        mergeSpinner.succeed(
          `${chalk.cyan(pr.headRefName)} updated with latest ${chalk.gray(pr.baseRefName)}`,
        );
      } catch (err) {
        mergeSpinner.fail(`Failed to merge into ${pr.headRefName}`);
        console.error(chalk.red(String(err)));

        try {
          await tmpGit.merge(["--abort"]);
        } catch {
          // Ignore
        }

        console.log(
          chalk.yellow(
            "Stopping sync due to merge conflict. Resolve manually.",
          ),
        );
        break;
      }

      // Fetch updated refs after push
      await git.fetch(["origin"]);

      // Update PR body
      const updateSpinner = ora(
        `Updating PR #${pr.number} description...`,
      ).start();
      try {
        const newBody = await generatePrBody(
          repoPath,
          pr.headRefName,
          pr.baseRefName,
        );
        await execa(
          "gh",
          ["pr", "edit", String(pr.number), "--body", newBody],
          { cwd: repoPath },
        );
        updateSpinner.succeed(`PR #${pr.number} description updated`);
      } catch (err) {
        updateSpinner.warn(`Could not update PR #${pr.number}: ${String(err)}`);
      }
    }
  } finally {
    try {
      await git.raw(["worktree", "remove", tmpWorktree, "--force"]);
    } catch {
      console.log(
        chalk.yellow(
          `Could not clean up temp worktree at ${tmpWorktree}. Remove manually if needed.`,
        ),
      );
    }
  }

  console.log(chalk.green("\nSync complete!"));
}
