// biome-ignore-all lint/suspicious/noExplicitAny: エンジンが実行時に渡すオブジェクトに型定義を同梱しないため
// Claude Code は .agents/skills をネイティブに読まないため
// skills を探索して prompt.context へ一覧を出し 同名の slash command を登録する

type Entry = {
	name: string;
	description: string;
	path: string;
	scope: "project" | "user";
};

const TRAILING = /[\\/]+$/;
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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

async function discover($: any): Promise<Entry[]> {
	const found: Entry[] = [];
	const seen = new Set<string>();
	let cwd = "";
	try {
		cwd = await $.session.cwd();
	} catch {
		cwd = "";
	}
	let dir = cwd ? cwd.replace(TRAILING, "") : "";
	for (let depth = 0; dir && depth < 32; depth += 1) {
		await scanRoot($, joinPath(dir, ".agents/skills"), "project", found, seen);
		const parent = parentOf(dir);
		if (!parent || parent === dir) break;
		dir = parent;
	}
	const home = (await $.env.get("HOME")) ?? (await $.env.get("USERPROFILE"));
	if (home)
		await scanRoot($, joinPath(home, ".agents/skills"), "user", found, seen);
	const byName = new Map<string, Entry>();
	for (const entry of found)
		if (!byName.has(entry.name)) byName.set(entry.name, entry);
	return [...byName.values()];
}

function catalog(entries: Entry[]): string {
	const lines = entries.map(
		(entry) =>
			`- ${entry.name}: ${entry.description || "(no description)"} — ${entry.path}`,
	);
	return [
		"Agent Skills shared through .agents/skills (the same files other coding agents read):",
		...lines,
		"When a task matches one of these skills, read its SKILL.md with the Read tool and follow it.",
	].join("\n");
}

let entries: Entry[] | null = null;

async function loadEntries($: any, refresh: boolean): Promise<Entry[]> {
	if (entries && !refresh) return entries;
	try {
		entries = await discover($);
	} catch {
		entries = entries ?? [];
	}
	return entries ?? [];
}

export function register(on: any): void {
	const registered = new Set<string>();

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
			if (taken.has(entry.name) || registered.has(entry.name)) continue;
			try {
				await $.command.register({
					name: entry.name,
					description: entry.description || entry.name,
				});
				registered.add(entry.name);
			} catch {
				// 組み込みコマンドと衝突した場合はネイティブ側を優先する
			}
		}
		return next(e);
	});

	on("prompt.context", async ($: any, e: any, next: any) => {
		const list = await loadEntries($, false);
		if (!list.length) return next(e);
		return next({
			...e,
			blocks: [...e.blocks, { name: "agentsSkills", text: catalog(list) }],
		});
	});

	on("command.run", async ($: any, e: any, next: any) => {
		const list = await loadEntries($, false);
		const entry = list.find((candidate) => candidate.name === e.command);
		if (!entry) return next(e);
		let text = "";
		try {
			text = await $.fs.read(entry.path);
		} catch {
			return next(e);
		}
		const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
		return { text: body.split("$ARGUMENTS").join(e.args ?? "") };
	}).catch((_$: any, e: any, next: any) => next(e));
}
