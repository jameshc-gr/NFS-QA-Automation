export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type RequestBodyMode = 'raw' | 'graphql' | 'formdata' | 'urlencoded' | 'none';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
	[key: string]: JsonValue;
}

export interface ApiHeaderEntry {
	key: string;
	value: string;
	enabled?: boolean;
	kind?: string;
}

export interface ApiQueryParamEntry {
	key: string;
	value?: string;
	enabled?: boolean;
}

export interface ApiFormDataEntry {
	key: string;
	value?: string;
	fileName?: string;
	contentType?: string;
	source?: string;
	enabled?: boolean;
	kind?: string;
}

export interface ApiRequestBody {
	mode: RequestBodyMode;
	raw?: string | JsonValue;
	graphql?: {
		query: string;
		variables?: JsonValue | string;
	};
	formData?: ApiFormDataEntry[];
	urlencoded?: ApiQueryParamEntry[];
	contentType?: string;
}

export interface ApiExpectedAssertions {
	status?: number;
	bodyContains?: unknown;
	bodyPathEquals?: Record<string, unknown>;
	headerContains?: Record<string, string>;
	responseTimeLessThanMs?: number;
}

export interface ApiRequestSaveMap {
	[variableName: string]: string;
}

export interface ApiRequestSourceInfo {
	kind: 'postman' | 'mapping';
	filePath: string;
	folderPath: string[];
	itemPath: string[];
	collectionName?: string;
}

export interface NormalizedApiRequest {
	name: string;
	method: HttpMethod;
	url: string;
	headers: ApiHeaderEntry[];
	queryParams: ApiQueryParamEntry[];
	body?: ApiRequestBody;
	expected?: ApiExpectedAssertions;
	save?: ApiRequestSaveMap;
	source: ApiRequestSourceInfo;
	contextVariables?: Record<string, string>;
}

export interface ParsedApiSource {
	name: string;
	requests: NormalizedApiRequest[];
	variables: Record<string, string>;
	filePath: string;
	kind: 'postman' | 'mapping';
}

export interface VariableResolutionContext {
	runtimeValues: Record<string, unknown>;
	environmentValues: Record<string, string>;
	collectionValues?: Record<string, string>;
	processValues?: NodeJS.ProcessEnv;
	requestName: string;
	location?: string;
}

export interface ResolvedTemplateResult<T> {
	value: T;
	unresolved: Array<{ variable: string; location: string }>;
}

export interface ExecutedApiResponse {
	status: number;
	headers: Record<string, string>;
	text: string;
	json?: unknown;
	durationMs: number;
	url: string;
	requestName: string;
	method: HttpMethod;
}

export interface ExecutedApiRequest {
	requestName: string;
	method: HttpMethod;
	url: string;
	headers?: Record<string, string>;
	queryParams?: Record<string, string | number | boolean | undefined>;
	body?: ApiRequestBody;
}