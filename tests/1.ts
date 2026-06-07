// [a](2.ts:1:16) 跳转到1行16列
/// [a](2.ts#L1-L2) 跳转到 1至2行，并框选
/* [a](2.ts#L1-L2) */
var a;

// ─── 各种链接格式测试 ───────────────────────────────────────────────

// 1. Markdown 风格 [text](path)
// [跳转到 2.ts](2.ts)

// 2. 相对路径
// ./2.ts
// ../tests/2.ts

// 3. 绝对路径 (Unix 风格，WSL 下可用)
// /home/user/project/file.ts

// 4. 绝对路径 (Windows 风格)
// F:\workspace\VSCode\vscode_extensions\doc_link_jump\tests\2.ts

// 5. file://./ 相对路径
// file://./2.ts
// file://./2.ts:1:16
// file://./2.ts#L1-L2

// 6. file:/// 绝对路径
// file:///home/user/project/file.ts
// file:///F:/workspace/VSCode/vscode_extensions/doc_link_jump/tests/2.ts:1:18

// 7. 带行号列号
// [跳转到 2.ts 第3行](2.ts:3)
// [跳转到 2.ts 第3行第5列](2.ts:3:5)
// [跳转到 2.ts 第3至5行](2.ts#L3-L5)