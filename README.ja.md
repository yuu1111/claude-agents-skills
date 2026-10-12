# claude-agents-skills

共有ディレクトリ `.agents/skills` のAgent SkillをClaude Codeへ読み込ませるmod

[English](README.md)

Claude Codeが読むのは `.claude/skills` で `.agents/skills` は読まない
Codex、Cursor、OpenCode、Kilo Code、GitHub Copilotは `.agents/skills` を読む
このmodはコピーもsymlinkも作らずにその差を埋める 同じファイルが唯一の正本のままになる

## 動作

| フック | 内容 |
| :- | :- |
| `session.start` | 見つけた各Skillを `/<name>` として登録する Claude Codeが既に持つ名前は飛ばす |
| `prompt.compose` | システムプロンプトへ `agents_skills` セクションを足し 各Skillの説明とパスを並べる |
| `command.run` | `/<name>` をSkill本文へ展開し `$ARGUMENTS` を入力内容で置き換える |
| `tool.call`（`Skill`） | モデルがSkillツールで呼んだとき本文を返す ネイティブSkillと同じ経路で到達できる |

## 探索範囲

- 作業ディレクトリから `.git` を持つ最初のディレクトリ（リポジトリルート）までの各階層の `<dir>/.agents/skills/*/SKILL.md`
- `~/.agents/skills/*/SKILL.md` ホームディレクトリとその上位はプロジェクト範囲として扱わない

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
  hooks/register.ts                    探索、システムプロンプトのセクション、slash command、Skillツール
```

## 制約

- ネイティブ探索ではない エンジン自身は `.agents/skills` を走査しないため これらのフック経由でSkillが届く
- 自動で呼ぶかどうかはモデルの判断 上位モデルはシステムプロンプトのセクションから該当Skillを選ぶが 小さいモデルは `/<name>` を実行するかプロンプトでSkill名を挙げたときだけ動くことがある
- Claude Codeが既に持つ名前が優先される その場合はcommandの登録を見送り Skillツールの呼び出しもエンジンへ譲る
- `/skills` が裏に持つSkill一覧や Skillツールが知るSkillの在庫には載らない モデルはシステムプロンプトのセクションで知る
- modは自分の権限で動きサンドボックス化されない 導入前にモジュールを読むこと
- mods APIはアーリーアクセスでリリースごとに変わりうる

## ライセンス

MIT