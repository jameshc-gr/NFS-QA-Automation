import { APIRequestContext } from '@playwright/test';
import { ApiRequestBody, ExecutedApiRequest, ExecutedApiResponse } from './apiTypes';

function sanitizeUrl(url: string) {
	try {
		const parsed = new URL(url);
		for (const [key] of parsed.searchParams.entries()) {
			if (/token|secret|password|key|authorization/i.test(key)) {
				parsed.searchParams.set(key, '***');
			}
		}

		return parsed.toString();
	} catch {
		return url;
	}
}

function normalizeHeaders(headers?: Record<string, string>) {
	const normalized: Record<string, string> = {};

	for (const [key, value] of Object.entries(headers ?? {})) {
		if (typeof value === 'undefined' || value === null) {
			continue;
		}

		normalized[key] = String(value);
	}

	return normalized;
}

function bodyToFetchOptions(body: ApiRequestBody | undefined) {
	if (!body || body.mode === 'none') {
		return {};
	}

	if (body.mode === 'graphql') {
		return {
			data: {
				query: body.graphql?.query ?? '',
				variables: body.graphql?.variables ?? undefined
			}
		};
	}

	if (body.mode === 'urlencoded') {
		return {
			form: Object.fromEntries((body.urlencoded ?? []).map((entry) => [entry.key, entry.value ?? '']))
		};
	}

	if (body.mode === 'formdata') {
		const multipart = Object.fromEntries(
			(body.formData ?? [])
				.filter((entry) => entry.enabled !== false)
				.map((entry) => [entry.key, entry.value ?? ''])
		);

		return {
			multipart
		};
	}

	const rawBody = body.raw;
	if (typeof rawBody === 'undefined') {
		return {};
	}

	if (typeof rawBody === 'string') {
		const trimmed = rawBody.trim();
		if (!trimmed) {
			return {};
		}

		try {
			return { data: JSON.parse(trimmed) };
		} catch {
			return { data: rawBody };
		}
	}

	return { data: rawBody };
}

export async function executeApiRequest(requestContext: APIRequestContext, input: ExecutedApiRequest): Promise<ExecutedApiResponse> {
	const startedAt = Date.now();
	const headers = normalizeHeaders(input.headers);
	const sanitizedUrl = sanitizeUrl(input.url);
	const params = Object.fromEntries(
		Object.entries(input.queryParams ?? {}).filter(([, value]) => typeof value !== 'undefined')
	) as Record<string, string | number | boolean>;

	console.log(`[API] ${input.requestName} -> ${input.method} ${sanitizedUrl}`);

	const response = await requestContext.fetch(input.url, {
		method: input.method,
		headers,
		params,
		failOnStatusCode: false,
		...bodyToFetchOptions(input.body)
	});

	const text = await response.text();
	let json: unknown;

	try {
		json = text ? JSON.parse(text) : undefined;
	} catch {
		json = undefined;
	}

	const result: ExecutedApiResponse = {
		requestName: input.requestName,
		method: input.method,
		url: input.url,
		status: response.status(),
		headers: Object.fromEntries(Object.entries(response.headers()).map(([key, value]) => [key.toLowerCase(), value])),
		text,
		json,
		durationMs: Date.now() - startedAt
	};

	console.log(`[API] ${input.requestName} <- ${result.status} (${result.durationMs}ms)`);
	return result;
}

export function mergeHeaders(...headerSets: Array<Record<string, string> | undefined>) {
	return headerSets.reduce<Record<string, string>>((accumulator, headerSet) => {
		for (const [key, value] of Object.entries(headerSet ?? {})) {
			if (typeof value === 'undefined' || value === null || value === '') {
				continue;
			}

			accumulator[key] = String(value);
		}

		return accumulator;
	}, {});
}