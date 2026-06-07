import * as vscode from 'vscode';
import * as path from 'path';

/**
 * 解析结果：包含目标路径和可选的行/列/范围信息
 */
interface ParsedLink {
    /** 文件路径（尚未 resolve 为绝对路径） */
    filePath: string;
    /** 是否为 file:// 协议 */
    isFileProtocol: boolean;
    /** 起始行 (1-based)，undefined 表示无 */
    startLine?: number;
    /** 起始列 (1-based) */
    startColumn?: number;
    /** 结束行 (1-based)，与 startLine 一起构成范围选中 */
    endLine?: number;
    /** 链接在 comment 文本内的起始偏移 */
    offsetInComment: number;
    /** 链接在 comment 文本内的长度 */
    length: number;
    /** 链接的完整原始文本（用于 tooltip） */
    rawText: string;
}

// ─── 注释检测 ─────────────────────────────────────────────────────────

/**
 * 按语言返回注释正则
 */
function getCommentPatterns(languageId: string): RegExp[] {
    const patterns: RegExp[] = [];

    // C-style 单行: //
    patterns.push(/\/\/.*$/gm);
    // 块注释: /* ... */
    patterns.push(/\/\*[\s\S]*?\*\//gm);

    // # 号注释 (Python, Shell, Ruby, YAML, R, Perl 等)
    if (['python', 'shellscript', 'ruby', 'perl', 'yaml', 'r', 'awk', 'makefile', 'dockerfile', 'ignore'].includes(languageId)) {
        patterns.push(/#.*$/gm);
    }

    // -- 注释 (SQL, Lua, Haskell, Ada)
    if (['sql', 'lua', 'haskell', 'ada'].includes(languageId)) {
        patterns.push(/--.*$/gm);
    }

    return patterns;
}

interface CommentMatch {
    text: string;
    /** 在文档中的绝对起始偏移 */
    docOffset: number;
}

/**
 * 找出文档中所有的注释范围
 */
function findAllComments(document: vscode.TextDocument): CommentMatch[] {
    const docText = document.getText();
    const patterns = getCommentPatterns(document.languageId);
    const comments: CommentMatch[] = [];
    const covered = new Set<string>();

    for (const pattern of patterns) {
        pattern.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = pattern.exec(docText)) !== null) {
            const key = `${m.index}-${m.index + m[0].length}`;
            if (covered.has(key)) continue;
            covered.add(key);
            comments.push({ text: m[0], docOffset: m.index });
        }
    }

    return comments;
}

// ─── 链接提取 ─────────────────────────────────────────────────────────

/**
 * 从一段评论文本中提取所有链接
 */
function extractLinksFromComment(commentText: string): ParsedLink[] {
    const links: ParsedLink[] = [];

    /** 已被占据的字符区间（半开 [start, end)），防止重叠匹配 */
    const occupied: Array<[number, number]> = [];

    function isOccupied(start: number, end: number): boolean {
        for (const [s, e] of occupied) {
            if (start < e && end > s) return true;
        }
        return false;
    }

    function occupy(start: number, end: number) {
        occupied.push([start, end]);
    }

    let m: RegExpExecArray | null;

    // --- 第 1 遍：Markdown 风格 [text](target) ---
    const mdRe = /\[([^\]]*)\]\(([^\s()]+)\)/g;
    while ((m = mdRe.exec(commentText)) !== null) {
        if (isOccupied(m.index, m.index + m[0].length)) continue;
        const parsed = parseTarget(m[2]);
        if (!parsed) continue;
        occupy(m.index, m.index + m[0].length);
        parsed.offsetInComment = m.index;
        parsed.length = m[0].length;
        parsed.rawText = m[0];
        links.push(parsed);
    }

    // --- 第 2 遍：file:// 协议链接 ---
    const fileProtoRe = /file:\/\/[^\s"'<>\[\](){}]+/gi;
    while ((m = fileProtoRe.exec(commentText)) !== null) {
        if (isOccupied(m.index, m.index + m[0].length)) continue;
        const parsed = parseTarget(m[0]);
        if (!parsed) continue;
        occupy(m.index, m.index + m[0].length);
        parsed.offsetInComment = m.index;
        parsed.length = m[0].length;
        parsed.rawText = m[0];
        links.push(parsed);
    }

    // --- 第 3 遍：裸文件路径 (./ ../ / C:\) ---
    const bareRe = /(?:(?:\.{1,2}[\/\\])+|(?:[a-zA-Z]:[\/\\])|\/[^\/\s])(?:[^\s"'<>\[\](){}]*[^\s"'<>\[\](){},.;!?])?(?:\.\w+)/g;
    while ((m = bareRe.exec(commentText)) !== null) {
        if (isOccupied(m.index, m.index + m[0].length)) continue;
        if (/^https?:\/\//i.test(m[0])) continue;
        const parsed = parseTarget(m[0]);
        if (!parsed) continue;
        occupy(m.index, m.index + m[0].length);
        parsed.offsetInComment = m.index;
        parsed.length = m[0].length;
        parsed.rawText = m[0];
        links.push(parsed);
    }

    return links;
}

// ─── Target 解析 ──────────────────────────────────────────────────────

/**
 * 解析链接 target 字符串
 *
 * 支持的格式：
 *   path.ts
 *   path.ts:10
 *   path.ts:10:20
 *   path.ts#L10
 *   path.ts#L10-L20
 *   path.ts#L10,20
 *   file://./path.ts
 *   file://./path.ts:10
 *   file:///absolute/path.ts
 *   file:///C:/absolute/path.ts
 *   file:///absolute/path.ts#L10-L20
 */
function parseTarget(raw: string): ParsedLink | null {
    let remaining = raw.trim();
    if (!remaining) return null;

    let isFileProtocol = false;

    // 剥离 file:// 前缀
    if (remaining.startsWith('file://')) {
        isFileProtocol = true;
        remaining = remaining.slice('file://'.length);
    }

    // 分离路径与 fragment / line:col
    let filePath: string;
    let fragment: string | undefined;

    const hashIdx = remaining.indexOf('#');
    if (hashIdx >= 0) {
        filePath = remaining.substring(0, hashIdx);
        fragment = remaining.substring(hashIdx + 1);
    } else {
        // 尝试匹配末尾 :line 或 :line:col
        // 注意：Windows 路径 C:\xxx 中的 : 不能误匹配，所以用启发式：
        // 如果字符串不以盘符开头，才尝试 :line:col
        const lineColRe = /^(.+?):(\d+)(?::(\d+))?$/;
        const lcMatch = lineColRe.exec(remaining);
        if (lcMatch && !/^[a-zA-Z]:[\\/]/.test(remaining)) {
            filePath = lcMatch[1];
            fragment = `L${lcMatch[2]}`;
            if (lcMatch[3]) {
                fragment += `,${lcMatch[3]}`;
            }
        } else {
            filePath = remaining;
        }
    }

    filePath = filePath.trim();
    if (!filePath) return null;

    // 解析 fragment → startLine/startColumn/endLine
    let startLine: number | undefined;
    let startColumn: number | undefined;
    let endLine: number | undefined;

    if (fragment) {
        const fragRe = /^L?(\d+)(?:[-,](\d+))?$/i;
        const fMatch = fragRe.exec(fragment.trim());
        if (fMatch) {
            startLine = parseInt(fMatch[1], 10);
            if (fMatch[2] !== undefined) {
                const n2 = parseInt(fMatch[2], 10);
                if (fragment.includes(',')) {
                    // L1,2 → 行+列
                    startColumn = n2;
                } else {
                    // L1-L2 → 行范围
                    endLine = n2;
                }
            }
        }
    }

    return {
        filePath,
        isFileProtocol,
        startLine,
        startColumn,
        endLine,
        offsetInComment: 0,
        length: raw.length,
        rawText: raw,
    };
}

// ─── URI 解析 ─────────────────────────────────────────────────────────

/**
 * 将 ParsedLink 解析为 VS Code Uri
 */
function resolveLinkUri(link: ParsedLink, docDir: string): vscode.Uri | null {
    let p = link.filePath;

    // file:// 协议：修正路径
    if (link.isFileProtocol) {
        // file://./relative → ./relative → relative
        if (p.startsWith('./')) {
            p = p.substring(2);
        }
        // file:///C:/... → /C:/... → C:/... (Windows)
        else if (/^\/[a-zA-Z]:[\\/]/.test(p)) {
            p = p.substring(1);
        }
        // file:///absolute (Unix) → /absolute，保持不变
    }

    // 转为绝对路径
    let fullPath: string;
    if (path.isAbsolute(p)) {
        fullPath = p;
    } else {
        fullPath = path.resolve(docDir, p);
    }

    let uri = vscode.Uri.file(fullPath);

    // VS Code 用 #Lline,col 的 fragment 做导航
    if (link.startLine !== undefined) {
        let frag = `L${link.startLine}`;
        if (link.startColumn !== undefined) {
            frag += `,${link.startColumn}`;
        }
        uri = uri.with({ fragment: frag });
    }

    return uri;
}

// ─── DocumentLink Provider ────────────────────────────────────────────

class DocLinkProvider implements vscode.DocumentLinkProvider {
    async provideDocumentLinks(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): Promise<vscode.DocumentLink[]> {
        const docDir = path.dirname(document.uri.fsPath);
        const docLinks: vscode.DocumentLink[] = [];
        const comments = findAllComments(document);

        for (const comment of comments) {
            const extracted = extractLinksFromComment(comment.text);

            for (const link of extracted) {
                const targetUri = resolveLinkUri(link, docDir);
                if (!targetUri) continue;

                // 把 comment 内偏移转为文档绝对偏移
                const absStart = comment.docOffset + link.offsetInComment;
                const absEnd = absStart + link.length;
                const docRange = new vscode.Range(
                    document.positionAt(absStart),
                    document.positionAt(absEnd)
                );

                const docLink = new vscode.DocumentLink(docRange, targetUri);
                docLink.tooltip = `跳转到: ${targetUri.fsPath}${targetUri.fragment ? ' ' + targetUri.fragment : ''}`;
                docLinks.push(docLink);
            }
        }

        return docLinks;
    }
}

// ─── 激活入口 ─────────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext) {
    try {
        const provider = new DocLinkProvider();
        const selector: vscode.DocumentSelector = { scheme: 'file' };

        context.subscriptions.push(
            vscode.languages.registerDocumentLinkProvider(selector, provider)
        );

        // 注册重载命令（同时也让扩展在命令面板中可见）
        context.subscriptions.push(
            vscode.commands.registerCommand('doc-link-jump.reload', () => {
                vscode.window.showInformationMessage('Doc Link Jump is active.');
            })
        );

        console.log('Doc Link Jump 已激活');
    } catch (err) {
        console.error('Doc Link Jump 激活失败:', err);
    }
}

export function deactivate() { }
