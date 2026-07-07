import crypto from 'node:crypto';
import { ApiRequestBody, ResolvedTemplateResult, VariableResolutionContext } from './apiTypes';
import { RuntimeStore } from './runtimeStore';

const PLACEHOLDER_PATTERN = /{{\s*([^{}]+?)\s*}}/g;

function toSnakeCase(value: string) {
	return value
		.replace(/([a-z0-9])([A-Z])/g, '$1_$2')
		.replace(/[^a-zA-Z0-9]+/g, '_')
		.replace(/__+/g, '_')
		.replace(/^_+|_+$/g, '')
		.toUpperCase();
}

function buildCandidateEnvNames(variableName: string) {
	const trimmed = variableName.trim();
	const upperSnake = toSnakeCase(trimmed);
	const lowerSnake = upperSnake.toLowerCase();

	return Array.from(new Set([
		trimmed,
		trimmed.toUpperCase(),
		upperSnake,
		lowerSnake
	].filter(Boolean)));
}

function isRuntimeStore(input: unknown): input is RuntimeStore {
	return Boolean(input && typeof input === 'object' && 'resolve' in input && typeof (input as RuntimeStore).resolve === 'function');
}

function resolveFromRuntime(variableName: string, context: VariableResolutionContext) {
	if (isRuntimeStore(context.runtimeValues)) {
		return context.runtimeValues.resolve(variableName);
	}

	return context.runtimeValues[variableName];
}

function resolveFromMap(variableName: string, values: Record<string, string>) {
	return Object.prototype.hasOwnProperty.call(values, variableName) ? values[variableName] : undefined;
}

function resolveFromProcessEnv(variableName: string, processValues: NodeJS.ProcessEnv | undefined) {
	if (!processValues) {
		return undefined;
	}

	for (const candidate of buildCandidateEnvNames(variableName)) {
		const value = processValues[candidate];
		if (typeof value !== 'undefined' && value !== '') {
			return value;
		}
	}

	return undefined;
}

function resolveDynamicVariable(variableName: string) {
	const normalized = variableName.trim().replace(/^\$/, '');

	switch (normalized) {
		case 'guid':
		case 'uuid':
		case 'randomUUID':
			return crypto.randomUUID();
		case 'timestamp':
			return String(Date.now());
		default:
			return undefined;
	}
}

function resolveVariable(variableName: string, context: VariableResolutionContext) {
	const runtimeValue = resolveFromRuntime(variableName, context);
	if (typeof runtimeValue !== 'undefined') {
		return runtimeValue;
	}

	const environmentValue = resolveFromMap(variableName, context.environmentValues);
	if (typeof environmentValue !== 'undefined') {
		return environmentValue;
	}

	if (context.collectionValues) {
		const collectionValue = resolveFromMap(variableName, context.collectionValues);
		if (typeof collectionValue !== 'undefined') {
			return collectionValue;
		}
	}

	const processValue = resolveFromProcessEnv(variableName, context.processValues ?? process.env);
	if (typeof processValue !== 'undefined') {
		return processValue;
	}

	return resolveDynamicVariable(variableName);
}

function resolveStringTemplate(template: string, context: VariableResolutionContext, location: string) {
	const unresolved: Array<{ variable: string; location: string }> = [];
	let current = template;
	let iterations = 0;

	while (iterations < 10 && PLACEHOLDER_PATTERN.test(current)) {
		iterations += 1;
		PLACEHOLDER_PATTERN.lastIndex = 0;
		let changed = false;

		current = current.replace(PLACEHOLDER_PATTERN, (match, rawVariableName: string) => {
			const variableName = String(rawVariableName || '').trim();
			const resolved = resolveVariable(variableName, context);
			if (typeof resolved === 'undefined' || resolved === null) {
				unresolved.push({ variable: variableName, location });
				return match;
			}

			changed = true;
			return String(resolved);
		});

		if (!changed) {
			break;
	}
	}

	return { value: current, unresolved };
}

function isBarePlaceholder(template: string) {
	const trimmed = template.trim();
	const match = trimmed.match(/^{{\s*([^{}]+?)\s*}}$/);
	return match?.[1]?.trim();
}

function resolveTemplateValue<T>(value: T, context: VariableResolutionContext, location: string): ResolvedTemplateResult<T> {
	if (value == null) {
		return { value, unresolved: [] };
	}

	if (typeof value === 'string') {
		const barePlaceholder = isBarePlaceholder(value);
		if (barePlaceholder) {
			const resolved = resolveVariable(barePlaceholder, context);
			if (typeof resolved === 'undefined' || resolved === null) {
				return {
					value,
					unresolved: [{ variable: barePlaceholder, location }]
				};
			}

			return { value: resolved as T, unresolved: [] };
		}

		const result = resolveStringTemplate(value, context, location);
		return { value: result.value as T, unresolved: result.unresolved };
	}

	if (Array.isArray(value)) {
		const resolvedArray: unknown[] = [];
		const unresolved: Array<{ variable: string; location: string }> = [];

		for (let index = 0; index < value.length; index += 1) {
			const itemResult = resolveTemplateValue(value[index], context, `${location}[${index}]`);
			resolvedArray.push(itemResult.value);
			unresolved.push(...itemResult.unresolved);
		}

		return { value: resolvedArray as T, unresolved };
	}

	if (typeof value === 'object') {
		const resolvedObject: Record<string, unknown> = {};
		const unresolved: Array<{ variable: string; location: string }> = [];

		for (const [key, childValue] of Object.entries(value as Record<string, unknown>)) {
			const childResult = resolveTemplateValue(childValue, context, `${location}.${key}`);
			resolvedObject[key] = childResult.value;
			unresolved.push(...childResult.unresolved);
		}

		return { value: resolvedObject as T, unresolved };
	}

	return { value, unresolved: [] };
}

export function resolveTemplate<T>(value: T, context: VariableResolutionContext, location = context.location || context.requestName): ResolvedTemplateResult<T> {
	return resolveTemplateValue(value, context, location);
}

export function resolveRequestBody(body: ApiRequestBody | undefined, context: VariableResolutionContext) {
	if (!body) {
		return { value: undefined, unresolved: [] };
	}

	return resolveTemplate(body, context, `${context.requestName}.body`);
}

export function resolveRequestInput<T>(value: T, context: VariableResolutionContext, location = context.requestName) {
	return resolveTemplate(value, context, location);
}

export function throwOnUnresolvedVariables(requestName: string, unresolved: Array<{ variable: string; location: string }>) {
	if (!unresolved.length) {
		return;
	}

	const summary = unresolved
		.map((item) => `${item.variable} at ${item.location}`)
		.join(', ');
	throw new Error(`[${requestName}] Unresolved variables: ${summary}`);
}