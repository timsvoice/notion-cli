# notion-cli

Notion CLI for coding agents.

## Install from GitHub

```bash
npm install -g github:YOUR_ORG_OR_USER/notion-cli
```

This repo uses a `prepare` script to build on install.

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

## Development

```bash
npm install
npm run dev -- --help
```
