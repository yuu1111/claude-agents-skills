// biome-ignore-all lint/suspicious/noExplicitAny: エンジンが実行時に渡すオブジェクトに型定義を同梱しないため

type Entry = {
	name: string;
	description: string;
	path: string;
	scope: "project" | "user";
};

const TRAILING = /[\\/]+$/;
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

function joinPath(base: string, name: string): string {
	return `${base.replace(TRAILING, "")}/${name}`;
}

function parentOf(path: string): string | null {
	const trimmed = path.replace(TRAILING, "");
	const cut = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
	if (cut < 0) return null;
	if (cut === 0) return trimmed.slice(0, 1);
	const head = trimmed.slice(0, cut);
	return /^[A-Za-z]:$/.test(head) ? `${head}/` : head;
}

function frontmatter(text: string): { name: string; description: string } {
	const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
	const body = block ? block[1] : "";
	const field = (key: string): string => {
		const found = new RegExp(`^${key}:[ \\t]*(.+)$`, "m").exec(body);
		if (!found) return "";
		return found[1]
			.trim()
			.replace(/^['"]|['"]$/g, "")
			.trim();
	};
	return {
		name: field("name"),
		description: field("description").replace(/\s+/g, " "),
	};
}

async function scanRoot(
	$: any,
	dir: string,
	scope: "project" | "user",
	out: Entry[],
	seen: Set<string>,
): Promise<void> {
	let items: any[];
	try {
		items = await $.fs.list(dir);
	} catch {
		return;
	}
	for (const item of items) {
		if (item.kind !== "dir" && !item.isLink) continue;
		const skillDir = joinPath(dir, item.name);
		if (seen.has(skillDir)) continue;
		seen.add(skillDir);
		let text: unknown;
		try {
			text = await $.fs.read(joinPath(skillDir, "SKILL.md"));
		} catch {
			continue;
		}
		if (typeof text !== "string") continue;
		const meta = frontmatter(text);
		const name = meta.name || item.name;
		if (!SKILL_NAME.test(name)) continue;
		out.push({
			name,
			description: meta.description,
			path: joinPath(skillDir, "SKILL.md"),
			scope,
		});
	}
}

function normalizePath(path: string): string {
	return path
		.replace(/[\\/]+/g, "/")
		.replace(/\/+$/, "")
		.toLowerCase();
}

async function isRepoRoot($: any, dir: string): Promise<boolean> {
	try {
		return await $.fs.exists(joinPath(dir, ".git"));
	} catch {
		return false;
	}
}

async function collectProjectRoots(
	$: any,
	cwd: string,
	homeKey: string,
): Promise<string[]> {
	const roots: string[] = [];
	let dir = cwd ? cwd.replace(TRAILING, "") : "";
	for (let depth = 0; dir && depth < 32; depth += 1) {
		if (homeKey && normalizePath(dir) === homeKey) break;
		roots.push(dir);
		if (await isRepoRoot($, dir)) break;
		const parent = parentOf(dir);
		if (!parent || parent === dir) break;
		dir = parent;
	}
	return roots;
}

async function discover($: any): Promise<Entry[]> {
	const found: Entry[] = [];
	const seen = new Set<string>();
	let cwd = "";
	try {
		cwd = await $.session.cwd();
	} catch {
		cwd = "";
	}
	const home =
		(await $.env.get("HOME")) ?? (await $.env.get("USERPROFILE")) ?? "";
	const roots = await collectProjectRoots(
		$,
		cwd,
		home ? normalizePath(home) : "",
	);
	for (const dir of roots) {
		await scanRoot($, joinPath(dir, ".agents/skills"), "project", found, seen);
	}
	if (home) {
		await scanRoot($, joinPath(home, ".agents/skills"), "user", found, seen);
	}
	const byName = new Map<string, Entry>();
	for (const entry of found)
		if (!byName.has(entry.name)) byName.set(entry.name, entry);
	return [...byName.values()];
}

function catalog(entries: Entry[]): string {
	return [
		"Agent Skills shared through .agents/skills, the same files other coding agents read.",
		'Invoke a matching one with the Skill tool as Skill({ skill: "<name>", args: "<text to pass>" }) instead of paraphrasing it.',
		...entries.map(
			(entry) => `- ${entry.name}: ${entry.description || "(no description)"}`,
		),
		"Skill text: " +
			entries.map((entry) => `${entry.name} -> ${entry.path}`).join(" | "),
	].join("\n");
}

async function bodyOf(
	$: any,
	entry: Entry,
	args: string,
): Promise<string | null> {
	try {
		const text = await $.fs.read(entry.path);
		if (typeof text !== "string") return null;
		return text
			.replace(FRONTMATTER, "")
			.split("$ARGUMENTS")
			.join(args ?? "");
	} catch {
		return null;
	}
}

let entries: Entry[] = [];
let loaded = false;

async function loadEntries($: any, refresh: boolean): Promise<Entry[]> {
	if (loaded && !refresh) return entries;
	try {
		entries = await discover($);
		loaded = true;
	} catch {
		loaded = true;
	}
	return entries;
}

export function register(on: any): void {
	const registered = new Set<string>();
	const nativeNames = new Set<string>();

	on("session.start", async ($: any, e: any, next: any) => {
		const list = await loadEntries($, true);
		let taken: Set<string>;
		try {
			taken = new Set(
				(await $.command.list()).map((command: any) => command.name),
			);
		} catch {
			taken = new Set();
		}
		for (const entry of list) {
			if (registered.has(entry.name)) continue;
			if (taken.has(entry.name)) {
				nativeNames.add(entry.name);
				continue;
			}
			try {
				await $.command.register({
					name: entry.name,
					description: entry.description || entry.name,
				});
				registered.add(entry.name);
			} catch {
				// 組み込みコマンドと衝突した場合はネイティブ側を優先する
				nativeNames.add(entry.name);
			}
		}
		return next(e);
	});

	on("prompt.compose", async ($: any, e: any, next: any) => {
		const composed = await next(e);
		const list = await loadEntries($, false);
		if (!list.length) return composed;
		const sections = composed?.sections ?? [];
		return {
			sections: [
				...sections,
				{ id: "agents_skills", text: catalog(list), scope: "session" },
			],
		};
	});

	on("command.run", async ($: any, e: any, next: any) => {
		if (nativeNames.has(e.command)) return next(e);
		const list = await loadEntries($, false);
		const entry = list.find((candidate) => candidate.name === e.command);
		if (!entry) return next(e);
		const body = await bodyOf($, entry, e.args ?? "");
		if (body === null) return next(e);
		return { text: body };
	}).catch((_$: any, e: any, next: any) => next(e));

	on("tool.call", { tool: "Skill" }, async ($: any, e: any, next: any) => {
		if (nativeNames.has(e.skill)) return next(e);
		const list = await loadEntries($, false);
		const entry = list.find((candidate) => candidate.name === e.skill);
		if (!entry) return next(e);
		const body = await bodyOf($, entry, e.args ?? "");
		if (body === null) return next(e);
		return {
			result: { success: true, commandName: entry.name },
			context: [body],
		};
	}).catch((_$: any, e: any, next: any) => next(e));
}
