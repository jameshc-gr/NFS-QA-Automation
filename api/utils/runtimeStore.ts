function parsePathSegments(pathExpression: string) {
	return pathExpression
		.split('.')
		.flatMap((segment) => segment.split(/\[(\d+)\]/g))
		.map((segment) => segment.trim())
		.filter(Boolean);
}

export function getValueByPath(source: unknown, pathExpression: string) {
	if (!pathExpression) {
		return undefined;
	}

	const segments = parsePathSegments(pathExpression);
	let current: unknown = source;

	for (const segment of segments) {
		if (current == null) {
			return undefined;
		}

		if (Array.isArray(current)) {
			const index = Number(segment);
			current = Number.isInteger(index) ? current[index] : undefined;
			continue;
		}

		if (typeof current !== 'object') {
			return undefined;
		}

		current = (current as Record<string, unknown>)[segment];
	}

	return current;
}

export class RuntimeStore {
	private readonly values = new Map<string, unknown>();

	set(name: string, value: unknown) {
		this.values.set(name, value);
	}

	get(name: string) {
		return this.values.get(name);
	}

	has(name: string) {
		return this.values.has(name);
	}

	entries() {
		return Object.fromEntries(this.values.entries());
	}

	resolve(name: string) {
		return this.values.get(name);
	}

	saveFromPath(targetName: string, source: unknown, pathExpression: string) {
		const value = getValueByPath(source, pathExpression);
		if (typeof value === 'undefined') {
			throw new Error(`Unable to save runtime value "${targetName}" from path "${pathExpression}"`);
		}

		this.values.set(targetName, value);
		return value;
	}

	load(values: Record<string, unknown>) {
		for (const [key, value] of Object.entries(values)) {
			this.values.set(key, value);
		}
	}

	clear() {
		this.values.clear();
	}
}

export function createRuntimeStore(initialValues: Record<string, unknown> = {}) {
	const store = new RuntimeStore();
	store.load(initialValues);
	return store;
}

export function toRuntimeStoreSnapshot(store: RuntimeStore) {
	return store.entries();
}