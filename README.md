# notion-cli

Notion CLI for coding agents.

## Install from GitHub

```bash
npm install -g https://codeload.github.com/YOUR_ORG_OR_USER/notion-cli/tar.gz/HEAD
```

This repo includes prebuilt `dist/`, so installation does not require TypeScript.
If you install from GitHub, ensure `dist/` is committed to the repo.

## Private Repo Install

If the repo is private, authenticate with GitHub using one of these options.

Option 1: SSH

```bash
npm install -g git+ssh://git@github.com:YOUR_ORG_OR_USER/notion-cli.git
```

Option 2: HTTPS + token

```bash
GITHUB_TOKEN=your_token_here npm install -g git+https://YOUR_GITHUB_USERNAME:${GITHUB_TOKEN}@github.com/YOUR_ORG_OR_USER/notion-cli.git
```

## Usage

```bash
notion --help
notion users me
```

## Configuration

Set `NOTION_TOKEN` in your environment, or use `--token` / `--token-stdin`.

```bash
export NOTION_TOKEN="your_notion_integration_token"
notion users me
```

You can also store the token in a local config file:

```bash
notion config set token "your_notion_integration_token"
notion users me
```

Config is stored at `~/.config/notion-cli/config.json` with permissions `600`.

## Development

```bash
npm install
npm run dev -- --help
```

## Releases

Create a tag matching the package version and push it:

```bash
npm run release
```

Use a tag in the install URL for stability:

```bash
npm install -g https://codeload.github.com/YOUR_ORG_OR_USER/notion-cli/tar.gz/v1.0.0
```
