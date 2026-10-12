# claude-agents-skills

A Claude Code [mod](https://code.claude.com/docs/en/plugins/mods/overview) that loads Agent Skills from the shared `.agents/skills` directories into Claude Code.

[日本語](README.ja.md)

Claude Code reads `.claude/skills` and does not read `.agents/skills`. Codex, Cursor, OpenCode, Kilo Code and GitHub Copilot read `.agents/skills`. This mod closes that gap without copying files and without symlinks, so the same files stay the single source of truth.

## What it does

| Event | Behaviour |
| :- | :- |
| `session.start` | Registers every discovered skill as `/<name>`, skipping names Claude Code already provides |
| `prompt.compose` | Appends an `agents_skills` section to the system prompt that lists each skill with its description and path |
| `command.run` | Expands `/<name>` into that skill's body, replacing `$ARGUMENTS` with what the user typed |
| `tool.call` on `Skill` | Serves the skill body when the model invokes it through the Skill tool, so the model reaches `.agents/skills` skills the way it reaches first-party ones |

## Where it looks

- The working directory and every ancestor up to the repository root, which is the first directory holding `.git`: `<dir>/.agents/skills/*/SKILL.md`
- `~/.agents/skills/*/SKILL.md`, never treating the home directory or anything above it as project scope

A skill found nearer the working directory wins over one of the same name further up, and project skills win over user skills.

## Install

```bash
claude plugin marketplace add yuu1111/claude-agents-skills
claude plugin install agents-skills@claude-agents-skills
```

Run `/reload-plugins` in an open session. To try a checkout without installing:

```bash
claude --plugin-dir ./plugins/agents-skills
```

## Requirements

- Claude Code v2.1.287 or later, which is when mods arrived. Verified on v2.1.296.
- Windows, macOS or Linux. No build step: Claude Code loads the TypeScript module directly.

## Layout

```text
.claude-plugin/marketplace.json        catalog used by `claude plugin marketplace add`
plugins/agents-skills/
  .claude-plugin/plugin.json           plugin manifest
  hooks/hooks.json                     points at the hooks module, which is what makes it a mod
  hooks/register.ts                    discovery, system prompt section, slash commands, Skill tool
```

## Limits

- Not native discovery. The engine still does not walk `.agents/skills` itself, so skills reach the session through these hooks.
- The model decides whether to invoke a skill on its own. A stronger model picks a matching one out of the system prompt section, and a smaller one may act only when you run `/<name>` or name the skill in your prompt.
- A name Claude Code already provides wins. The mod skips the command and leaves the Skill tool call to the engine.
- Engine-owned inventories, such as the skill list behind `/skills` and the Skill tool's own listing of known skills, do not contain these skills. The system prompt section is where the model learns about them.
- A mod runs with your permissions and is not sandboxed. Read the module before installing.
- The mods API is early access and may change between releases.

## License

MIT