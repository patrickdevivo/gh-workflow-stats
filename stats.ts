import { Endpoints } from "@octokit/types";
import { Octokit } from "octokit";
import { Database } from "bun:sqlite";

// These types are derived from @octokit/types.
export type Workflow = Endpoints["GET /repos/{owner}/{repo}/actions/workflows"]["response"]["data"]["workflows"][0];
export type WorkflowRun = Endpoints["GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs"]["response"]["data"]["workflow_runs"][0];

type ingestWorkflowsCallbacks = {
	onWorkflow?: (workflow: Workflow) => void;
	onWorkflowRun?: (workflow: WorkflowRun) => void;
}

// TODO(patrickdevivo) use this as a return type when calculating stats.
type WorkflowStats = {
	WorkflowID: string
	WorkflowName: string
	WorkflowFile: string

	LastRunStarted: Date
	FirstRunStarted: Date
	TotalRuns: number
	MeanRunDurationSeconds: number
	SuccessRate: number
	TotalRunningTimeSeconds: number
}

export default class Stats {
	octokit: Octokit;
	db: Database;
	repoOwner: string;
	repoName: string;

	constructor(octokit: Octokit, db: Database, repoOwner: string, repoName: string) {
		this.octokit = octokit;
		this.db = db;
		this.repoOwner = repoOwner;
		this.repoName = repoName;

		db.transaction(() => {
			db.query("CREATE TABLE IF NOT EXISTS workflows (id TEXT PRIMARY KEY, data JSON);").run();
			db.query(`
			CREATE TABLE IF NOT EXISTS workflow_runs (
				id TEXT PRIMARY KEY,
				workflow_id TEXT,
				data JSON,
				runtime_seconds GENERATED ALWAYS AS (
					(julianday(data->>"updated_at") - julianday(data->>"run_started_at")) * 24 * 60 * 60
				)
			);`).run()
		})()
	}

	// Given a repository, ingest all workflows and workflow runs into a SQLite database.
	async ingestWorkflows(callbacks: ingestWorkflowsCallbacks = {}) {

		const { octokit, db, repoOwner, repoName } = this;
	
		// create an iterator for listing all the workflows on a repo
		const workflowsIter = octokit.paginate.iterator(octokit.rest.actions.listRepoWorkflows, {
			owner: repoOwner,
			repo: repoName,
			per_page: 100,
		});
	
		const allWorkflows: any[] = []
		const allWorkflowRuns: any[] = []
	
		// iterate over each workflow and store in memory above
		for await (const { data: workflows } of workflowsIter) {
			for (const workflow of workflows) {
				allWorkflows.push(workflow)
				if (callbacks.onWorkflow) callbacks.onWorkflow(workflow)
			}
		}
	
		// iterate over each workflow retrieved above
		for (const workflow of allWorkflows) {
			// for each workflow, iterate over it's history of runs
			const workflowRunsIter = octokit.paginate.iterator(octokit.rest.actions.listWorkflowRuns, {
				owner: repoOwner,
				repo: repoName,
				workflow_id: workflow.id,
				// created: ">2023-08-01",
				per_page: 100,
			})
	
			// store each workflow run in memory
			for await (const { data: workflowRuns } of workflowRunsIter) {
				for (const workflowRun of workflowRuns) {
					allWorkflowRuns.push(workflowRun)
					if (callbacks.onWorkflowRun) callbacks.onWorkflowRun(workflowRun)
				}
			}
		}
	
		// now that we have all the workflow data retrieved, let's store it in the database
		const insertWorkflows = db.prepare(`INSERT INTO workflows (id, data) VALUES ($1, $2)`)
		const insertWorkflowRuns = db.prepare(`INSERT INTO workflow_runs (id, workflow_id, data) VALUES ($1, $2, $3)`)
	
		db.transaction(() => {
			for (const workflow of allWorkflows) {
				insertWorkflows.run(workflow.id, JSON.stringify(workflow));
			}
			for (const workflowRun of allWorkflowRuns) {
				insertWorkflowRuns.run(workflowRun.id, workflowRun.workflow_id, JSON.stringify(workflowRun));
			}
		})()
	}

	calculate(start: Date = new Date(0), end: Date = new Date()) {
		const sql = `
		SELECT
			w.id,
			w.data->>'name' as workflowName,
			w.data->>'path' as workflowPath,
			
			max(r.data->>'run_started_at') as lastRunStarted,
			min(r.data->>'run_started_at') as firstRunStarted,
			avg(runtime_seconds) as avgRunDurationSeconds,
			sum(runtime_seconds) as totalRuntimeSeconds,
			sum(iif(r.data->>'conclusion' = 'success', 1, 0))*1.0 / count(*) as successRate,
			count(*) as totalRuns
		FROM workflow_runs r
		JOIN workflows w ON r.workflow_id = w.id
		WHERE date(r.data->>'created_at') >= $1 AND date(r.data->>'created_at') <= $2
		GROUP BY w.id, workflowName, workflowPath
		`

		return this.db.query(sql).all(start.toISOString(), end.toISOString())
	}
}
