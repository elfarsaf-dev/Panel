import React, { useState, useRef, useEffect, useCallback } from "react";
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
  Loader2,
  Cpu,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ArrowRightToLine,
  Keyboard,
  ChevronDown,
  Search,
  CopyCheck,
  Files,
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
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [viewportStyle, setViewportStyle] = useState<React.CSSProperties>({});
  const [isCtrlActive, setIsCtrlActive] = useState(false);

  const editorRef = useRef<monacoType.editor.IStandaloneCodeEditor | null>(null);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);

  // Default to full-screen on mobile
  useEffect(() => {
    if (isMobile) {
      setIsFullscreen(true);
    }
  }, [isMobile]);

  // Visual Viewport API: handle virtual keyboard resizing on mobile smoothly
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      const isKeyboardActive = vv.height < window.innerHeight * 0.85;
      const computedKbHeight = Math.max(0, window.innerHeight - vv.height);
      setKeyboardHeight(isKeyboardActive ? computedKbHeight : 0);

      if (isMobile || isFullscreen) {
        setViewportStyle({
          height: `${vv.height}px`,
          top: `${vv.offsetTop}px`,
          position: "fixed",
          left: 0,
          right: 0,
        });

        // Trigger Monaco re-layout smoothly
        if (editorRef.current) {
          editorRef.current.layout();
          const pos = editorRef.current.getPosition();
          if (pos && isKeyboardActive) {
            editorRef.current.revealPositionInCenter(pos, 0);
          }
        }
      } else {
        setViewportStyle({});
      }
    };

    vv.addEventListener("resize", handleResize);
    vv.addEventListener("scroll", handleResize);
    handleResize();

    return () => {
      vv.removeEventListener("resize", handleResize);
      vv.removeEventListener("scroll", handleResize);
    };
  }, [isMobile, isFullscreen]);

  // Acode-style Gesture Detection:
  // If user touches and drags/scrolls: KEYBOARD NEVER OPENS.
  // Only if user performs a stationary TAP on code: focus editor and show keyboard.
  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container || !isMobile) return;

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let isDragging = false;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        startTime = Date.now();
        isDragging = false;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const dx = Math.abs(e.touches[0].clientX - startX);
        const dy = Math.abs(e.touches[0].clientY - startY);
        // If movement exceeds 6px, it is definitely a scroll/swipe gesture!
        if (dx > 6 || dy > 6) {
          isDragging = true;
          // Immediately blur any active textarea so keyboard stays hidden while scrolling
          const activeEl = document.activeElement;
          if (activeEl && (activeEl.tagName === "TEXTAREA" || activeEl.tagName === "INPUT")) {
            (activeEl as HTMLElement).blur();
          }
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      const duration = Date.now() - startTime;
      // Only when clean tap without dragging
      if (!isDragging && duration < 350 && e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        if (editorRef.current) {
          const editor = editorRef.current;
          try {
            const target = editor.getTargetAtClientPoint(touch.clientX, touch.clientY);
            if (target && target.position) {
              editor.setPosition(target.position);
              editor.revealPositionInCenterIfOutsideViewport(target.position, 0);
            }
          } catch {
            // fallback
          }
          // User deliberately tapped: now focus and open keyboard
          editor.focus();
        }
      }
    };

    container.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
    container.addEventListener("touchmove", onTouchMove, { passive: true, capture: true });
    container.addEventListener("touchend", onTouchEnd, { passive: true, capture: true });

    return () => {
      container.removeEventListener("touchstart", onTouchStart, true);
      container.removeEventListener("touchmove", onTouchMove, true);
      container.removeEventListener("touchend", onTouchEnd, true);
    };
  }, [isMobile]);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Track cursor position
    editor.onDidChangeCursorPosition((e) => {
      setCursorPos({
        line: e.position.lineNumber,
        col: e.position.column,
      });
      // Keep typing line visible above keyboard
      editor.revealPositionInCenterIfOutsideViewport(e.position, 0);
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

  const dismissKeyboard = useCallback(() => {
    if (editorRef.current) {
      const dom = editorRef.current.getDomNode();
      const input = dom?.querySelector("textarea.inputarea") as HTMLElement | null;
      if (input) input.blur();
    }
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setKeyboardHeight(0);
    setIsCtrlActive(false);
  }, []);

  // Handle Termux CTRL actions
  const handleCtrlAction = useCallback(
    (action: "find" | "comment" | "selectAll" | "save" | "duplicate" | "format" | "undo" | "redo") => {
      if (!editorRef.current) return;
      const editor = editorRef.current;
      switch (action) {
        case "find":
          editor.getAction("actions.find")?.run();
          editor.focus();
          break;
        case "comment":
          editor.getAction("editor.action.commentLine")?.run();
          editor.focus();
          break;
        case "selectAll": {
          const model = editor.getModel();
          if (model) {
            editor.setSelection(model.getFullModelRange());
          }
          editor.focus();
          break;
        }
        case "duplicate":
          editor.getAction("editor.action.copyLinesDownAction")?.run();
          editor.focus();
          break;
        case "format":
          editor.getAction("editor.action.formatDocument")?.run();
          editor.focus();
          break;
        case "undo":
          editor.trigger("keyboard", "undo", null);
          editor.focus();
          break;
        case "redo":
          editor.trigger("keyboard", "redo", null);
          editor.focus();
          break;
        case "save":
          onSave();
          break;
      }
      setIsCtrlActive(false);
    },
    [onSave]
  );

  const handleEsc = useCallback(() => {
    if (!editorRef.current) return;
    editorRef.current.trigger("keyboard", "closeFindWidget", null);
    editorRef.current.trigger("keyboard", "hideSuggestWidget", null);
    setIsCtrlActive(false);
  }, []);

  // Termux key latch: if user taps CTRL on toolbar then presses a key on phone keyboard
  useEffect(() => {
    if (!isCtrlActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "f") {
        e.preventDefault();
        handleCtrlAction("find");
      } else if (key === "a") {
        e.preventDefault();
        handleCtrlAction("selectAll");
      } else if (key === "s") {
        e.preventDefault();
        handleCtrlAction("save");
      } else if (key === "z") {
        e.preventDefault();
        handleCtrlAction("undo");
      } else if (key === "y") {
        e.preventDefault();
        handleCtrlAction("redo");
      } else if (key === "d") {
        e.preventDefault();
        handleCtrlAction("duplicate");
      } else if (key === "/" || key === "?") {
        e.preventDefault();
        handleCtrlAction("comment");
      } else if (key === "escape") {
        e.preventDefault();
        setIsCtrlActive(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isCtrlActive, handleCtrlAction]);

  // Termux-style snippet insertion & cursor navigation
  const insertSnippet = useCallback((text: string) => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const sel = editor.getSelection();
    if (sel) {
      editor.executeEdits("snippet-insert", [
        {
          range: sel,
          text,
          forceMoveMarkers: true,
        },
      ]);
      editor.focus();
    }
  }, []);

  const insertPair = useCallback((open: string, close: string) => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const sel = editor.getSelection();
    if (sel) {
      const selectedText = editor.getModel()?.getValueInRange(sel) || "";
      const text = `${open}${selectedText}${close}`;
      editor.executeEdits("pair-insert", [
        {
          range: sel,
          text,
          forceMoveMarkers: true,
        },
      ]);
      const start = sel.getStartPosition();
      const targetCol = start.column + open.length;
      editor.setPosition({
        lineNumber: start.lineNumber,
        column: targetCol,
      });
      editor.focus();
    }
  }, []);

  const moveCursor = useCallback((direction: -1 | 1) => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const pos = editor.getPosition();
    if (!pos) return;
    let line = pos.lineNumber;
    let col = pos.column + direction;
    if (col < 1) {
      if (line > 1) {
        line -= 1;
        col = editor.getModel()?.getLineMaxColumn(line) ?? 1;
      } else {
        col = 1;
      }
    } else {
      const maxCol = editor.getModel()?.getLineMaxColumn(line) ?? 1;
      if (col > maxCol) {
        if (line < (editor.getModel()?.getLineCount() ?? 1)) {
          line += 1;
          col = 1;
        } else {
          col = maxCol;
        }
      }
    }
    const newPos = { lineNumber: line, column: col };
    editor.setPosition(newPos);
    editor.revealPositionInCenterIfOutsideViewport(newPos, 0);
    editor.focus();
  }, []);

  const moveCursorVertical = useCallback((direction: -1 | 1) => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const pos = editor.getPosition();
    if (!pos) return;
    const model = editor.getModel();
    if (!model) return;
    const lineCount = model.getLineCount();
    const targetLine = Math.min(Math.max(1, pos.lineNumber + direction), lineCount);
    const maxCol = model.getLineMaxColumn(targetLine);
    const targetCol = Math.min(pos.column, maxCol);
    const newPos = { lineNumber: targetLine, column: targetCol };
    editor.setPosition(newPos);
    editor.revealPositionInCenterIfOutsideViewport(newPos, 0);
    editor.focus();
  }, []);

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
      style={viewportStyle}
      className={`flex flex-col bg-[#0d1017] text-gray-200 border border-gray-800 transition-all duration-75 overflow-hidden ${
        isFullscreen
          ? "fixed inset-0 z-50 w-screen h-screen rounded-none"
          : "w-full h-[88vh] max-h-[900px] rounded-xl shadow-2xl"
      }`}
    >
      {/* VS Code Top Header / Bar */}
      <div className="bg-[#161a23] border-b border-gray-800/80 px-2.5 sm:px-3 py-1.5 sm:py-2 flex items-center justify-between gap-1.5 sm:gap-2 shrink-0 select-none">
        {/* Left: File tab & Worker Name */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <div className="flex items-center gap-1.5 bg-[#12151b] px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-t-md border-t-2 border-t-orange-500 border-x border-gray-800/80 text-xs font-mono text-gray-200">
            <FileCode className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            <span className="font-semibold truncate max-w-[110px] xs:max-w-[150px] sm:max-w-[200px]">
              {workerName ? `${workerName}.js` : "worker.js"}
            </span>
            <Badge
              variant="outline"
              className={`text-[9px] px-1 py-0 h-4 border-none hidden xs:inline-flex ${
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
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
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
                title="Undo"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleRedo}
                className="h-7 w-7 text-gray-400 hover:text-white hover:bg-gray-800"
                title="Redo"
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
            title="Salin kode"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>

          {/* Fullscreen toggle on desktop */}
          {!isMobile && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-7 w-7 text-gray-400 hover:text-white hover:bg-gray-800"
              title={isFullscreen ? "Kecilkan Editor" : "Layar Penuh (Zen Mode)"}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </Button>
          )}

          {/* Save/Deploy button */}
          {!isViewOnly ? (
            <Button
              size="sm"
              onClick={onSave}
              disabled={saving || !workerName.trim() || loading}
              className="h-7 px-2.5 sm:px-3 bg-orange-500 hover:bg-orange-600 text-white font-medium text-xs gap-1 shadow-sm"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{dialogMode === "edit" ? "Simpan" : "Deploy"}</span>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={onClose}
              className="h-7 px-2 border-gray-700 text-gray-300 hover:bg-gray-800 text-xs"
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

      {/* Main Code Editor Area (with Acode gesture interceptor) */}
      <div
        ref={editorContainerRef}
        className="relative flex-1 w-full h-full min-h-0 bg-[#12151b] touch-pan-x touch-pan-y"
      >
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
              padding: { top: 10, bottom: 10 },
            }}
          />
        )}
      </div>

      {/* Termux-style Mobile Touch Action & Shortcut Toolbar */}
      {!isViewOnly && (
        <div className="flex flex-col shrink-0 select-none shadow-md z-30">
          {/* CTRL Active Action Palette (pops up when CTRL is active) */}
          {isCtrlActive && (
            <div className="bg-[#1b2230] border-t border-b border-orange-500/50 px-2 py-1 flex items-center gap-1.5 overflow-x-auto text-xs animate-in slide-in-from-bottom-2 duration-150">
              <span className="text-[10px] font-mono font-bold text-orange-400 bg-orange-500/20 px-1.5 py-0.5 rounded border border-orange-500/30 shrink-0 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping" />
                CTRL +
              </span>
              <button
                type="button"
                onClick={() => handleCtrlAction("find")}
                className="px-2 py-1 bg-[#121620] hover:bg-orange-500/20 active:bg-orange-500/40 text-gray-200 border border-gray-700/80 rounded text-[11px] font-mono shrink-0 flex items-center gap-1"
                title="Buka Search / Find"
              >
                <Search className="w-3 h-3 text-orange-400" /> F (Cari)
              </button>
              <button
                type="button"
                onClick={() => handleCtrlAction("comment")}
                className="px-2 py-1 bg-[#121620] hover:bg-orange-500/20 active:bg-orange-500/40 text-gray-200 border border-gray-700/80 rounded text-[11px] font-mono shrink-0 flex items-center gap-1"
                title="Toggle Komentar //"
              >
                <Code2 className="w-3 h-3 text-yellow-400" /> / (Komentar)
              </button>
              <button
                type="button"
                onClick={() => handleCtrlAction("selectAll")}
                className="px-2 py-1 bg-[#121620] hover:bg-orange-500/20 active:bg-orange-500/40 text-gray-200 border border-gray-700/80 rounded text-[11px] font-mono shrink-0 flex items-center gap-1"
                title="Pilih Semua Kode"
              >
                <CopyCheck className="w-3 h-3 text-blue-400" /> A (Pilih Semua)
              </button>
              <button
                type="button"
                onClick={() => handleCtrlAction("undo")}
                className="px-2 py-1 bg-[#121620] hover:bg-orange-500/20 active:bg-orange-500/40 text-gray-200 border border-gray-700/80 rounded text-[11px] font-mono shrink-0 flex items-center gap-1"
                title="Batalkan Perubahan (Undo)"
              >
                <Undo2 className="w-3 h-3 text-emerald-400" /> Z (Undo)
              </button>
              <button
                type="button"
                onClick={() => handleCtrlAction("redo")}
                className="px-2 py-1 bg-[#121620] hover:bg-orange-500/20 active:bg-orange-500/40 text-gray-200 border border-gray-700/80 rounded text-[11px] font-mono shrink-0 flex items-center gap-1"
                title="Ulangi Perubahan (Redo)"
              >
                <Redo2 className="w-3 h-3 text-emerald-400" /> Y (Redo)
              </button>
              <button
                type="button"
                onClick={() => handleCtrlAction("duplicate")}
                className="px-2 py-1 bg-[#121620] hover:bg-orange-500/20 active:bg-orange-500/40 text-gray-200 border border-gray-700/80 rounded text-[11px] font-mono shrink-0 flex items-center gap-1"
                title="Duplikat Baris Ini"
              >
                <Files className="w-3 h-3 text-purple-400" /> D (Duplikat)
              </button>
              <button
                type="button"
                onClick={() => handleCtrlAction("format")}
                className="px-2 py-1 bg-[#121620] hover:bg-orange-500/20 active:bg-orange-500/40 text-gray-200 border border-gray-700/80 rounded text-[11px] font-mono shrink-0 flex items-center gap-1"
                title="Format Kode"
              >
                <Sparkles className="w-3 h-3 text-emerald-400" /> Alt+F (Rapikan)
              </button>
              <button
                type="button"
                onClick={() => handleCtrlAction("save")}
                className="px-2 py-1 bg-orange-500 text-white hover:bg-orange-600 rounded text-[11px] font-mono shrink-0 flex items-center gap-1 font-semibold"
                title="Simpan Worker"
              >
                <Save className="w-3 h-3" /> S (Simpan)
              </button>
            </div>
          )}

          {/* Main Termux Row */}
          <div className="bg-[#141822] border-t border-gray-800 px-1.5 py-1 flex items-center gap-1 overflow-x-auto shrink-0">
            {/* ESC Key button */}
            <button
              type="button"
              onClick={handleEsc}
              className="px-2 py-1 bg-[#1c2230] hover:bg-orange-500/20 active:bg-orange-500/40 text-gray-300 hover:text-white border border-gray-700/80 rounded text-[11px] font-mono font-bold shrink-0 shadow-xs"
              title="Tombol ESC"
            >
              ESC
            </button>

            {/* TAB Key button */}
            <button
              type="button"
              onClick={() => insertSnippet("  ")}
              className="px-2 py-1 bg-[#1c2230] hover:bg-orange-500/20 active:bg-orange-500/40 text-orange-400 border border-gray-700/80 rounded text-[11px] font-mono font-bold shrink-0 flex items-center gap-1 shadow-xs"
              title="Insert Tab (2 spasi)"
            >
              <ArrowRightToLine className="w-3 h-3" /> TAB
            </button>

            {/* CTRL Key button (Termux style toggle) */}
            <button
              type="button"
              onClick={() => setIsCtrlActive(!isCtrlActive)}
              className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold shrink-0 flex items-center gap-1.5 shadow-xs transition-all ${
                isCtrlActive
                  ? "bg-orange-500 text-white border border-orange-300 shadow-md ring-2 ring-orange-500/50"
                  : "bg-[#1c2230] text-orange-400 hover:text-white hover:bg-orange-500/20 active:bg-orange-500/40 border border-gray-700/80"
              }`}
              title="Toggle Tombol CTRL (Cari, Komentar, Select All, dll)"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isCtrlActive ? "bg-white animate-ping" : "bg-orange-400"}`} />
              CTRL
            </button>

            {/* Cursor Navigation Left, Right, Up, Down (Termux 4-Way Arrow Keys) */}
            <div className="flex items-center bg-[#1c2230] border border-gray-700/80 rounded shrink-0">
              <button
                type="button"
                onClick={() => moveCursor(-1)}
                className="px-1.5 py-1 hover:bg-orange-500/20 active:bg-orange-500/40 text-gray-300 hover:text-white text-xs shrink-0"
                title="Geser Kursor Kiri"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <div className="w-[1px] h-3 bg-gray-700" />
              <button
                type="button"
                onClick={() => moveCursor(1)}
                className="px-1.5 py-1 hover:bg-orange-500/20 active:bg-orange-500/40 text-gray-300 hover:text-white text-xs shrink-0"
                title="Geser Kursor Kanan"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <div className="w-[1px] h-3 bg-gray-700" />
              <button
                type="button"
                onClick={() => moveCursorVertical(-1)}
                className="px-1.5 py-1 hover:bg-orange-500/20 active:bg-orange-500/40 text-gray-300 hover:text-white text-xs shrink-0"
                title="Geser Kursor Atas"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <div className="w-[1px] h-3 bg-gray-700" />
              <button
                type="button"
                onClick={() => moveCursorVertical(1)}
                className="px-1.5 py-1 hover:bg-orange-500/20 active:bg-orange-500/40 text-gray-300 hover:text-white text-xs shrink-0"
                title="Geser Kursor Bawah"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Dismiss Keyboard button */}
            <button
              type="button"
              onClick={dismissKeyboard}
              className="px-2 py-1 bg-[#1c2230] hover:bg-orange-500/20 active:bg-orange-500/40 text-gray-300 hover:text-white border border-gray-700/80 rounded text-[11px] font-mono shrink-0 flex items-center gap-1 shadow-xs"
              title="Tutup Keyboard"
            >
              <Keyboard className="w-3.5 h-3.5 text-gray-400" />
              <ChevronDown className="w-3 h-3 text-orange-400" />
              <span className="hidden xs:inline">Tutup</span>
            </button>

            {/* Smart Brackets pairs */}
            <button
              type="button"
              onClick={() => insertPair("{", "}")}
              className="px-2 py-1 bg-[#1c2230] hover:bg-orange-500/20 active:bg-orange-500/40 text-yellow-400 border border-gray-700/80 rounded text-xs font-mono font-semibold shrink-0"
            >
              &#123; &#125;
            </button>
            <button
              type="button"
              onClick={() => insertPair("(", ")")}
              className="px-2 py-1 bg-[#1c2230] hover:bg-orange-500/20 active:bg-orange-500/40 text-yellow-400 border border-gray-700/80 rounded text-xs font-mono font-semibold shrink-0"
            >
              ( )
            </button>
            <button
              type="button"
              onClick={() => insertPair("[", "]")}
              className="px-2 py-1 bg-[#1c2230] hover:bg-orange-500/20 active:bg-orange-500/40 text-yellow-400 border border-gray-700/80 rounded text-xs font-mono font-semibold shrink-0"
            >
              [ ]
            </button>
            <button
              type="button"
              onClick={() => insertPair('"', '"')}
              className="px-2 py-1 bg-[#1c2230] hover:bg-orange-500/20 active:bg-orange-500/40 text-green-400 border border-gray-700/80 rounded text-xs font-mono font-semibold shrink-0"
            >
              " "
            </button>
            <button
              type="button"
              onClick={() => insertPair("'", "'")}
              className="px-2 py-1 bg-[#1c2230] hover:bg-orange-500/20 active:bg-orange-500/40 text-green-400 border border-gray-700/80 rounded text-xs font-mono font-semibold shrink-0"
            >
              ' '
            </button>

            {/* Symbols */}
            <button
              type="button"
              onClick={() => insertSnippet(" => ")}
              className="px-2 py-1 bg-[#1c2230] hover:bg-orange-500/20 active:bg-orange-500/40 text-purple-400 border border-gray-700/80 rounded text-xs font-mono font-semibold shrink-0"
            >
              =&gt;
            </button>
            <button
              type="button"
              onClick={() => insertSnippet(";")}
              className="px-2 py-1 bg-[#1c2230] hover:bg-orange-500/20 active:bg-orange-500/40 text-gray-200 border border-gray-700/80 rounded text-xs font-mono font-bold shrink-0"
            >
              ;
            </button>
            <button
              type="button"
              onClick={() => insertSnippet(" === ")}
              className="px-2 py-1 bg-[#1c2230] hover:bg-orange-500/20 active:bg-orange-500/40 text-purple-400 border border-gray-700/80 rounded text-xs font-mono shrink-0"
            >
              ===
            </button>
            <button
              type="button"
              onClick={() => insertSnippet("const ")}
              className="px-2 py-1 bg-[#1c2230] hover:bg-orange-500/20 active:bg-orange-500/40 text-blue-400 border border-gray-700/80 rounded text-xs font-mono shrink-0"
            >
              const
            </button>
            <button
              type="button"
              onClick={() => insertSnippet("return ")}
              className="px-2 py-1 bg-[#1c2230] hover:bg-orange-500/20 active:bg-orange-500/40 text-purple-400 border border-gray-700/80 rounded text-xs font-mono shrink-0"
            >
              return
            </button>
            <button
              type="button"
              onClick={() => insertSnippet("async ")}
              className="px-2 py-1 bg-[#1c2230] hover:bg-orange-500/20 active:bg-orange-500/40 text-purple-400 border border-gray-700/80 rounded text-xs font-mono shrink-0"
            >
              async
            </button>
            <button
              type="button"
              onClick={() => insertSnippet("await ")}
              className="px-2 py-1 bg-[#1c2230] hover:bg-orange-500/20 active:bg-orange-500/40 text-purple-400 border border-gray-700/80 rounded text-xs font-mono shrink-0"
            >
              await
            </button>
            <button
              type="button"
              onClick={() => insertSnippet("fetch(")}
              className="px-2 py-1 bg-[#1c2230] hover:bg-orange-500/20 active:bg-orange-500/40 text-orange-400 border border-gray-700/80 rounded text-xs font-mono shrink-0"
            >
              fetch
            </button>
          </div>
        </div>
      )}

      {/* VS Code Bottom Status Bar */}
      <div className="bg-[#0f1217] text-gray-400 border-t border-gray-800/80 px-2.5 sm:px-3 py-1 flex items-center justify-between text-[11px] font-mono shrink-0 select-none z-30">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="flex items-center gap-1 text-orange-400">
            <Cpu className="w-3 h-3" />
            <span>Cloudflare V8</span>
          </span>
          <span>
            Ln {cursorPos.line}, Col {cursorPos.col}
          </span>
          <span className="hidden xs:inline">
            {lineCount} baris ({formattedSize})
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-gray-400 hidden xs:inline">UTF-8</span>
          <span className="text-gray-400">Spasi: 2</span>
          {keyboardHeight > 0 && (
            <span className="text-orange-400 flex items-center gap-1 text-[10px]">
              <Keyboard className="w-3 h-3" /> Keyboard Aktif
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
