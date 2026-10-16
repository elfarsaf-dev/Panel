import React, { useState, useRef, useEffect } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type * as monacoType from "monaco-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Code2,
  Save,
  X,
  FileCode,
  Sparkles,
  Undo2,
  Redo2,
  RotateCcw,
  Loader2,
  Terminal,
  Cpu,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface MonacoWorkerEditorProps {
  value: string;
  onChange: (val: string) => void;
  workerName: string;
  onWorkerNameChange?: (name: string) => void;
  isNameDisabled?: boolean;
  dialogMode: "add" | "edit" | "view";
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
  loading?: boolean;
}

const TEMPLATES = [
  {
    name: "Hello World (ES Module)",
    code: `export default {
  async fetch(request, env, ctx) {
    return new Response("Hello from Cloudflare Worker!", {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  },
};
`,
  },
  {
    name: "JSON API with CORS",
    code: `export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const data = {
      status: "ok",
      timestamp: new Date().toISOString(),
      url: request.url,
      method: request.method,
    };

    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  },
};
`,
  },
  {
    name: "Reverse Proxy / Forwarder",
    code: `export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // Ganti origin target ke server tujuan
    const targetUrl = "https://example.com" + url.pathname + url.search;

    const modifiedRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: "follow",
    });

    return fetch(modifiedRequest);
  },
};
`,
  },
  {
    name: "URL Redirect (301/302)",
    code: `export default {
  async fetch(request, env, ctx) {
    const destination = "https://example.com";
    return Response.redirect(destination, 301);
  },
};
`,
  },
];

const MOBILE_SNIPPETS = ["{", "}", "(", ")", "[", "]", "=>", ";", '"', "'", "===", "const", "return", "async"];

export default function MonacoWorkerEditor({
  value,
  onChange,
  workerName,
  onWorkerNameChange,
  isNameDisabled,
  dialogMode,
  saving,
  onSave,
  onClose,
  loading = false,
}: MonacoWorkerEditorProps) {
  const isMobile = useIsMobile();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [showTemplates, setShowTemplates] = useState(false);

  const editorRef = useRef<monacoType.editor.IStandaloneCodeEditor | null>(null);

  // Fullscreen by default on mobile for best editing experience
  useEffect(() => {
    if (isMobile) {
      setIsFullscreen(true);
    }
  }, [isMobile]);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Track cursor position
    editor.onDidChangeCursorPosition((e) => {
      setCursorPos({
        line: e.position.lineNumber,
        col: e.position.column,
      });
    });

    // Custom dark VS Code-like colors
    monaco.editor.defineTheme("cf-vscode-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6A9955", fontStyle: "italic" },
        { token: "keyword", foreground: "C586C0", fontStyle: "bold" },
        { token: "string", foreground: "CE9178" },
        { token: "number", foreground: "B5CEA8" },
        { token: "identifier", foreground: "9CDCFE" },
        { token: "type", foreground: "4EC9B0" },
        { token: "delimiter", foreground: "D4D4D4" },
      ],
      colors: {
        "editor.background": "#12151b",
        "editor.foreground": "#d4d4d4",
        "editorLineNumber.foreground": "#4b5563",
        "editorLineNumber.activeForeground": "#f97316",
        "editorCursor.foreground": "#f97316",
        "editor.selectionBackground": "#264f7880",
        "editor.inactiveSelectionBackground": "#3a3d4140",
        "editorGutter.background": "#0f1217",
      },
    });

    monaco.editor.setTheme("cf-vscode-dark");
  };

  const handleFormatCode = () => {
    if (editorRef.current) {
      editorRef.current.getAction("editor.action.formatDocument")?.run();
    }
  };

  const handleUndo = () => {
    if (editorRef.current) {
      editorRef.current.trigger("keyboard", "undo", null);
    }
  };

  const handleRedo = () => {
    if (editorRef.current) {
      editorRef.current.trigger("keyboard", "redo", null);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const insertSnippet = (snippet: string) => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const selection = editor.getSelection();
    if (selection) {
      editor.executeEdits("mobile-snippet", [
        {
          range: selection,
          text: snippet,
          forceMoveMarkers: true,
        },
      ]);
      editor.focus();
    }
  };

  const isModule =
    value.includes("export default") ||
    value.includes("export ") ||
    value.includes("import ");

  const lineCount = value.split("\n").length;
  const byteSize = new Blob([value]).size;
  const formattedSize = byteSize > 1024 ? `${(byteSize / 1024).toFixed(1)} KB` : `${byteSize} B`;

  const isViewOnly = dialogMode === "view";

  return (
    <div
      className={`flex flex-col bg-[#0d1017] text-gray-200 border border-gray-800 transition-all duration-200 overflow-hidden ${
        isFullscreen
          ? "fixed inset-0 z-50 w-screen h-screen rounded-none"
          : "w-full h-[88vh] max-h-[900px] rounded-xl shadow-2xl"
      }`}
    >
      {/* VS Code Top Header / Bar */}
      <div className="bg-[#161a23] border-b border-gray-800/80 px-3 py-2 flex items-center justify-between gap-2 shrink-0 select-none">
        {/* Left: File tab & Worker Name */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 bg-[#12151b] px-3 py-1.5 rounded-t-md border-t-2 border-t-orange-500 border-x border-gray-800/80 text-xs font-mono text-gray-200">
            <FileCode className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            <span className="font-semibold truncate max-w-[140px] sm:max-w-[200px]">
              {workerName ? `${workerName}.js` : "worker.js"}
            </span>
            <Badge
              variant="outline"
              className={`text-[9px] px-1 py-0 h-4 border-none ${
                isModule ? "bg-orange-500/20 text-orange-400" : "bg-blue-500/20 text-blue-400"
              }`}
            >
              {isModule ? "ES Module" : "Worker"}
            </Badge>
          </div>

          {!isNameDisabled && onWorkerNameChange && (
            <div className="hidden sm:flex items-center gap-1.5 ml-2">
              <span className="text-[11px] text-gray-400">Nama:</span>
              <Input
                value={workerName}
                onChange={(e) => onWorkerNameChange(e.target.value)}
                placeholder="nama-worker"
                className="h-7 w-36 bg-[#12151b] border-gray-700 text-xs font-mono text-white px-2"
              />
            </div>
          )}
        </div>

        {/* Center/Right Toolbar */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Templates button */}
          {!isViewOnly && (
            <div className="relative">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowTemplates(!showTemplates)}
                className="h-7 px-2 text-xs text-gray-300 hover:text-white hover:bg-gray-800 gap-1"
                title="Pilih Template Worker"
              >
                <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                <span className="hidden md:inline">Template</span>
              </Button>

              {showTemplates && (
                <div className="absolute right-0 top-8 w-64 bg-[#1a1f2c] border border-gray-700 rounded-lg shadow-xl z-50 p-2 space-y-1">
                  <div className="text-[11px] font-semibold text-gray-400 px-2 py-1">
                    Gunakan Template:
                  </div>
                  {TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.name}
                      onClick={() => {
                        onChange(tpl.code);
                        setShowTemplates(false);
                      }}
                      className="w-full text-left px-2 py-1.5 text-xs text-gray-200 hover:bg-orange-500/20 hover:text-orange-300 rounded transition-colors"
                    >
                      {tpl.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Undo / Redo */}
          {!isViewOnly && (
            <>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleUndo}
                className="h-7 w-7 text-gray-400 hover:text-white hover:bg-gray-800"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleRedo}
                className="h-7 w-7 text-gray-400 hover:text-white hover:bg-gray-800"
                title="Redo (Ctrl+Y)"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleFormatCode}
                className="h-7 w-7 text-gray-400 hover:text-white hover:bg-gray-800"
                title="Format Code"
              >
                <Code2 className="w-3.5 h-3.5 text-blue-400" />
              </Button>
            </>
          )}

          {/* Copy button */}
          <Button
            size="icon"
            variant="ghost"
            onClick={handleCopy}
            className="h-7 w-7 text-gray-400 hover:text-white hover:bg-gray-800"
            title="Salin semua kode"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>

          {/* Fullscreen toggle (especially useful on desktop) */}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="h-7 w-7 text-gray-400 hover:text-white hover:bg-gray-800"
            title={isFullscreen ? "Kecilkan Editor" : "Layar Penuh (Zen Mode)"}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </Button>

          {/* Save/Deploy button */}
          {!isViewOnly ? (
            <Button
              size="sm"
              onClick={onSave}
              disabled={saving || !workerName.trim() || loading}
              className="h-7 px-3 bg-orange-500 hover:bg-orange-600 text-white font-medium text-xs gap-1.5 shadow-sm"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{dialogMode === "edit" ? "Simpan" : "Deploy"}</span>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={onClose}
              className="h-7 px-2.5 border-gray-700 text-gray-300 hover:bg-gray-800 text-xs"
            >
              Tutup
            </Button>
          )}

          {/* Close modal button */}
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            className="h-7 w-7 text-gray-400 hover:text-red-400 hover:bg-red-500/10"
            title="Tutup Editor"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Sub-header on mobile when adding new worker: Worker Name Input */}
      {!isNameDisabled && onWorkerNameChange && (
        <div className="sm:hidden bg-[#12151b] px-3 py-1.5 border-b border-gray-800 flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-gray-400 whitespace-nowrap">Nama Worker:</span>
          <Input
            value={workerName}
            onChange={(e) => onWorkerNameChange(e.target.value)}
            placeholder="my-worker"
            className="h-7 bg-[#161a23] border-gray-700 text-xs font-mono text-white px-2 flex-1"
          />
        </div>
      )}

      {/* Main Code Editor Area */}
      <div className="relative flex-1 w-full h-full min-h-0 bg-[#12151b]">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#12151b] z-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-orange-400" />
            <p className="text-gray-400 text-xs font-mono">Memuat kode Cloudflare Worker...</p>
          </div>
        ) : (
          <Editor
            height="100%"
            width="100%"
            language="javascript"
            theme="cf-vscode-dark"
            value={value}
            onChange={(val) => onChange(val ?? "")}
            onMount={handleEditorMount}
            options={{
              readOnly: isViewOnly,
              fontSize: isMobile ? 12.5 : 13.5,
              lineNumbers: "on",
              minimap: { enabled: !isMobile && isFullscreen },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: "on",
              fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
              fontLigatures: true,
              folding: true,
              cursorBlinking: "smooth",
              cursorSmoothCaretAnimation: "on",
              bracketPairColorization: { enabled: true },
              formatOnPaste: true,
              renderWhitespace: "none",
              smoothScrolling: true,
              contextmenu: true,
              quickSuggestions: true,
              padding: { top: 12, bottom: 12 },
            }}
          />
        )}
      </div>

      {/* Mobile Touch Quick-Snippet Bar */}
      {!isViewOnly && (
        <div className="bg-[#161a23] border-t border-gray-800/80 px-2 py-1 flex items-center gap-1 overflow-x-auto shrink-0 scrollbar-none select-none">
          <span className="text-[10px] text-gray-500 font-mono px-1 flex items-center gap-1 shrink-0">
            <Terminal className="w-3 h-3 text-orange-400" /> Quick:
          </span>
          {MOBILE_SNIPPETS.map((snip) => (
            <button
              key={snip}
              type="button"
              onClick={() => insertSnippet(snip)}
              className="px-2 py-0.5 bg-[#12151b] hover:bg-orange-500/20 active:bg-orange-500/30 text-gray-300 hover:text-orange-300 border border-gray-800 rounded text-xs font-mono shrink-0 transition-colors"
            >
              {snip}
            </button>
          ))}
        </div>
      )}

      {/* VS Code Bottom Status Bar */}
      <div className="bg-[#0f1217] text-gray-400 border-t border-gray-800/80 px-3 py-1 flex items-center justify-between text-[11px] font-mono shrink-0 select-none">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-orange-400">
            <Cpu className="w-3 h-3" />
            <span>Cloudflare V8</span>
          </span>
          <span className="hidden sm:inline">
            Ln {cursorPos.line}, Col {cursorPos.col}
          </span>
          <span>
            {lineCount} baris ({formattedSize})
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-gray-400">UTF-8</span>
          <span className="text-gray-400">Spasi: 2</span>
          <span className="text-yellow-400/90 font-medium hidden xs:inline">JavaScript (ES6+)</span>
        </div>
      </div>
    </div>
  );
}
