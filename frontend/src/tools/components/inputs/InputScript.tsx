import React, { useState, useEffect, useRef, useMemo } from "react";
import $ from "jquery";
import { Dictionary } from "../../../global.ts";
import gsap from "gsap";

import '../highlight-within-textarea/jquery.highlight-within-textarea.js';
//@ts-ignore
import '../highlight-within-textarea/jquery.highlight-within-textarea.css';
import InterpretedDataViewer from "./InterpretedDataViewer.tsx";
import { InterpretedData } from "../../../engine/interpretators/ChaosInterpreter.ts";
import { RenderEngine } from "../../../engine/renderCore/RenderEngine.tsx";

interface InputScriptProps {
  action?: (string) => void,
  value?: string,
  id?: string
  defaultValue?: string,
  height?: string,
  fatherStyle?: string
  onControl: Dictionary<(e: React.KeyboardEvent) => void>
}

export default function InputScript(props: InputScriptProps) {
  const [focus, setFocus] = useState(false);
  // const [textContent, setTextContent] = useState(props.value ?? "");
  const [interpretedData, setInterpretedData] = useState<InterpretedData>({scenes: {}, modules: {}});
  const [fontSize] = useState(16);

  const inputBoxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const caretPosWhenBlur = useRef({ start: 0, end: 0 });

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
      highlight: [
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
    $('#' + id).trigger("load");
  },[props]);

  const hover = () => {
    if ((typeof props.action == "function")) {
      setFocus(true);
      gsap.to(inputBoxRef.current, { borderColor: 'rgb(0, 115, 170)' });
    }
  };

  const action = () => {
    if (inputRef.current) {
      props.action?.(inputRef.current.value);
      RenderEngine
        .getInstance()
        .chaosInstance
        .kreator(inputRef.current.value)
        .then(
          (scenesAndModules: InterpretedData)=>{
            setInterpretedData(scenesAndModules);
          }
        );
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
      </label>
    </>
  );

  return <div className="flex flex-row w-full">
    <div className="w-1/2 h-full">
      {editor}
    </div>
    <div className="w-1/2 h-full">
      <InterpretedDataViewer interpretedData={interpretedData} />
    </div>

  </div>
}