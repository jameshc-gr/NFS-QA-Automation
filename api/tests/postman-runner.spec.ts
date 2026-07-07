import { test } from '@playwright/test';
import { runApiRequest } from '../utils/apiRunner';
import { parsePostmanCollection, parsePostmanEnvironment } from '../utils/postmanParser';
import { RuntimeStore } from '../utils/runtimeStore';
import {
	discoverPostmanCollectionFiles,
	getCollectionProjectAssets,
	resolveLegacyPostmanCollectionPath,
	resolvePostmanCollectionPath
} from '../utils/projectPaths';

const selectedProjectName = process.env.API_PROJECT?.trim();
const explicitCollectionPath = process.env.POSTMAN_COLLECTION
	? resolvePostmanCollectionPath(process.env.POSTMAN_COLLECTION, selectedProjectName)
	: undefined;
const collectionPaths = explicitCollectionPath
	? [explicitCollectionPath]
	: (selectedProjectName
		? [resolvePostmanCollectionPath(undefined, selectedProjectName)].filter(Boolean) as string[]
		: (discoverPostmanCollectionFiles().length ? discoverPostmanCollectionFiles() : [resolveLegacyPostmanCollectionPath()].filter(Boolean) as string[]));

if (!collectionPaths.length) {
	throw new Error('Unable to locate a Postman collection. Set POSTMAN_COLLECTION or add a collection under api/postman/<projectname>.');
}

test.describe.configure({ mode: 'serial' });

for (const collectionPath of collectionPaths) {
	const assets = getCollectionProjectAssets(collectionPath, process.env.POSTMAN_ENV);
	const collection = parsePostmanCollection(collectionPath);
	const environmentValues = assets.environmentPath ? parsePostmanEnvironment(assets.environmentPath) : {};
	const runtimeStore = new RuntimeStore();

	if (!collection.requests.length) {
		throw new Error(`No requests were found in the Postman collection at ${collectionPath}`);
	}

	test.describe(`Postman API runner: ${assets.projectName}`, () => {
		test.beforeAll(() => {
			runtimeStore.clear();
		});

		for (const request of collection.requests) {
			test(request.name, async ({ request: requestContext }) => {
				await runApiRequest(requestContext, collection, request, environmentValues, runtimeStore);
			});
		}
	});
}