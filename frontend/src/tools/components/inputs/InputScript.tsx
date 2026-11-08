import React, { useState, useEffect, useRef, useMemo } from "react";
import $ from "jquery";
import { Dictionary } from "../../../global.ts";
import gsap from "gsap";

import '../highlight-within-textarea/jquery.highlight-within-textarea.js';
//@ts-ignore
import '../highlight-within-textarea/jquery.highlight-within-textarea.css';
import InterpretedDataViewer from "./InterpretedDataViewer.tsx";
import InstructionPalette from "./InstructionPalette.tsx";
import { ToolbarButton } from "../Buttons.tsx";
import { InterpretedData } from "../../../engine/interpretators/ChaosInterpreter.ts";
import { RenderEngine } from "../../../engine/renderCore/RenderEngine.tsx";
import ScriptGraphEditor from "../../scriptGraph/ScriptGraphEditor.tsx";

interface InputScriptProps {
  action?: (string) => void,
  value?: string,
  id?: string
  defaultValue?: string,
  height?: string,
  fatherStyle?: string
  onControl: Dictionary<(e: React.KeyboardEvent) => void>,
  bottomRightSlot?: React.ReactNode,
  //Route of the edited script: the node editor keeps its box positions in a sidecar <script>.layout.json
  scriptRoute?: string
}

type ViewMode = "text" | "nodes" | "split";

export default function InputScript(props: InputScriptProps) {
  const [focus, setFocus] = useState(false);
  // const [textContent, setTextContent] = useState(props.value ?? "");
  const [interpretedData, setInterpretedData] = useState<InterpretedData>({scenes: {}, modules: {}});
  const [selectedInterpretation, setSelectedInterpretation] = useState<string | null>(null);
  const [paletteVisible, setPaletteVisible] = useState(false);
  //*Node editor: the textarea stays mounted (hidden) as the canonical buffer, so Save/diagnostics keep working
  const [viewMode, setViewMode] = useState<ViewMode>("text");
  const [graphText, setGraphText] = useState("");
  const [caret, setCaret] = useState<number | null>(null);
  const viewModeRef = useRef<ViewMode>("text");
  viewModeRef.current = viewMode;

  const inputBoxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const caretPosWhenBlur = useRef({ start: 0, end: 0 });
  const errorsRef = useRef<Array<{charStart:number, charEnd:number, message:string}>>([]);
  const errorRectsRef = useRef<Array<{
    message: string,
    rect: {left:number, top:number, right:number, bottom:number}
  }>>([]);
  const [hoveredError, setHoveredError] = useState<{ message: string, left: number, top: number } | null>(null);
  const lastSelectionRef = useRef<{ start: number, end: number }>({ start: -1, end: -1 });
  const lastErrorsFingerprintRef = useRef<string>("");
  const fullInterpretationTimerRef = useRef<number>(-1);
  const diagnosticsTimerRef = useRef<number>(-1);
  const selectionTimerRef = useRef<number>(-1);
  //*Sequence id of the latest full interpretation: older (slower) responses are discarded
  const interpretationSeqRef = useRef<number>(0);
  //*Text of the last full interpretation, to skip re-interpreting an unchanged script
  const lastInterpretedTextRef = useRef<string | null>(null);

  const id = useMemo(() => {
    return props.id ?? ("inputScript" + String(window.performance.now()).replaceAll(".", ""));
  }, [props.id]);

  const focusRef = useRef(focus);
  useEffect(() => {
    focusRef.current = focus;
  }, [focus]);

  useEffect(() => {
    // @ts-ignore
    $('#' + id).highlightWithinTextarea({
      highlight: (input: string) => {
        //*The node block regex is expensive (tempered lazy scan): run it once and share
        //*fresh copies of its ranges with the 3 node rules (the plugin mutates range objects)
        const nodeRanges: Array<[number, number]> = [];
        for (const match of input.matchAll(/node( |\t)*:( |\t)*\w+( |\t)*\n(?:(?!node( |\t)*:)[\s\S])+?(?:node( |\t)+ends|end( |\t)+node)( |\t)*$/gm)) {
          nodeRanges.push([match.index!, match.index! + match[0].length]);
        }
        const nodeRangesCopy = () => nodeRanges.map(range => [range[0], range[1]] as [number, number]);
        return [
        //NODE delimitation command
        {
          highlight: nodeRangesCopy(),
          secondPassRegex: /((?<!\n)^( |\t)*node)( |\t)*:( |\t)*\w+( |\t)*\n/g,
          className: 'border-t-3 border-l-1 text-rose-400 m-l-[-1px]'
        },
        {
          highlight: nodeRangesCopy(),
          secondPassRegex: /(( *)(?:node( |\t)+ends|end( |\t)+node)( |\t)*(?!\n)$)/gm,
          className: 'border-b-3 border-r-3 text-rose-400'
        },
        {
          highlight: nodeRangesCopy(),
          className: 'bg-neutral-900'
        },
        //ACTOR commands
        {
          highlight: [/^(move)( |\t)+(\w+)( |\t)+(to)( |\t)+(\w+)( |\t)*$/gm, /^( |\t)*(move)( |\t)+(\w+)( |\t)+(to)( |\t)+(\w+)( |\t)+(in)( |\t)+(\d+)( |\t)*$/gm],
          secondPassRegex: /\b(move|to|in)\b/g,
          className: 'text-amber-700'
        },
        {
          highlight: [/^( |\t)*(\w+)( |\t)+(arrives)( |\t)+(to)( |\t)+(\w+)( |\t)*$/gm, /^( |\t)*(\w+)( |\t)+(arrives)( |\t)+(to)( |\t)+(\w+)( |\t)+(in)( |\t)+(\d+)( |\t)*$/gm],
          secondPassRegex: /\b(arrives|to|in)\b/g,
          className: 'text-amber-700'
        },
        {
          highlight: /^( |\t)*(\w+)( |\t)+(gets)( |\t)+(\w+)( |\t)*$/gm,
          secondPassRegex: /\b(gets)\b/g,
          className: 'text-amber-700'
        },
        {
          highlight: /\/\/[^\*]\s*.*/g,
          className: 'text-[#6272A4]'
        },
        {
          highlight: /\/\/\*\s*.*/g,
          className: 'text-[#98C379]'
        },
        //CREATION command
        {
          highlight: /^( |\t)*\w+( |\t)+=( |\t)+new( |\t)+(GraphObject|TextureAnim|Trigger|KeyboardTrigger|Animation|CodedRoutine|Actor|StageMark)( |\t)*\(/gm,
          className: 'border-t-3 border-l-1 border-blue-400 m-l-[-1px] bg-gray-900'
        },
        {
          highlight: ['GraphObject', 'TextureAnim', 'Trigger', 'KeyboardTrigger', 'Animation', 'CodedRoutine', 'Actor', 'StageMark', '(', ')', '{', '}'],
          className: 'text-[#357FBF]'
        },
        {
          highlight: [/if( {0,})\(/g, /([^A-Za-z\d\w]{0,1})let( {1,})/g, /([^A-Za-z\d\w]{0,1})const( {1,})/g],
          className: 'text-[#DB974D]'
        },
        {
          highlight: '=>',
          className: 'text-[#DB974D]'
        },
        {
          highlight: [/\d/g, '[', ']'],
          className: 'text-[#86DBFD]'
        },
        {
          highlight: [/={1}/g, /\+{1}/g, /-{1}/g, /\*{1}/g, /\/{1}/g, /\<{1}/g, /\>{1}/g, /\+={1}/g, /=={1}/g, /&&{1}/g, /\|\|{1}/g, 'new'],
          className: 'text-[#E53935]'
        },
        {
          highlight: [/"(.*?)"/g],
          className: 'text-[#A18649]'
        },
        {
          highlight: [/^\s*(run){1}(\W)/gm, /^\s*(play){1}(\W)/gm, /^\s*(wait){1}(\W)/gm, /^\s*(resume){1}(\W)/gm, /^\s*(show){1}(\W)/gm, /^\s*(load){1}(\W)/gm],
          className: 'text-green-600'
        },
        //SET command
        {
          highlight: [/^( |\t)*(set)( |\t)+(GraphObject|TextureAnim|Trigger|KeyboardTrigger|Animation|CodedRoutine|Actor|StageMark|Engine)/gm],
          secondPassRegex: /(set)/gm,
          className: 'text-teal-500'
        },
        {
          highlight: [/^( |\t)*(set)( |\t)+(GraphObject|TextureAnim|Trigger|KeyboardTrigger|Animation|CodedRoutine|Actor|StageMark|Engine)( |\t)+\w+/gm],
          secondPassRegex: /(set)( |\t)+(GraphObject|TextureAnim|Trigger|KeyboardTrigger|Animation|CodedRoutine|Actor|StageMark|Engine)( |\t)+\w+/gm,
          className: 'border-t-3 border-l-1 border-teal-500 m-l-[-1px] bg-slate-950'
        },
        //WRITING ERROR marks
        ...errorsRef.current.map((error) => {
          return {
            highlight: [error.charStart, error.charEnd] as [number, number],
            className: 'hwt-error border-b-2 border-b-red-500 bg-red-900/40',
            title: error.message
          };
        })
        ];
      }
    });

    const handleClickOutside = (e: MouseEvent) => {
      if (inputBoxRef.current && !inputBoxRef.current.contains(e.target as Node) && focusRef.current) {
        unhover();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [id]);

  //*Only when the loaded content (or the editor) really changes: depending on the whole `props`
  //*object re-ran this on every parent render, wiping unsaved edits and re-interpreting everything
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.value = props.defaultValue ?? "";
    }
    setGraphText(props.defaultValue ?? "");
    refreshDiagnostics();
    runFullInterpretation(true);
    $('#' + id).trigger("load");
  },[props.defaultValue, id]);

  useEffect(() => {
    return () => {
      if (fullInterpretationTimerRef.current != -1) { clearTimeout(fullInterpretationTimerRef.current); }
      if (diagnosticsTimerRef.current != -1) { clearTimeout(diagnosticsTimerRef.current); }
      if (selectionTimerRef.current != -1) { clearTimeout(selectionTimerRef.current); }
      interpretationSeqRef.current++; //Discards any interpretation still in flight
    };
  }, []);

  const hover = () => {
    if ((typeof props.action == "function")) {
      setFocus(true);
      gsap.to(inputBoxRef.current, { borderColor: 'rgb(0, 115, 170)' });
    }
  };

  const clearSelectionTimer = () => {
    if (selectionTimerRef.current != -1) {
      clearTimeout(selectionTimerRef.current);
      selectionTimerRef.current = -1;
    }
  };

  const interpretSelection = () => {
    const element = inputRef.current;
    if (!element) { return; }
    const fragment = element.value.substring(element.selectionStart, element.selectionEnd);
    if (fragment == "") { return; }
    const chaos = RenderEngine.getInstance().chaosInstance;
    try {
      setSelectedInterpretation(chaos.fragmentKreator(fragment));
    } catch (error) {
      console.error("Error while interpreting the selected fragment: ", error);
      setSelectedInterpretation(null);
    }
  };

  const handleSelectionChange = () => {
    const element = inputRef.current;
    if (!element) { return; }
    const start = element.selectionStart;
    const end = element.selectionEnd;
    if (viewModeRef.current == "split") { setCaret(start); }
    const previous = lastSelectionRef.current;
    if (start == previous.start && end == previous.end) {
      return; //Pure caret movement or same selection: no-op
    }
    lastSelectionRef.current = { start, end };
    if (start == end && previous.start == previous.end && previous.start != -1) {
      return; //Collapsed selection unchanged span: no-op (ordinary caret move)
    }
    clearSelectionTimer();
    if (start != end) {
      //*onSelect fires continuously while dragging: interpret only once the selection settles
      selectionTimerRef.current = window.setTimeout(() => {
        selectionTimerRef.current = -1;
        interpretSelection();
      }, 150);
    } else {
      //*Back to the full view: the last full interpretation is still valid unless the text changed
      setSelectedInterpretation(null);
      if (element.value != lastInterpretedTextRef.current) {
        scheduleFullInterpretation();
      }
    }
  };

  const scheduleFullInterpretation = () => {
    if (fullInterpretationTimerRef.current != -1) {
      clearTimeout(fullInterpretationTimerRef.current);
    }
    fullInterpretationTimerRef.current = window.setTimeout(() => {
      fullInterpretationTimerRef.current = -1;
      runFullInterpretation();
    }, 250);
  };

  const runFullInterpretation = (force = false) => {
    const element = inputRef.current;
    if (!element) { return; }
    const text = element.value;
    if (!force && text == lastInterpretedTextRef.current) { return; }
    lastInterpretedTextRef.current = text;
    const chaos = RenderEngine.getInstance().chaosInstance;
    const seq = ++interpretationSeqRef.current;
    clearSelectionTimer();
    setSelectedInterpretation(null);
    //*previewKreator: no reload of every project script per call and no mutation of the engine's scenes/modules
    chaos.previewKreator(text)
      .then((scenesAndModules: InterpretedData) => {
        if (seq != interpretationSeqRef.current) { return; } //Stale: a newer interpretation was requested
        setInterpretedData(scenesAndModules);
      })
      .catch((error) => {
        if (seq != interpretationSeqRef.current) { return; }
        console.error("Error while interpreting the script: ", error);
      });
  };

  const refreshDiagnostics = () => {
    const element = inputRef.current;
    if (!element) { return; }
    const chaos = RenderEngine.getInstance().chaosInstance;
    try {
      errorsRef.current = chaos.checkScriptForErrors(element.value);
    } catch (error) {
      console.error("Error while checking the script for writing errors: ", error);
      errorsRef.current = [];
    }
    const errorsFingerprint = errorsRef.current.map(span=>{
      return `${span.charStart}:${span.charEnd}:${span.message}`;
    }).join("|");
    if (errorsFingerprint != lastErrorsFingerprintRef.current) {
      lastErrorsFingerprintRef.current = errorsFingerprint;
      // @ts-ignore
      $('#' + id).highlightWithinTextarea("update");
      cacheErrorRects();
    }
  };

  const refreshDiagnosticsDebounced = () => {
    if (diagnosticsTimerRef.current != -1) {
      clearTimeout(diagnosticsTimerRef.current);
    }
    diagnosticsTimerRef.current = window.setTimeout(() => {
      diagnosticsTimerRef.current = -1;
      refreshDiagnostics();
    }, 250);
  };

  //*Error rects are stored relative to the textarea CONTENT (box offset + scroll at capture time),
  //*so scrolling doesn't need a DOM query + getBoundingClientRect per error on every scroll event
  const cacheErrorRects = () => {
    const element = inputRef.current;
    if (!element) { return; }
    const errorSpans = $(element.parentElement).find(".hwt-highlights .hwt-error").get() as Array<HTMLElement>;
    if (errorSpans.length == 0) {
      errorRectsRef.current = [];
      return;
    }
    const box = element.getBoundingClientRect();
    const scrollTop = element.scrollTop;
    const scrollLeft = element.scrollLeft;
    errorRectsRef.current = errorSpans.map(span=>{
      const rect = span.getBoundingClientRect();
      return {
        message: span.getAttribute("title") ?? "",
        rect: {
          left: rect.left - box.left + scrollLeft,
          top: rect.top - box.top + scrollTop,
          right: rect.right - box.left + scrollLeft,
          bottom: rect.bottom - box.top + scrollTop
        }
      };
    });
  };

  const handleMouseHover = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    if (errorRectsRef.current.length == 0) {
      if (hoveredError != null) { setHoveredError(null); }
      return;
    }
    const element = e.currentTarget;
    const box = element.getBoundingClientRect();
    //*Mouse position in content coordinates
    const x = e.clientX - box.left + element.scrollLeft;
    const y = e.clientY - box.top + element.scrollTop;
    const hovered = errorRectsRef.current.find(entry=>{
      const rect = entry.rect;
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    });
    if (hovered) {
      const left = hovered.rect.left - element.scrollLeft;
      const top = hovered.rect.bottom - element.scrollTop;
      //*Only re-render when the tooltip really changes (mousemove fires constantly)
      setHoveredError((current) => {
        if (current != null && current.message == hovered.message && current.left == left && current.top == top) {
          return current;
        }
        return { message: hovered.message, left, top };
      });
    } else {
      setHoveredError((current) => current != null ? null : current);
    }
  };

  const clearMouseHover = () => {
    setHoveredError(null);
  };

  const action = () => {
    if (inputRef.current) {
      if (viewModeRef.current != "text") { setGraphText(inputRef.current.value); }
      props.action?.(inputRef.current.value);
      refreshDiagnosticsDebounced();
      scheduleFullInterpretation();
    }
  };

  const unhover = () => {
    setFocus(false);
    gsap.to(inputBoxRef.current, { borderColor: '#000' });

    //*DevelopMode
    if (typeof props.action == "undefined" && inputRef.current) {
      inputRef.current.value = "NoFunctionToCallback";
    }
    //*EndDevelopMode
  };

  //*Replaces the current selection with `text` as a native edit: keeps the undo history (Ctrl+Z)
  //*and avoids rewriting the whole textarea value. The resulting "input" event drives
  //*onChange -> action() and the highlighter, so nothing else has to be triggered by hand.
  const insertTextAtSelection = (element: HTMLTextAreaElement, text: string) => {
    if (document.activeElement !== element) { element.focus(); }
    let inserted = false;
    try {
      inserted = (text == "")
        ? (element.selectionStart == element.selectionEnd || document.execCommand("delete", false))
        : document.execCommand("insertText", false, text);
    } catch (error) {
      inserted = false;
    }
    if (!inserted) {
      //*Fallback (no undo history): direct range replacement + manual notifications
      element.setRangeText(text, element.selectionStart, element.selectionEnd, "end");
      action();
      $(element).trigger("load");
    }
  };

  const insertInstructionAtCaret = (text: string) => {
    const element = inputRef.current;
    if (!element) { return; }
    //*A blurred textarea keeps its selection, so focusing it restores the caret where it was
    if (document.activeElement !== element) { element.focus(); }
    const selStart = element.selectionStart;
    const selEnd = element.selectionEnd;
    const needsLeadingBreak = selStart > 0 && element.value[selStart - 1] != "\n";
    const needsTrailingBreak = element.value[selEnd] != undefined && element.value[selEnd] != "\n";
    const wrap = needsLeadingBreak ? "\n" : "";
    const trailingBreak = needsTrailingBreak ? "\n" : "";
    insertTextAtSelection(element, wrap + text + trailingBreak);
  };

  //*Node editor edits: replace the whole buffer (the graph keeps its own undo history)
  const replaceAllText = (newText: string) => {
    const element = inputRef.current;
    if (!element) { return; }
    element.value = newText;
    setGraphText(newText);
    action();
    $(element).trigger("load");
  };

  const selectSpanInText = (span: [number, number]) => {
    const element = inputRef.current;
    if (!element || viewModeRef.current != "split") { return; }
    element.focus({ preventScroll: true });
    element.setSelectionRange(span[0], span[1]);
    const lineHeight = parseFloat(getComputedStyle(element).lineHeight) || 18;
    const line = element.value.slice(0, span[0]).split("\n").length - 1;
    element.scrollTop = Math.max(0, line * lineHeight - element.clientHeight / 3);
  };

  const switchView = (mode: ViewMode) => {
    if (mode != "text" && inputRef.current) { setGraphText(inputRef.current.value); }
    setViewMode(mode);
  };

  const viewToggle = (
    <div className="flex rounded-md overflow-hidden border border-neutral-600" title="Cambiar la forma de editar el script">
      {([["text", "✍ Texto"], ["nodes", "◇ Nodos"], ["split", "◫ Ambos"]] as Array<[ViewMode, string]>).map(([mode, label]) => (
        <button
          key={mode}
          onClick={() => switchView(mode)}
          className={`text-[12px] px-2 py-1 ${viewMode == mode ? "bg-sky-700 text-white" : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  let height = props.height ? ' ' + props.height + ' ' : ' h-36 ';
  let fatherStyle = props.fatherStyle ? ' ' + props.fatherStyle + ' ' : 'bg-transparent';

  const editor = (
    <>
      <label htmlFor={id} onClick={() => { hover() }} className="p-0 m-0 relative h-full w-full">
        <div
          ref={inputBoxRef}
          className={"p-0 h-full select-none w-full overflow-x-hidden " + fatherStyle}
        >
          <textarea
            className={height + "w-full resize-none outline-none align-top border-none bg-transparent text-transparent caret-white p-2"}
            onBlur={(e) => {
              const element = e.currentTarget;
              const start = element.selectionStart;
              const end = element.selectionEnd;
              caretPosWhenBlur.current = { start: start, end: end };
            }}
            defaultValue={props.value ?? ""}
            ref={inputRef}
            name={id}
            id={id}
            spellCheck={false}
            onChange={() => action()}
            onSelect={handleSelectionChange}
            onMouseUp={handleSelectionChange}
            onMouseMove={handleMouseHover}
            onMouseLeave={clearMouseHover}
            onKeyUp={e => {
              if (e.key == "Tab") { e.preventDefault(); }
            }}
            onKeyDown={e => {
              if (e.ctrlKey) {
                if ("onControl" in props) {
                  if (e.key in props.onControl) { props.onControl[e.key](e); }
                }
              } else {
                if (e.key == 'Tab') {
                  e.preventDefault();
                  const element = e.currentTarget;
                  const start = element.selectionStart;
                  const end = element.selectionEnd;

                  if (e.shiftKey) {
                    //*Outdent: remove up to 2 spaces right before the selection start (only spaces,
                    //*and without deleting the selected text)
                    let spaces = 0;
                    while (spaces < 2 && start - spaces > 0 && element.value[start - spaces - 1] == " ") { spaces++; }
                    if (spaces > 0) {
                      element.setSelectionRange(start - spaces, start);
                      insertTextAtSelection(element, "");
                      element.setSelectionRange(start - spaces, end - spaces);
                    }
                  } else {
                    insertTextAtSelection(element, "  ");
                  }
                }
                if (e.key == 'Enter') {
                  e.preventDefault();
                  insertTextAtSelection(e.currentTarget, "\n");
                }
              }
            }} />
        </div>
        {
          (hoveredError != null) &&
          <div
            className="absolute z-40 max-w-sm px-2 py-1 rounded bg-red-950 border border-red-500 text-red-100 text-[11px] whitespace-normal pointer-events-none shadow-lg shadow-black/60"
            style={{ left: hoveredError.left + 12, top: hoveredError.top + 16 }}
          >
            {hoveredError.message}
          </div>
        }
      </label>
    </>
  );

  const textWidth = viewMode == "text" ? "w-1/2" : viewMode == "split" ? "w-1/3" : "hidden";

  return <div className="flex flex-row w-full relative">
    <div className={textWidth + " h-full relative"}>
      <InstructionPalette
        visible={paletteVisible}
        onClose={() => { setPaletteVisible(false) }}
        onInsert={(syntax) => { insertInstructionAtCaret(syntax) }}
      />
      {editor}
    </div>
    {viewMode == "text"
      ? <div className="w-1/2 h-full">
          <InterpretedDataViewer interpretedData={interpretedData} selectionInterpretation={selectedInterpretation} />
        </div>
      : <div className={(viewMode == "split" ? "w-2/3 border-l border-neutral-700" : "w-full") + " h-full relative"}>
          <ScriptGraphEditor
            text={graphText}
            onChange={replaceAllText}
            scriptRoute={props.scriptRoute}
            onSelectSpan={selectSpanInText}
            caret={viewMode == "split" ? caret : null}
            toolbarExtra={viewToggle}
          />
        </div>}
    <div className="absolute bottom-1 right-1 z-30 flex flex-row gap-1 items-start">
      {props.bottomRightSlot}
      {viewMode == "text" && <>
        <ToolbarButton
          text="◇ Ver como nodos"
          action={() => { switchView("nodes") }}
          title="Editar el script visualmente, como un mapa de la historia"
        />
        <ToolbarButton
          text="⌘ Instructions"
          action={() => { setPaletteVisible(!paletteVisible) }}
          hide={paletteVisible}
          title="Instruction palette"
        />
      </>}
    </div>
  </div>
}