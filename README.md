# claude-agents-skills

A Claude Code [mod](https://code.claude.com/docs/en/plugins/mods/overview) that loads Agent Skills from the shared `.agents/skills` directories into Claude Code.

[日本語](README.ja.md)

Claude Code reads `.claude/skills` and does not read `.agents/skills`. Codex, Cursor, OpenCode, Kilo Code and GitHub Copilot read `.agents/skills`. This mod closes that gap without copying files and without symlinks, so the same files stay the single source of truth.

## What it does

| Event | Behaviour |
| :- | :- |
| `session.start` | Scans `~/.agents/skills/*/SKILL.md` and every `<ancestor>/.agents/skills/*/SKILL.md` from the session's working directory upwards. Registers each skill as `/<name>` and skips names Claude Code already provides |
| `prompt.context` | Adds an `agentsSkills` block that lists each skill with its description and path, and tells the model to read the matching `SKILL.md` with the Read tool |
| `command.run` | Expands `/<name>` into that skill's body, replacing `$ARGUMENTS` with what the user typed |

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
  hooks/register.ts                    discovery, catalog block and slash commands
```

## Limits

- Not native discovery. Claude Code still does not walk `.agents` itself, so skills reach the session through these hooks.
- The model reaches a skill body with the Read tool instead of Claude Code's Skill tool, so first-party skill listings, progress rows and permission prompts do not apply.
- A mod runs with your permissions and is not sandboxed. Read the module before installing.
- The mods API is early access and may change between releases.

## License

MIT
