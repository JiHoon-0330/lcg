export interface GlobalConfig {
  linearApiKey: string;
  defaultWorktreeDir: string;
  repoPath: string;
  linearUserId: string;
}

export interface ProjectConfig {
  teamId: string;
  branchPrefix: string;
  baseBranch: string;
  claudeMdTemplate: string;
}

export interface LcgIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  priority: number;
  priorityLabel: string;
  state: {
    id: string;
    name: string;
    type: string;
  };
  branchName: string;
  url: string;
  comments: string[];
  labels: string[];
}

export interface WorktreeInfo {
  issueId: string;
  branch: string;
  path: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
}
