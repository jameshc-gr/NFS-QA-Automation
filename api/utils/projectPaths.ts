import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { resolveCandidateWorkspacePaths } from './pathResolver';

export interface ApiProjectAssets {
	projectName: string;
	collectionPath?: string;
	environmentPath?: string;
	mappingPath?: string;
}

const WORKSPACE_ROOT = process.cwd();

function toAbsolutePath(...segments: string[]) {
	return path.resolve(WORKSPACE_ROOT, ...segments);
}

function isJsonFile(fileName: string) {
	return fileName.toLowerCase().endsWith('.json');
}

function isExampleFile(fileName: string) {
	return fileName.toLowerCase().endsWith('.example.json');
}

function isEnvironmentFile(fileName: string) {
	return /^environment\..+\.json$/i.test(fileName) || fileName.toLowerCase() === 'environment.json';
}

function isCollectionFile(fileName: string) {
	return isJsonFile(fileName) && !isExampleFile(fileName) && !isEnvironmentFile(fileName) && !fileName.toLowerCase().includes('api-mapping');
}

function listProjectFiles(baseDir: string, predicate: (fileName: string) => boolean) {
	if (!existsSync(baseDir)) {
		return [];
	}

	const entries = readdirSync(baseDir, { withFileTypes: true });
	const files: string[] = [];

	for (const entry of entries) {
		if (!entry.isDirectory()) {
			continue;
		}

		const projectDir = path.join(baseDir, entry.name);
		for (const nestedEntry of readdirSync(projectDir, { withFileTypes: true })) {
			if (!nestedEntry.isFile() || !predicate(nestedEntry.name)) {
				continue;
			}

			files.push(path.join(projectDir, nestedEntry.name));
		}
	}

	return files;
}

function inferProjectNameFromPath(filePath: string, baseFolder: string) {
	const relative = path.relative(baseFolder, filePath);
	const segments = relative.split(path.sep).filter(Boolean);
	return segments.length > 1 ? segments[0] : undefined;
}

function resolveProjectScopedPath(projectName: string, fileNames: string[], baseFolder: string) {
	for (const fileName of fileNames) {
		const candidate = toAbsolutePath(baseFolder, projectName, fileName);
		if (existsSync(candidate)) {
			return candidate;
		}
	}

	return undefined;
}

function resolveExplicitPath(inputPath: string | undefined, predicate: (fileName: string) => boolean) {
	if (!inputPath) {
		return undefined;
	}

	const absolute = path.isAbsolute(inputPath) ? inputPath : path.resolve(WORKSPACE_ROOT, inputPath);
	if (!existsSync(absolute)) {
		return undefined;
	}

	if (statSync(absolute).isFile()) {
		return absolute;
	}

	if (statSync(absolute).isDirectory()) {
		for (const entry of readdirSync(absolute, { withFileTypes: true })) {
			if (entry.isFile() && predicate(entry.name)) {
				return path.join(absolute, entry.name);
			}
		}
	}

	return undefined;
}

export function discoverPostmanCollectionFiles() {
	return listProjectFiles(toAbsolutePath('api', 'postman'), isCollectionFile);
}

export function resolvePostmanCollectionPath(explicitPath: string | undefined, projectName?: string) {
	if (explicitPath) {
		const resolved = resolveExplicitPath(explicitPath, isCollectionFile) ?? resolveCandidateWorkspacePaths(explicitPath, [])[0];
		if (resolved) {
			return resolved;
		}
	}

	if (projectName) {
		return resolveProjectScopedPath(projectName, [
			'collection.json',
			'Gateway-API-Latest-June-26-2026.postman_collection.json'
		], 'api/postman');
	}

	return resolveCandidateWorkspacePaths(undefined, [
		'api/postman/collection.json'
	])[0];
}

export function resolveLegacyPostmanCollectionPath() {
	return resolveCandidateWorkspacePaths(undefined, [
		'api/postman/collection.json'
	])[0];
}

export function inferProjectNameFromCollectionPath(collectionPath: string) {
	const projectName = inferProjectNameFromPath(collectionPath, toAbsolutePath('api', 'postman'));
	return projectName || 'root';
}

export function resolvePostmanEnvironmentPath(projectName: string | undefined, explicitPath?: string) {
	if (explicitPath) {
		const resolved = resolveExplicitPath(explicitPath, isEnvironmentFile) ?? resolveCandidateWorkspacePaths(explicitPath, [])[0];
		if (resolved) {
			return resolved;
		}
	}

	if (projectName && projectName !== 'root') {
		const projectScoped = resolveProjectScopedPath(projectName, [
			'environment.qa.json',
			'environment.qa.example.json'
		], 'api/api-mappings');
		if (projectScoped) {
			return projectScoped;
		}

		const postmanScoped = resolveProjectScopedPath(projectName, [
			'environment.qa.json',
			'environment.qa.example.json'
		], 'api/postman');
		if (postmanScoped) {
			return postmanScoped;
		}
	}

	return resolveCandidateWorkspacePaths(undefined, [
		'api/postman/environment.qa.json',
		'api/postman/environment.qa.example.json'
	])[0];
}

export function resolveMappingPath(projectName: string | undefined, explicitPath?: string) {
	if (explicitPath) {
		const resolved = resolveExplicitPath(explicitPath, (fileName) => fileName === 'api-mapping.json') ?? resolveCandidateWorkspacePaths(explicitPath, [])[0];
		if (resolved) {
			return resolved;
		}
	}

	if (projectName && projectName !== 'root') {
		const projectScoped = resolveProjectScopedPath(projectName, [
			'api-mapping.json',
			'api-mapping.example.json'
		], 'api/api-mappings');
		if (projectScoped) {
			return projectScoped;
		}
	}

	return resolveCandidateWorkspacePaths(undefined, [
		'api/api-mappings/api-mapping.json',
		'api/api-mappings/api-mapping.example.json'
	])[0];
}

export function getCollectionProjectAssets(collectionPath: string, explicitEnvironmentPath?: string): ApiProjectAssets {
	const projectName = inferProjectNameFromCollectionPath(collectionPath);
	return {
		projectName,
		collectionPath,
		environmentPath: resolvePostmanEnvironmentPath(projectName, explicitEnvironmentPath),
		mappingPath: resolveMappingPath(projectName)
	};
}

export function discoverMappingFiles() {
	return listProjectFiles(toAbsolutePath('api', 'api-mappings'), (fileName) => fileName === 'api-mapping.json');
}

export function resolveLegacyMappingPath() {
	return resolveCandidateWorkspacePaths(undefined, [
		'api/api-mappings/api-mapping.json'
	])[0];
}

export function getMappingProjectName(mappingPath: string) {
	const projectName = inferProjectNameFromPath(mappingPath, toAbsolutePath('api', 'api-mappings'));
	return projectName || 'root';
}