import { readFileSync } from 'node:fs';
import { ApiExpectedAssertions, ApiHeaderEntry, ApiQueryParamEntry, ApiRequestBody, ApiRequestSaveMap, NormalizedApiRequest, ParsedApiSource } from './apiTypes';

interface ApiMappingFile {
	apis?: Array<{
		name?: string;
		method?: string;
		endpoint?: string;
		headers?: Record<string, string>;
		query?: Record<string, string | number | boolean | undefined>;
		body?: unknown;
		expected?: ApiExpectedAssertions;
		save?: ApiRequestSaveMap;
		variables?: Record<string, string>;
	}>;
	variables?: Record<string, string>;
}

function splitEndpoint(endpoint: string) {
	const queryIndex = endpoint.indexOf('?');
	if (queryIndex < 0) {
		return { endpoint, queryParams: {} as Record<string, string> };
	}

	const queryString = endpoint.slice(queryIndex + 1);
	const queryParams = Object.fromEntries(new URLSearchParams(queryString).entries());
	return {
		endpoint: endpoint.slice(0, queryIndex),
		queryParams
	};
}

function normalizeHeaders(headers: Record<string, string> | undefined): ApiHeaderEntry[] {
	return Object.entries(headers ?? {}).map(([key, value]) => ({ key, value: String(value), enabled: true }));
}

function normalizeQueryParams(query: Record<string, string | number | boolean | undefined> | undefined): ApiQueryParamEntry[] {
	return Object.entries(query ?? {})
		.map(([key, value]) => ({ key, value: typeof value === 'undefined' ? '' : String(value), enabled: true }));
}

function normalizeBody(body: unknown, headers?: Record<string, string>): ApiRequestBody | undefined {
	if (typeof body === 'undefined' || body === null) {
		return undefined;
	}

	if (typeof body === 'object' && !Array.isArray(body) && body && ('mode' in body || 'raw' in body || 'graphql' in body || 'formData' in body || 'urlencoded' in body)) {
		const candidate = body as ApiRequestBody;
		return candidate.mode === 'raw' && typeof candidate.raw === 'object' && candidate.raw !== null
			? { ...candidate, mode: 'raw', raw: candidate.raw }
			: candidate;
	}

	const contentType = Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === 'content-type')?.[1];
	if (typeof body === 'string') {
		const trimmed = body.trim();
		if (!trimmed) {
			return { mode: 'none' };
		}

		if (/application\/json/i.test(contentType ?? '')) {
			try {
				return { mode: 'raw', raw: JSON.parse(trimmed), contentType };
			} catch {
				return { mode: 'raw', raw: trimmed, contentType };
			}
		}

		return { mode: 'raw', raw: trimmed, contentType };
	}

	return { mode: 'raw', raw: body as ApiRequestBody['raw'], contentType };
}

export function parseMappingFile(filePath: string): ParsedApiSource {
	const raw = readFileSync(filePath, 'utf8');
	const parsed = JSON.parse(raw) as ApiMappingFile;
	const requests: NormalizedApiRequest[] = [];

	for (const api of parsed.apis ?? []) {
		if (!api.name || !api.method || !api.endpoint) {
			continue;
		}

		const split = splitEndpoint(api.endpoint);
		const headers = normalizeHeaders(api.headers);
		const combinedQuery = { ...split.queryParams, ...(api.query ?? {}) };
		const body = normalizeBody(api.body, api.headers);

		requests.push({
			name: api.name,
			method: api.method.toUpperCase() as NormalizedApiRequest['method'],
			url: split.endpoint,
			headers,
			queryParams: normalizeQueryParams(combinedQuery),
			body,
			expected: api.expected,
			save: api.save,
			source: {
				kind: 'mapping',
				filePath,
				folderPath: [],
				itemPath: [api.name],
				collectionName: parsed.variables?.name
			},
			contextVariables: { ...parsed.variables, ...(api.variables ?? {}) }
		});
	}

	return {
		name: 'API Mapping',
		requests,
		variables: parsed.variables ?? {},
		filePath,
		kind: 'mapping'
	};
}