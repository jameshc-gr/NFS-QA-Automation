import { expect } from '@playwright/test';
import { ExecutedApiResponse } from './apiTypes';
import { getValueByPath } from './runtimeStore';

function normalizeText(value: unknown) {
	if (typeof value === 'string') {
		return value;
	}

	try {
		return JSON.stringify(value, null, 2);
	} catch {
		return String(value);
	}
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function containsSubset(actual: unknown, expected: unknown): boolean {
	if (isPlainObject(expected)) {
		if (!isPlainObject(actual)) {
			return false;
		}

		return Object.entries(expected).every(([key, expectedValue]) => containsSubset(actual[key], expectedValue));
	}

	if (Array.isArray(expected)) {
		if (!Array.isArray(actual) || actual.length < expected.length) {
			return false;
		}

		return expected.every((expectedItem, index) => containsSubset(actual[index], expectedItem));
	}

	return Object.is(actual, expected);
}

function ensureTextIncludes(actualText: string, expectedValue: unknown) {
	if (typeof expectedValue === 'string') {
		expect(actualText, `Expected response body to include string:\n${expectedValue}`).toContain(expectedValue);
		return;
	}

	const serializedExpected = normalizeText(expectedValue);
	expect(actualText, `Expected response body to include object fragment:\n${serializedExpected}`).toContain(serializedExpected.trim());
}

export function assertApiResponse(response: ExecutedApiResponse, expected?: {
	status?: number;
	bodyContains?: unknown;
	bodyPathEquals?: Record<string, unknown>;
	headerContains?: Record<string, string>;
	responseTimeLessThanMs?: number;
}, requestName = response.requestName) {
	if (typeof expected?.status === 'number') {
		expect(response.status, `[${requestName}] Expected status ${expected.status} but received ${response.status}`).toBe(expected.status);
	} else {
		expect(response.status, `[${requestName}] Expected status to be below 500 in smoke mode`).toBeLessThan(500);
	}

	if (typeof expected?.responseTimeLessThanMs === 'number') {
		expect(response.durationMs, `[${requestName}] Expected response time below ${expected.responseTimeLessThanMs}ms but received ${response.durationMs}ms`).toBeLessThan(expected.responseTimeLessThanMs);
	}

	if (typeof expected?.bodyContains !== 'undefined') {
		if (isPlainObject(expected.bodyContains) || Array.isArray(expected.bodyContains)) {
			expect(
				containsSubset(response.json ?? {}, expected.bodyContains),
				`[${requestName}] Expected JSON body to contain:\n${normalizeText(expected.bodyContains)}\nReceived:\n${normalizeText(response.json ?? response.text)}`
			).toBeTruthy();
		} else {
			ensureTextIncludes(response.text, expected.bodyContains);
		}
	}

	if (expected?.bodyPathEquals) {
		for (const [path, expectedValue] of Object.entries(expected.bodyPathEquals)) {
			const actualValue = getValueByPath(response.json, path);
			expect(
				actualValue,
				`[${requestName}] Expected response body path "${path}" to equal ${normalizeText(expectedValue)} but received ${normalizeText(actualValue)}`
			).toStrictEqual(expectedValue);
		}
	}

	if (expected?.headerContains) {
		for (const [headerName, expectedValue] of Object.entries(expected.headerContains)) {
			const actualValue = response.headers[headerName.toLowerCase()] ?? response.headers[headerName] ?? '';
			expect(
				actualValue,
				`[${requestName}] Expected header "${headerName}" to contain "${expectedValue}" but received "${actualValue}"`
			).toContain(expectedValue);
		}
	}
}