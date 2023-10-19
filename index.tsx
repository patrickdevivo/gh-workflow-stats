import { program } from "commander";
import { Octokit } from "octokit";
import { Database } from "bun:sqlite";

import Stats, { Workflow, WorkflowRun } from "./stats";

const octokit = new Octokit({
	auth: process.env.GITHUB_TOKEN,
});

program
	.argument("<repo>", "GitHub repository specified in the format: owner/repo")
	.action(async (repo: string) => {
		const [owner, repoName] = repo.split("/");

		const stats = new Stats(octokit, new Database(":memory:"), owner, repoName);

		const objects = { workflows: [] as Workflow[], workflowRuns: [] as WorkflowRun[] };
		const loop = setInterval(() => {
			console.log(`Ingested ${objects.workflowRuns.length} runs from ${objects.workflows.length} workflows`)
		}, 1000)
		
		await stats.ingestWorkflows({
			onWorkflow: (workflow) => {
				objects.workflows.push(workflow)
			},
			onWorkflowRun: (workflowRun) => {
				objects.workflowRuns.push(workflowRun)
			}
		});

		clearInterval(loop)

		console.log(stats.calculate())
	})

program.parse();
