# API How To Use

This folder contains the Playwright-based API runner, shared parsers, and sample fixtures.

## What It Does

The API runner executes two input styles:

- Postman collections under `api/postman/`
- Custom mapping JSON under `api/api-mappings/`

It resolves Postman-style placeholders such as `{{baseUrl}}`, `{{token}}`, and `{{customerId}}`, then runs the requests through Playwright's `request` fixture.

## Quick Start

1. Set your environment values in `.env` or your shell.
2. Point the runner at a collection or mapping file, or let it discover the default files.
3. Run the API project from Playwright.

Example:

```bash
npm run test:api
```

To run headed:

```bash
npm run test:api:headed
```

To open the HTML report:

```bash
npm run test:api:report
```

## Default File Layout

The runner looks for these default files first:

- `api/postman/collection.json`
- `api/postman/environment.qa.json`
- `api/api-mappings/api-mapping.json`

Project-scoped files live under:

- `api/postman/<projectname>/`
- `api/api-mappings/<projectname>/`

If `API_PROJECT=mobile`, the runner prefers the `mobile` folder before falling back to the root sample files.

## Environment Variables

Use these variables to configure the API runner:

- `BASE_URL`: Base URL for API requests.
- `API_TOKEN`: Bearer token or API token used by the runner.
- `API_PROJECT`: Selects a project folder such as `mobile`.
- `POSTMAN_COLLECTION`: Explicit path to a Postman collection file.
- `POSTMAN_ENV`: Explicit path to a Postman environment file.
- `API_MAPPING_FILE`: Explicit path to a custom mapping JSON file.
- `TENANT_ID`: Optional tenant header used by some requests.
- `API_KEY`: Optional API key header used by some requests.

The sample values live in [.env.example](../.env.example).

## How Variable Resolution Works

Variables are resolved in this order:

1. Runtime values saved by earlier requests.
2. Postman environment JSON.
3. Postman collection variables.
4. Process environment variables.
5. Built-in dynamic values like `{{guid}}` and `{{timestamp}}`.

That means you can save a value from one response and reuse it later with the same placeholder name.

## Adding A New Postman Collection

When a new collection is dropped into the workspace, keep the folder convention consistent:

1. Put the collection under `api/postman/<projectname>/`.
2. Add a matching environment file in the same project folder.
3. Add a matching mapping file under `api/api-mappings/<projectname>/` if you use the custom mapping runner.
4. Set `API_PROJECT=<projectname>` when running the suite.

Example layout:

```text
api/
  postman/
    mobile/
      Gateway-API-Latest-June-26-2026.postman_collection.json
      environment.qa.json
  api-mappings/
    mobile/
      api-mapping.json
```

## Adding A Custom Mapping File

Mapping files should contain an `apis` array. Each entry can define:

- `name`
- `method`
- `endpoint`
- `headers`
- `query`
- `body`
- `expected`
- `save`

Example:

```json
{
  "variables": {
    "baseUrl": "{{BASE_URL}}"
  },
  "apis": [
    {
      "name": "Actuator Health",
      "method": "GET",
      "endpoint": "{{baseUrl}}/actuator/health",
      "expected": {
        "status": 200
      }
    }
  ]
}
```

## Useful Commands

- `npm run test:api` runs the API project.
- `npm run test:api:headed` runs the API project in headed mode.
- `npm run typecheck` validates the TypeScript source.

## Notes

- The root sample files are intentionally small starter fixtures.
- The `mobile` project folder is the current example of the project-scoped pattern.
- If you provide explicit file paths through environment variables, those paths take precedence over discovery.

## See Also

- [Root framework guide](../readme.md)
- [AI agent framework guide](../ai/jobs/readme-agents.md)