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

interface InputScriptProps {
  action?: (string) => void,
  value?: string,
  id?: string
  defaultValue?: string,
  height?: string,
  fatherStyle?: string
  onControl: Dictionary<(e: React.KeyboardEvent) => void>,
  bottomRightSlot?: React.ReactNode
}

export default function InputScript(props: InputScriptProps) {
  const [focus, setFocus] = useState(false);
  // const [textContent, setTextContent] = useState(props.value ?? "");
  const [interpretedData, setInterpretedData] = useState<InterpretedData>({scenes: {}, modules: {}});
  const [selectedInterpretation, setSelectedInterpretation] = useState<string | null>(null);
  const [paletteVisible, setPaletteVisible] = useState(false);

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
      highlight: (input) => [
        //NODE delimitation command
        {
          highlight: /node( |\t)+:( |\t)+\w+( |\t)*\n(?:(?!node( |\t)+:)[\s\S])+?node( |\t)+ends( |\t)*$/gm,
          secondPassRegex: /((?<!\n)^node)( |\t)+:( |\t)+\w+( |\t)*\n/g,
          className: 'border-t-3 border-l-1 text-rose-400 m-l-[-1px]'
        },
        {
          highlight: /node( |\t)+:( |\t)+\w+( |\t)*\n(?:(?!node( |\t)+:)[\s\S])+?node( |\t)+ends( |\t)*$/gm,
          secondPassRegex: /(( *)node( |\t)+ends( |\t)*(?!\n)$)/gm,
          className: 'border-b-3 border-r-3 text-rose-400'
        },
        {
          highlight: /node( |\t)+:( |\t)+\w+( |\t)*\n(?:(?!node( |\t)+:)[\s\S])+?node( |\t)+ends( |\t)*$/gm,
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
      ]
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

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.value = props.defaultValue ?? "";
    }
    refreshDiagnostics();
    runFullInterpretation();
    $('#' + id).trigger("load");
  },[props]);

  useEffect(() => {
    return () => {
      if (fullInterpretationTimerRef.current != -1) { clearTimeout(fullInterpretationTimerRef.current); }
      if (diagnosticsTimerRef.current != -1) { clearTimeout(diagnosticsTimerRef.current); }
    };
  }, []);

  const hover = () => {
    if ((typeof props.action == "function")) {
      setFocus(true);
      gsap.to(inputBoxRef.current, { borderColor: 'rgb(0, 115, 170)' });
    }
  };

  const handleSelectionChange = () => {
    const element = $("#" + id).get(0) as HTMLTextAreaElement;
    if (!element) { return; }
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const previous = lastSelectionRef.current;
    if (start == previous.start && end == previous.end) {
      return; //Pure caret movement or same selection: no-op
    }
    lastSelectionRef.current = { start, end };
    if (start == end && previous.start == previous.end && previous.start != -1) {
      return; //Collapsed selection unchanged span: no-op (ordinary caret move)
    }
    const fragment = element.value.substring(start, end);
    const chaos = RenderEngine.getInstance().chaosInstance;
    if (fragment != "") {
      try {
        setSelectedInterpretation(chaos.fragmentKreator(fragment));
      } catch (error) {
        console.error("Error while interpreting the selected fragment: ", error);
        setSelectedInterpretation(null);
        scheduleFullInterpretation();
      }
    } else {
      setSelectedInterpretation(null);
      scheduleFullInterpretation();
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

  const runFullInterpretation = () => {
    const element = $("#" + id).get(0) as HTMLTextAreaElement;
    if (!element) { return; }
    const chaos = RenderEngine.getInstance().chaosInstance;
    setSelectedInterpretation(null);
    chaos.kreator(element.value)
      .then((scenesAndModules: InterpretedData) => {
        setInterpretedData(scenesAndModules);
      });
  };

  const refreshDiagnostics = () => {
    const element = $("#" + id).get(0) as HTMLTextAreaElement;
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

  const cacheErrorRects = () => {
    const element = $("#" + id).get(0) as HTMLTextAreaElement;
    if (!element) { return; }
    const errorSpans = $(element.parentElement).find(".hwt-highlights .hwt-error").get() as Array<HTMLElement>;
    errorRectsRef.current = errorSpans.map(span=>{
      const rect = span.getBoundingClientRect();
      return {
        message: span.getAttribute("title") ?? "",
        rect: {
          left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom
        }
      };
    });
  };

  const handleMouseHover = (e: React.MouseEvent) => {
    const hovered = errorRectsRef.current.find(entry=>{
      const rect = entry.rect;
      return (
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom
      );
    });
    if (hovered) {
      const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setHoveredError({
        message: hovered.message,
        left: hovered.rect.left - box.left,
        top: hovered.rect.bottom - box.top
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

  const insertInstructionAtCaret = (text: string) => {
    const element = $("#" + id).get(0) as HTMLTextAreaElement;
    if (!element) { return; }
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const needsLeadingBreak = start > 0 && element.value[start - 1] != "\n";
    const needsTrailingBreak = element.value[end] != undefined && element.value[end] != "\n";
    const wrap = needsLeadingBreak ? "\r\n" : "";
    const trailingBreak = needsTrailingBreak ? "\r\n" : "";
    const insertion = wrap + text + trailingBreak;

    element.value = element.value.substring(0, start) + insertion + element.value.substring(end);
    element.selectionStart = element.selectionEnd = start + insertion.length;
    element.focus();
    action();
    $('#' + id).trigger("load");
  };

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
              const element = $("#" + id).get(0) as HTMLTextAreaElement;
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
            onScroll={cacheErrorRects}
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
                  const element = $("#" + id).get(0) as HTMLTextAreaElement;
                  const start = element.selectionStart;
                  const end = element.selectionEnd;

                  if (e.shiftKey) {
                    // set textarea value to: text before caret + tab + text after caret
                    element.value = element.value.substring(0, start - 2) + element.value.substring(end);
                    // put caret at right position again
                    element.selectionStart =
                      element.selectionEnd = start - 2;
                  } else {
                    // set textarea value to: text before caret + tab + text after caret
                    element.value = element.value.substring(0, start) +
                      "  " + element.value.substring(end);

                    // put caret at right position again
                    element.selectionStart =
                      element.selectionEnd = start + 2;
                  }

                  action();
                  $('#' + id).trigger("load");
                }
                if (e.key == 'Enter') { //Avoid autoscroll on enter
                  e.preventDefault();
                  const element = $("#" + id).get(0) as HTMLTextAreaElement;
                  const start = element.selectionStart;
                  const end = element.selectionEnd;

                  // set textarea value to: text before caret + tab + text after caret
                  element.value = element.value.substring(0, start) +
                    '\r\n' + element.value.substring(end);

                  action();
                  $('#' + id).trigger("load");
                  // put caret at right position again
                  element.selectionStart = element.selectionEnd = start + 1;
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

  return <div className="flex flex-row w-full relative">
    <div className="w-1/2 h-full relative">
      <InstructionPalette
        visible={paletteVisible}
        onClose={() => { setPaletteVisible(false) }}
        onInsert={(syntax) => { insertInstructionAtCaret(syntax) }}
      />
      {editor}
    </div>
    <div className="w-1/2 h-full">
      <InterpretedDataViewer interpretedData={interpretedData} selectionInterpretation={selectedInterpretation} />
    </div>
    <div className="absolute bottom-1 right-1 z-30 flex flex-row gap-1 items-start">
      {props.bottomRightSlot}
      <ToolbarButton
        text="⌘ Instructions"
        action={() => { setPaletteVisible(!paletteVisible) }}
        hide={paletteVisible}
        title="Instruction palette"
      />
    </div>
  </div>
}