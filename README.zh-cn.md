# 注释链接跳转 (Comment Link Jump)

让代码注释中的文件路径可点击 —— **Ctrl+点击** 跳转，**Ctrl+Alt+点击** 在侧边打开。

![VS Code](https://img.shields.io/badge/VS%20Code-^1.85.0-blue)

## 功能

自动检测代码注释中的文件路径链接，将其变为可点击的超链接：

- **Markdown 风格**：`[标签](路径)`
- **相对路径**：`./file.ts`、`../lib/foo.ts`
- **绝对路径**：`/home/user/file.ts`、`C:\path\to\file.ts`
- **`file://` 协议**：`file://./相对路径`、`file:///绝对路径`
- **行列定位**：`path:10`、`path:10:20`
- **范围选中**：`path#L1-L10`、`path#L1,20`

### 支持的注释语法

| 语言 | 语法 |
|------|------|
| C 风格 (JS/TS/C/C++/Java/C#/Go/Rust/Swift...) | `// ...`、`/* ... */` |
| Python、Shell、Ruby、YAML、Perl、R、Makefile、Dockerfile | `# ...` |
| SQL、Lua、Haskell、Ada | `-- ...` |

## 使用方式

在注释中写入文件路径：

```typescript
// 参考 [工具函数](src/utils.ts) 了解详情。
// 配置文件: ./config/app.json
// 文档: file://./docs/README.md#L10-L20
```

路径会自动变为可点击链接，悬停可查看解析后的完整目标路径。

## 命令

| 命令 | 说明 |
|------|------|
| `注释链接跳转: 重新加载提供器` | 验证扩展是否正常运行 |

## 系统要求

- VS Code `^1.85.0`

## 开发

```bash
npm install
npm run compile
# 按 F5 调试
```
