import { readFileSync } from 'node:fs';
import { ApiFormDataEntry, ApiHeaderEntry, ApiQueryParamEntry, ParsedApiSource, NormalizedApiRequest, ApiRequestBody, ApiRequestSaveMap, JsonValue } from './apiTypes';

interface PostmanHeaderEntry {
	key?: string;
	value?: string;
	disabled?: boolean;
	type?: string;
}

interface PostmanQueryEntry {
	key?: string;
	value?: string;
	disabled?: boolean;
}

interface PostmanUrl {
	raw?: string;
	protocol?: string;
	host?: string[];
	path?: string[];
	query?: PostmanQueryEntry[];
}

interface PostmanBody {
	mode?: string;
	raw?: string;
	graphql?: { query?: string; variables?: unknown };
	formdata?: Array<{ key?: string; value?: string; fileName?: string; contentType?: string; disabled?: boolean; type?: string }>;
	urlencoded?: Array<{ key?: string; value?: string; disabled?: boolean; type?: string }>;
	options?: { raw?: { language?: string } };
}

interface PostmanRequestAuth {
	type?: string;
	bearer?: Array<{ key?: string; value?: string }>;
}

interface PostmanRequest {
	method?: string;
	header?: PostmanHeaderEntry[];
	url?: PostmanUrl;
	body?: PostmanBody;
	auth?: PostmanRequestAuth;
}

interface PostmanCollectionItem {
	name?: string;
	item?: PostmanCollectionItem[];
	request?: PostmanRequest;
	response?: Array<{ code?: number }>;
	expectedStatus?: number;
	expected?: { status?: number };
	save?: ApiRequestSaveMap;
	folderPath?: string[];
	itemPath?: string[];
}

interface PostmanCollection {
	info?: { name?: string };
	item?: PostmanCollectionItem[];
	variable?: Array<{ key?: string; value?: string }>;
	auth?: PostmanRequestAuth;
}

export interface PostmanEnvironmentFile {
	name?: string;
	values?: Array<{ key?: string; value?: string; current?: string; enabled?: boolean }>;
	variable?: Array<{ key?: string; value?: string; current?: string; enabled?: boolean }>;
}

function isEnabled<T extends { disabled?: boolean; enabled?: boolean }>(entry: T) {
	if (typeof entry.disabled === 'boolean') {
		return !entry.disabled;
	}

	if (typeof entry.enabled === 'boolean') {
		return entry.enabled;
	}

	return true;
}

function normalizeHeaders(headers: PostmanHeaderEntry[] | undefined): ApiHeaderEntry[] {
	return (headers ?? [])
		.filter((header) => Boolean(header.key))
		.map((header) => ({
			key: String(header.key),
			value: String(header.value ?? ''),
			enabled: isEnabled(header),
			kind: header.type
		}));
}

function normalizeQueryParams(query: PostmanQueryEntry[] | undefined): ApiQueryParamEntry[] {
	return (query ?? [])
		.filter((entry) => Boolean(entry.key))
		.map((entry) => ({
			key: String(entry.key),
			value: String(entry.value ?? ''),
			enabled: isEnabled(entry)
		}));
}

function normalizeFormData(entries: Array<{ key?: string; value?: string; fileName?: string; contentType?: string; disabled?: boolean; type?: string }> | undefined): ApiFormDataEntry[] {
	return (entries ?? [])
		.filter((entry) => Boolean(entry.key))
		.map((entry) => ({
			key: String(entry.key),
			value: entry.value,
			fileName: entry.fileName,
			contentType: entry.contentType,
			enabled: isEnabled(entry),
			kind: entry.type
		}));
}

function normalizeUrl(requestUrl: PostmanUrl | undefined) {
	if (!requestUrl) {
		return '';
	}

	if (requestUrl.raw) {
		return requestUrl.raw;
	}

	const protocol = requestUrl.protocol ? `${requestUrl.protocol}://` : '';
	const host = Array.isArray(requestUrl.host) ? requestUrl.host.join('.') : '';
	const path = Array.isArray(requestUrl.path) ? `/${requestUrl.path.join('/')}` : '';
	const query = (requestUrl.query ?? [])
		.filter((entry: PostmanQueryEntry) => Boolean(entry.key) && isEnabled(entry))
		.map((entry: PostmanQueryEntry) => `${encodeURIComponent(String(entry.key))}=${encodeURIComponent(String(entry.value ?? ''))}`)
		.join('&');

	return `${protocol}${host}${path}${query ? `?${query}` : ''}`;
}

function normalizeBody(requestBody: PostmanBody | undefined): ApiRequestBody | undefined {
	if (!requestBody || !requestBody.mode) {
		return undefined;
	}

	if (requestBody.mode === 'graphql') {
		return {
			mode: 'graphql',
			graphql: {
				query: String(requestBody.graphql?.query ?? ''),
				variables: requestBody.graphql?.variables as JsonValue | string | undefined
			}
		};
	}

	if (requestBody.mode === 'formdata') {
		return {
			mode: 'formdata',
			formData: normalizeFormData(requestBody.formdata)
		};
	}

	if (requestBody.mode === 'urlencoded') {
		return {
			mode: 'urlencoded',
			urlencoded: (requestBody.urlencoded ?? [])
				.filter((entry: { key?: string; value?: string; disabled?: boolean; type?: string }) => Boolean(entry.key))
				.map((entry: { key?: string; value?: string; disabled?: boolean; type?: string }) => ({
					key: String(entry.key),
					value: String(entry.value ?? ''),
					enabled: isEnabled(entry)
				}))
		};
	}

	if (requestBody.mode === 'raw') {
		const raw = String(requestBody.raw ?? '').trim();
		if (!raw) {
			return { mode: 'none' };
		}

		try {
			return { mode: 'raw', raw: JSON.parse(raw) };
		} catch {
			return { mode: 'raw', raw };
		}
	}

	return { mode: 'none' };
}

function normalizeExpected(item: PostmanCollectionItem) {
	const status = item.expectedStatus ?? item.expected?.status ?? item.response?.find((response) => typeof response.code === 'number')?.code;
	return typeof status === 'number' ? { status } : undefined;
}

function normalizeSave(item: PostmanCollectionItem) {
	return item.save && Object.keys(item.save).length ? item.save : undefined;
}

function normalizeRequest(item: PostmanCollectionItem, folderPath: string[], inheritedAuth?: PostmanCollection['auth'], inheritedVariables?: Record<string, string>, collectionName?: string, filePath = ''): NormalizedApiRequest[] {
	if (item.item?.length) {
		const nextFolderPath = [...folderPath, item.name ?? 'Unnamed Folder'];
		return item.item.flatMap((child) => normalizeRequest(child, nextFolderPath, inheritedAuth, inheritedVariables, collectionName, filePath));
	}

	if (!item.request) {
		return [];
	}

	const requestName = item.name ?? 'Unnamed Request';
	const headers = normalizeHeaders(item.request.header);
	const requestAuth = item.request.auth ?? inheritedAuth;
	const authHeader = requestAuth?.type === 'bearer'
		? requestAuth.bearer?.find((entry: { key?: string; value?: string }) => entry.key === 'token' || entry.key === 'bearerToken' || entry.key === 'value')?.value
		: undefined;

	if (authHeader && !headers.some((header) => header.key.toLowerCase() === 'authorization')) {
		headers.push({ key: 'Authorization', value: `Bearer ${authHeader}`, enabled: true });
	}

	return [{
		name: requestName,
		method: String(item.request.method ?? 'GET').toUpperCase() as NormalizedApiRequest['method'],
		url: normalizeUrl(item.request.url),
		headers,
		queryParams: normalizeQueryParams(item.request.url?.query),
		body: normalizeBody(item.request.body),
		expected: normalizeExpected(item),
		save: normalizeSave(item),
		source: {
			kind: 'postman',
			filePath,
			folderPath,
			itemPath: [...folderPath, requestName],
			collectionName
		},
		contextVariables: inheritedVariables
	}];
}

export function parsePostmanEnvironment(filePath: string) {
	const raw = readFileSync(filePath, 'utf8');
	const parsed = JSON.parse(raw) as PostmanEnvironmentFile;
	const values = parsed.values ?? parsed.variable ?? [];

	return Object.fromEntries(
		values
			.filter((entry) => Boolean(entry.key) && (typeof entry.enabled === 'undefined' || entry.enabled))
			.map((entry) => [String(entry.key), String(entry.current ?? entry.value ?? '')])
			.filter(([, value]) => typeof value === 'string')
	) as Record<string, string>;
}

export function parsePostmanCollection(filePath: string): ParsedApiSource {
	const raw = readFileSync(filePath, 'utf8');
	const parsed = JSON.parse(raw) as PostmanCollection;
	const collectionVariables = Object.fromEntries(
		(parsed.variable ?? [])
			.filter((entry) => Boolean(entry.key))
			.map((entry) => [String(entry.key), String(entry.value ?? '')])
	) as Record<string, string>;

	const requests = (parsed.item ?? []).flatMap((item) => normalizeRequest(item, [], parsed.auth, collectionVariables, parsed.info?.name, filePath));

	return {
		name: parsed.info?.name ?? 'Postman Collection',
		requests,
		variables: collectionVariables,
		filePath,
		kind: 'postman'
	};
}