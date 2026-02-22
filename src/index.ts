import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { issuesCommand } from "./commands/issues.js";
import { startCommand } from "./commands/start.js";
import { statusCommand } from "./commands/status.js";
import { cleanCommand } from "./commands/clean.js";
import { updateCommand } from "./commands/update.js";
import { configCommand } from "./commands/config.js";
import { setupCommand } from "./commands/setup.js";

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
  .command("issues")
  .alias("ls")
  .description("List issues assigned to you")
  .option("-a, --all", "Show issues from all teams")
  .option("-s, --status <status>", "Filter by status")
  .option("-t, --team <team>", "Filter by team ID")
  .action(issuesCommand);

program
  .command("start <issue-id>")
  .description("Start or resume working on an issue (e.g. 123 or ENG-123)")
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
  .description("Open config files in default editor")
  .option("-g, --global", "Open global config only")
  .option("-p, --project", "Open project config only")
  .action(configCommand);

program
  .command("update")
  .description("Pull latest changes and rebuild LCG")
  .action(updateCommand);

program.command("_setup <issue-id>", { hidden: true }).action(setupCommand);

program.parseAsync().catch((error) => {
  if (error instanceof Error && error.name === "ExitPromptError") {
    process.exit(0);
  }
  throw error;
});
