import { LinearClient } from "@linear/sdk";
import type { LcgIssue } from "../types/index.js";

let client: LinearClient | null = null;

export function initLinearClient(apiKey: string): LinearClient {
  client = new LinearClient({ apiKey });
  return client;
}

export function getLinearClient(): LinearClient {
  if (!client) {
    throw new Error(
      "Linear client not initialized. Call initLinearClient first.",
    );
  }
  return client;
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const testClient = new LinearClient({ apiKey });
    await testClient.viewer;
    return true;
  } catch {
    return false;
  }
}

export async function getViewer(): Promise<{
  id: string;
  name: string;
  email: string;
}> {
  const viewer = await getLinearClient().viewer;
  return { id: viewer.id, name: viewer.name, email: viewer.email ?? "" };
}

export async function getTeams(): Promise<
  Array<{ id: string; name: string; key: string }>
> {
  const teams = await getLinearClient().teams();
  return teams.nodes.map((t) => ({ id: t.id, name: t.name, key: t.key }));
}

export async function getTeamMembers(
  teamId: string,
): Promise<Array<{ id: string; name: string; email: string }>> {
  const team = await getLinearClient().team(teamId);
  const members = await team.members();
  return members.nodes.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email ?? "",
  }));
}

export async function getProjects(
  teamId: string,
): Promise<Array<{ id: string; name: string }>> {
  const projects = await getLinearClient().projects({
    filter: {
      accessibleTeams: { id: { eq: teamId } },
    },
  });
  return projects.nodes.map((p) => ({ id: p.id, name: p.name }));
}

export async function getMyIssues(
  userId: string,
  teamId?: string,
  statusFilter?: string,
): Promise<LcgIssue[]> {
  const filter: Record<string, unknown> = {
    assignee: { id: { eq: userId } },
  };
  if (teamId) {
    filter.team = { id: { eq: teamId } };
  }
  if (statusFilter) {
    filter.state = { name: { eqIgnoreCase: statusFilter } };
  } else {
    filter.state = { type: { nin: ["completed", "cancelled", "duplicated"] } };
  }

  const issues = await getLinearClient().issues({ filter });
  const results: LcgIssue[] = [];

  for (const issue of issues.nodes) {
    const state = await issue.state;
    const comments = await issue.comments();
    const labels = await issue.labels();

    results.push({
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description ?? undefined,
      priority: issue.priority,
      priorityLabel: issue.priorityLabel,
      state: state
        ? { id: state.id, name: state.name, type: state.type }
        : { id: "", name: "Unknown", type: "unknown" },
      branchName: issue.branchName,
      url: issue.url,
      comments: comments.nodes.map((c) => c.body),
      labels: labels.nodes.map((l) => l.name),
    });
  }

  return results;
}

export function parseIssueIdentifier(issueId: string): {
  teamKey: string;
  number: number;
} {
  const match = issueId.match(/^([A-Z]+)-(\d+)$/);
  if (!match) {
    throw new Error(
      `Invalid issue identifier format: ${issueId}. Expected format: TEAM-123`,
    );
  }
  return { teamKey: match[1], number: parseInt(match[2], 10) };
}

export async function getIssue(issueId: string): Promise<LcgIssue> {
  const { teamKey, number: issueNumber } = parseIssueIdentifier(issueId);
  const issues = await getLinearClient().issues({
    filter: {
      number: { eq: issueNumber },
      team: { key: { eq: teamKey } },
    },
  });
  const issue = issues.nodes[0];
  if (!issue) {
    throw new Error(`Issue ${issueId} not found`);
  }

  const state = await issue.state;
  const comments = await issue.comments();
  const labels = await issue.labels();

  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    description: issue.description ?? undefined,
    priority: issue.priority,
    priorityLabel: issue.priorityLabel,
    state: state
      ? { id: state.id, name: state.name, type: state.type }
      : { id: "", name: "Unknown", type: "unknown" },
    branchName: issue.branchName,
    url: issue.url,
    comments: comments.nodes.map((c) => c.body),
    labels: labels.nodes.map((l) => l.name),
  };
}

export async function updateIssueState(
  issueId: string,
  stateName: string,
  teamId: string,
): Promise<void> {
  const team = await getLinearClient().team(teamId);
  const states = await team.states();
  const targetState = states.nodes.find(
    (s) => s.name.toLowerCase() === stateName.toLowerCase(),
  );
  if (!targetState) {
    throw new Error(
      `State "${stateName}" not found. Available: ${states.nodes.map((s) => s.name).join(", ")}`,
    );
  }
  await getLinearClient().updateIssue(issueId, { stateId: targetState.id });
}
