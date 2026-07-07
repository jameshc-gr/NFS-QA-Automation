import { existsSync } from 'node:fs';
import path from 'node:path';

export function resolveWorkspacePath(inputPath: string | undefined, fallbackCandidates: string[]) {
	const candidates = [inputPath, ...fallbackCandidates].filter((candidate): candidate is string => Boolean(candidate));

	for (const candidate of candidates) {
		const normalized = candidate.trim();
		if (!normalized) {
			continue;
		}

		const absolute = path.isAbsolute(normalized) ? normalized : path.resolve(process.cwd(), normalized);
		if (existsSync(absolute)) {
			return absolute;
		}
	}

	const attempted = candidates.join(', ');
	throw new Error(`Unable to resolve a file path from: ${attempted}`);
}

export function resolveCandidateWorkspacePaths(inputPath: string | undefined, fallbackCandidates: string[]) {
	const candidates = [inputPath, ...fallbackCandidates].filter((candidate): candidate is string => Boolean(candidate));
	const resolvedPaths: string[] = [];

	for (const candidate of candidates) {
		const normalized = candidate.trim();
		if (!normalized) {
			continue;
		}

		const variants = path.isAbsolute(normalized)
			? [normalized]
			: [
				path.resolve(process.cwd(), normalized),
				path.resolve(process.cwd(), 'api', normalized)
			];

		for (const variant of variants) {
			if (existsSync(variant) && !resolvedPaths.includes(variant)) {
				resolvedPaths.push(variant);
			}
		}
	}

	return resolvedPaths;
}