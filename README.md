# gh-workflow-stats
 
Simple CLI for generating aggregated statistics from GitHub workflow runs (GitHub Actions).

```js
[
  {
    id: "35212767",
    workflowName: "CI",
    workflowPath: ".github/workflows/ci.yaml",
    lastRunStarted: "2023-09-14T16:24:01Z",
    firstRunStarted: "2022-09-19T02:06:00Z",
    avgRunDurationSeconds: 5062978.91082813,
    totalRuntimeSeconds: 794887689.0000165,
    successRate: 0.9044585987261147,
    totalRuns: 157
  }, {
    id: "36583289",
    workflowName: "Test Suite",
    workflowPath: ".github/workflows/daily.yaml",
    lastRunStarted: "2023-10-26T06:05:01Z",
    firstRunStarted: "2022-10-05T06:11:40Z",
    avgRunDurationSeconds: 3544.090685412726,
    totalRuntimeSeconds: 1445988.9996483922,
    successRate: 0.946078431372549,
    totalRuns: 408
  }
]
```
