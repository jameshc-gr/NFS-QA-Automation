import { test } from '@playwright/test';
import { runApiRequest } from '../utils/apiRunner';
import { parseMappingFile } from '../utils/mappingParser';
import { RuntimeStore } from '../utils/runtimeStore';
import {
	discoverMappingFiles,
	getMappingProjectName,
	resolveLegacyMappingPath,
	resolveMappingPath
} from '../utils/projectPaths';

const selectedProjectName = process.env.API_PROJECT?.trim();
const explicitMappingPath = process.env.API_MAPPING_FILE
	? resolveMappingPath(selectedProjectName, process.env.API_MAPPING_FILE)
	: undefined;
const mappingPaths = explicitMappingPath
	? [explicitMappingPath]
	: (selectedProjectName
		? [resolveMappingPath(selectedProjectName)].filter(Boolean) as string[]
		: (discoverMappingFiles().length ? discoverMappingFiles() : [resolveLegacyMappingPath()].filter(Boolean) as string[]));

if (!mappingPaths.length) {
	throw new Error('Unable to locate an API mapping file. Set API_MAPPING_FILE or add api/api-mappings/<projectname>/api-mapping.json.');
}

test.describe.configure({ mode: 'serial' });

for (const mappingPath of mappingPaths) {
	const mapping = parseMappingFile(mappingPath);
	const runtimeStore = new RuntimeStore();
	const projectName = getMappingProjectName(mappingPath);

	if (!mapping.requests.length) {
		throw new Error(`No requests were found in the mapping file at ${mappingPath}`);
	}

	test.describe(`Mapping API runner: ${projectName}`, () => {
		test.beforeAll(() => {
			runtimeStore.clear();
		});

		for (const request of mapping.requests) {
			test(request.name, async ({ request: requestContext }) => {
				await runApiRequest(requestContext, mapping, request, process.env as Record<string, string>, runtimeStore);
			});
		}
	});
}