# claude-agents-skills

共有ディレクトリ `.agents/skills` のAgent SkillをClaude Codeへ読み込ませるmod

[English](README.md)

Claude Codeが読むのは `.claude/skills` で `.agents/skills` は読まない
Codex、Cursor、OpenCode、Kilo Code、GitHub Copilotは `.agents/skills` を読む
このmodはコピーもsymlinkも作らずにその差を埋める 同じファイルが唯一の正本のままになる

## 動作

| タイミング | 内容 |
| :- | :- |
| `session.start` | `~/.agents/skills/*/SKILL.md` とセッションの作業ディレクトリから上位へ向かう `<ancestor>/.agents/skills/*/SKILL.md` を走査する 各Skillを `/<name>` として登録し Claude Codeが既に持つ名前は飛ばす |
| `prompt.context` | 各Skillの名前・説明・パスを並べた `agentsSkills` ブロックを足し 該当する `SKILL.md` をReadツールで読むようモデルに伝える |
| `command.run` | `/<name>` をSkill本文へ展開し `$ARGUMENTS` を入力内容で置き換える |

作業ディレクトリに近いSkillが同名の上位のSkillより優先され プロジェクトのSkillがユーザーのSkillより優先される

## 導入

```bash
claude plugin marketplace add yuu1111/claude-agents-skills
claude plugin install agents-skills@claude-agents-skills
```

開いているセッションでは `/reload-plugins` を実行する インストールせずに試す場合

```bash
claude --plugin-dir ./plugins/agents-skills
```

## 必要環境

- Claude Code v2.1.287以降（modが導入されたバージョン） v2.1.296で検証済み
- Windows、macOS、Linux ビルド不要でTypeScriptモジュールを直接読み込む

## 構成

```text
.claude-plugin/marketplace.json        `claude plugin marketplace add` が読むカタログ
plugins/agents-skills/
  .claude-plugin/plugin.json           pluginのmanifest
  hooks/hooks.json                     hooksモジュールを指す これがmodの印
  hooks/register.ts                    探索、カタログブロック、slash command
```

## 制約

- ネイティブ探索ではない Claude Codeは `.agents` を自分で走査しないため これらのフック経由でSkillが届く
- モデルはSkill本文へSkillツールではなくReadツールで到達する そのためネイティブSkillの一覧表示・進行表示・権限確認は適用されない
- modは自分の権限で動きサンドボックス化されない 導入前にモジュールを読むこと
- mods APIはアーリーアクセスでリリースごとに変わりうる

## ライセンス

MIT
