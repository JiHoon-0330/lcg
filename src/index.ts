import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { issuesCommand } from "./commands/issues.js";
import { startCommand } from "./commands/start.js";
import { statusCommand } from "./commands/status.js";
import { cleanCommand } from "./commands/clean.js";
import { updateCommand } from "./commands/update.js";
import { configCommand } from "./commands/config.js";
import { setupCommand } from "./commands/setup.js";
import { syncCommand } from "./commands/sync.js";

const program = new Command();

program
  .name("lcg")
  .description("Linear + Claude + Git — Automate your development workflow")
  .version("0.1.0");

program
  .command("init")
  .description("Configure LCG with Linear API key and project settings")
  .action(initCommand);

program
  .command("ls")
  .description("List issues assigned to you")
  .option("-a, --all", "Show issues from all teams")
  .option("-s, --status <status>", "Filter by status")
  .option("-t, --team <team>", "Filter by team ID")
  .action(issuesCommand);

program
  .command("start <issue-id>")
  .description(
    "Start or resume working on an issue — creates worktree, starts Zellij + Claude",
  )
  .option(
    "-b, --base [branch]",
    "Base branch for the worktree (interactive picker if no value given)",
  )
  .action(startCommand);

program
  .command("status")
  .alias("st")
  .description("Show active worktree status")
  .action(statusCommand);

program
  .command("clean <issue-id>")
  .description(
    "Remove worktree and optionally delete branch (e.g. 123 or ENG-123)",
  )
  .action(cleanCommand);

program
  .command("config")
  .alias("cfg")
  .description("Show current config (use -e to edit)")
  .option("-e, --edit", "Open config files in default editor")
  .option("-g, --global", "Global config only (with -e)")
  .option("-p, --project", "Project config only (with -e)")
  .action(configCommand);

program
  .command("sync [branch]")
  .description(
    "Update chained PR branches from root base to target branch (default: current branch)",
  )
  .action(syncCommand);

program
  .command("update")
  .description("Pull latest changes and rebuild LCG")
  .action(updateCommand);

program.addHelpText(
  "after",
  `
Examples:
  lcg ls                        내 이슈 목록 (현재 팀)
  lcg ls -a                     모든 팀의 내 이슈
  lcg ls -s "In Progress"       특정 상태만 필터
  lcg start 123                 이슈 작업 시작 (worktree + Zellij + Claude)
  lcg start 123 --base canary   canary 브랜치 기반으로 시작
  lcg start 123 --base          인터랙티브 브랜치 선택 후 시작
  lcg sync feat/my-branch       체이닝된 PR을 루트까지 순차 업데이트
  lcg clean 123                 worktree, 브랜치, Zellij 세션 정리
  lcg cfg                       현재 설정 상태 확인
  lcg cfg -e                    설정 파일 에디터로 열기`,
);

program
  .command("_setup <issue-id>", { hidden: true })
  .option("--worktree-dir <dir>", "Worktree root directory")
  .option("--base-branch <branch>", "Base branch override")
  .action(setupCommand);

program.parseAsync().catch((error) => {
  if (error instanceof Error && error.name === "ExitPromptError") {
    process.exit(0);
  }
  throw error;
});
