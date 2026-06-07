# Comment Link Jump
[简体中文](./README.zh-cn.md)

Make links in code comments clickable — **Ctrl+Click** to jump, **Ctrl+Alt+Click** to open to the side.

![VS Code](https://img.shields.io/badge/VS%20Code-^1.85.0-blue)

## Features

Detects file path links in code comments and turns them into clickable hyperlinks:

- **Markdown-style**: `[label](path)`
- **Relative paths**: `./file.ts`, `../lib/foo.ts`
- **Absolute paths**: `/home/user/file.ts`, `C:\path\to\file.ts`
- **`file://` protocol**: `file://./relative`, `file:///absolute`
- **Line/column navigation**: `path:10`, `path:10:20`
- **Range selection**: `path#L1-L10`, `path#L1,20`

### Supported Comment Syntax

| Language | Syntax |
|----------|--------|
| C-style (JS, TS, C, C++, Java, C#, Go, Rust, Swift...) | `// ...`, `/* ... */` |
| Python, Shell, Ruby, YAML, Perl, R, Makefile, Dockerfile | `# ...` |
| SQL, Lua, Haskell, Ada | `-- ...` |

## Usage

Write a file path in a comment:

```typescript
// See [utils](src/utils.ts) for details.
// Config: ./config/app.json
// Docs: file://./docs/README.md#L10-L20
```

The path becomes a clickable link. Hover to see the resolved target.

## Commands

| Command | Description |
|---------|-------------|
| `Comment Link Jump: Reload Providers` | Verify the extension is active |

## Requirements

- VS Code `^1.85.0`

## Development

```bash
npm install
npm run compile
# Press F5 to debug
```
