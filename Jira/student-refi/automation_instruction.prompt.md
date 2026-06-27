Automation Instruction Prompt

Task: Given `test_cases.md` and `test_plan.md`, generate a detailed automation prompt that can be fed to an agent (Playwright/ Appium MCP) to produce runnable test scripts. Include: target file path, required env vars, sample test name, and preferred locator strategies.

Output format (YAML block):

```yaml
target: tests/<project>/<ticket>-<testcase-slug>.spec.ts
framework: playwright
project: <project>
env: [LIST_OF_REQUIRED_ENV_VARS]
steps:
  - description: ...
    locator: {strategy: 'accessibility id', selector: '...'}
```
