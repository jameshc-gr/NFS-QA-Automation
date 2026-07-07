import { type APIRequestContext } from '@playwright/test';
import { ApiRequestBody, ExecutedApiRequest, ParsedApiSource, NormalizedApiRequest } from './apiTypes';
import { executeApiRequest, mergeHeaders } from './apiClient';
import { assertApiResponse } from './assertions';
import { RuntimeStore, getValueByPath } from './runtimeStore';
import { resolveRequestInput, resolveRequestBody, throwOnUnresolvedVariables } from './variableResolver';

function filterEnabledHeaders(headers: NormalizedApiRequest['headers']) {
	return Object.fromEntries(
		headers
			.filter((header) => header.enabled !== false)
			.map((header) => [header.key, header.value])
	) as Record<string, string>;
}

function filterEnabledQueryParams(queryParams: NormalizedApiRequest['queryParams']) {
	return Object.fromEntries(
		queryParams
			.filter((entry) => entry.enabled !== false)
			.map((entry) => [entry.key, entry.value ?? ''])
	) as Record<string, string>;
}

function buildRequestBody(body: ApiRequestBody | undefined, context: Parameters<typeof resolveRequestBody>[1], requestName: string) {
	if (!body) {
		return undefined;
	}

	const resolved = resolveRequestBody(body, { ...context, requestName });
	throwOnUnresolvedVariables(requestName, resolved.unresolved);
	return resolved.value;
}

function saveRuntimeValues(store: RuntimeStore, request: NormalizedApiRequest, responseJson: unknown) {
	if (!request.save) {
		return;
	}

	for (const [variableName, pathExpression] of Object.entries(request.save)) {
		const savedValue = getValueByPath(responseJson, pathExpression);
		if (typeof savedValue === 'undefined') {
			throw new Error(`[${request.name}] Unable to save "${variableName}" from response path "${pathExpression}"`);
		}

		store.set(variableName, savedValue);
	}
}

function resolveExecutionContext(source: ParsedApiSource, request: NormalizedApiRequest, runtimeStore: RuntimeStore, environmentValues: Record<string, string>) {
	return {
		runtimeValues: runtimeStore as unknown as Record<string, unknown>,
		environmentValues,
		collectionValues: {
			...source.variables,
			...(request.contextVariables ?? {})
		},
		processValues: process.env,
		requestName: request.name,
		location: request.name
	};
}

export async function runApiRequest(requestContext: APIRequestContext, source: ParsedApiSource, request: NormalizedApiRequest, environmentValues: Record<string, string>, runtimeStore = new RuntimeStore()) {
	const requestContextValues = resolveExecutionContext(source, request, runtimeStore, environmentValues);

	const resolvedUrl = resolveRequestInput(request.url, requestContextValues, `${request.name}.url`);
	throwOnUnresolvedVariables(request.name, resolvedUrl.unresolved);

	const resolvedHeaders = resolveRequestInput(filterEnabledHeaders(request.headers), requestContextValues, `${request.name}.headers`);
	throwOnUnresolvedVariables(request.name, resolvedHeaders.unresolved);

	const resolvedQueryParams = resolveRequestInput(filterEnabledQueryParams(request.queryParams), requestContextValues, `${request.name}.queryParams`);
	throwOnUnresolvedVariables(request.name, resolvedQueryParams.unresolved);

	const resolvedBody = buildRequestBody(request.body, requestContextValues, request.name);
	const mergedHeaders = mergeHeaders(resolvedHeaders.value, resolvedBody && resolvedBody.mode === 'raw' && typeof resolvedBody.raw === 'object' && resolvedBody.raw !== null ? { 'Content-Type': 'application/json' } : undefined);

	const executedRequest: ExecutedApiRequest = {
		requestName: request.name,
		method: request.method,
		url: String(resolvedUrl.value),
		headers: mergedHeaders,
		queryParams: resolvedQueryParams.value,
		body: resolvedBody
	};

	const response = await executeApiRequest(requestContext, executedRequest);
	assertApiResponse(response, request.expected, request.name);
	saveRuntimeValues(runtimeStore, request, response.json ?? (() => {
		try {
			return JSON.parse(response.text);
		} catch {
			return undefined;
		}
	})());

	return response;
}

export async function runApiSource(requestContext: APIRequestContext, source: ParsedApiSource, environmentValues: Record<string, string>, runtimeStore = new RuntimeStore()) {
	for (const request of source.requests) {
		await runApiRequest(requestContext, source, request, environmentValues, runtimeStore);
	}

	return runtimeStore.entries();
}