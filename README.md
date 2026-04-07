# FlagCode

FlagCode is a fork of [T3 Code](https://github.com/pingdotgg/t3code), a minimal web GUI for coding agents. FlagCode is tailored for solving CTF challenges.

## Installation

> [!WARNING]
> FlagCode currently supports Codex and Claude.
> Install and authenticate at least one provider before use:
>
> - Codex: install [Codex CLI](https://github.com/openai/codex) and run `codex login`
> - Claude: install Claude Code and run `claude auth login`

### Run without installing

```bash
npx flagcode
```

### Desktop app

Install the latest version of the desktop app from [GitHub Releases](https://github.com/f1amee-dev/flagcode/releases), or from your favorite package registry:

#### Windows (`winget`)

```bash
winget install FlagCode.FlagCode
```

#### macOS (Homebrew)

```bash
brew install --cask flagcode
```

#### Arch Linux (AUR)

```bash
yay -S flagcode-bin
```

## Some notes

We are very very early in this project. Expect bugs.

We are not accepting contributions yet.

Observability guide: [docs/observability.md](./docs/observability.md)

## If you REALLY want to contribute still.... read this first

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening an issue or PR.

Need support? Join the [Discord](https://discord.gg/jn4EGJjrvv).
