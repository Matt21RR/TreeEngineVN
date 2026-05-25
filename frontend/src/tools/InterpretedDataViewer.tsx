import React, { useEffect, useState } from 'react';
import { InterpretedData } from "../engine/interpretators/ChaosInterpreter.ts";
import Prism from 'prismjs';

import * as prettier from 'prettier/standalone';
import babelParser from 'prettier/plugins/babel';
import estreeParser from 'prettier/plugins/estree';

//@ts-ignore
import 'prismjs/themes/prism-tomorrow.css';
//@ts-ignore
import 'prismjs/components/prism-javascript';

//* Formats with pretier
//* Hightlights with PrismJS
function FormattedCodeBlock({ codeString, language = 'javascript' }: { codeString: string; language?: string }) {
  const [highlightedHtml, setHighlightedHtml] = useState<string>('');

  useEffect(() => {
    async function formatAndHighlight() {
      try {
        const sanitized = codeString.replace(/\\n/g, '\n');

        const parserType = language === 'json' ? 'json' : 'babel';

        // aSYNC prettier call
        const formattedCode = await prettier.format(sanitized, {
          parser: parserType,
          plugins: [babelParser, estreeParser],
          printWidth: 70,
          tabWidth: 2,
          semi: true,
          singleQuote: true
        });

        //Prism Highlights
        const highlighted = Prism.highlight(
          formattedCode,
          Prism.languages[language] || Prism.languages.javascript,
          language
        );
        
        setHighlightedHtml(highlighted);
      } catch (error) {
        console.error(`Prettier falló al formatear (${language}):`, error);
        setHighlightedHtml(Prism.highlight(codeString, Prism.languages[language] || Prism.languages.javascript, language));
      }
    }

    formatAndHighlight();
  }, [codeString, language]);

  return (
    <pre className="p-4 overflow-x-auto text-sm bg-gray-900 rounded-md my-2 border border-gray-800">
      <code 
        className={`language-${language}`}
        dangerouslySetInnerHTML={{ __html: highlightedHtml || "Formating code..." }} 
      />
    </pre>
  );
}

export default function InterpretedDataViewer({ interpretedData }: { interpretedData: InterpretedData }) {

  const scenesDataViewer = () => {
    return (
      <div className="flex flex-col w-full h-full gap-2">
        <h2 className="text-2xl font-bold">Scenes</h2>
        <div className="flex flex-col w-full h-full gap-4 overflow-y-auto">
          {Object.entries(interpretedData.scenes).map(([sceneName, sceneData]) => {
            return (
              <div key={sceneName} className="flex flex-col w-full gap-2 p-4 bg-gray-800 bg-opacity-50 rounded shadow-md">
                <h3 className="text-xl font-bold text-blue-400 border-b border-gray-700 pb-1">{sceneName}</h3>
                
                {/* SCENE CODE */}
                <FormattedCodeBlock codeString={sceneData.main} language="javascript" />

                <div className="flex flex-col w-full h-auto gap-3 mt-2">
                  <h4 className="text-lg font-semibold text-gray-300">Nodes:</h4>
                  {Object.entries(sceneData.nodes).map(([nodeName, nodeData]) => {
                    
                    const nodeDataString = typeof nodeData === 'string' ? nodeData : JSON.stringify(nodeData);

                    return (
                      <div key={nodeName} className="flex flex-col w-full h-auto gap-1 p-3 bg-gray-700 bg-opacity-40 rounded">
                        <h5 className="text-md font-medium text-green-400 font-mono">{nodeName}</h5>
                        
                        {/* NODE CODE */}
                        <FormattedCodeBlock codeString={nodeDataString} language="javascript" />
                        
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    );
  }

  const modulesDataViewer = () => {
    return (
      <div className="flex flex-col w-full h-full gap-2">
        <h2 className="text-2xl font-bold">Modules</h2>
        <div className="flex flex-col w-full h-full gap-2 overflow-y-auto">
          {Object.entries(interpretedData.modules).map(([moduleName, moduleData]) => {
            const moduleDataString = typeof moduleData === 'string' ? moduleData : JSON.stringify(moduleData);
            return (
              <div key={moduleName} className="flex flex-col w-full h-auto gap-1 p-3 bg-gray-800 bg-opacity-50 rounded">
                <h3 className="text-xl font-semibold text-purple-400">{moduleName}</h3>
                
                <FormattedCodeBlock codeString={moduleDataString} language="javascript" />
                
              </div>
            )
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full gap-6 p-4 text-white overflow-y-auto">
      {(Object.keys(interpretedData.scenes).length > 0) ? scenesDataViewer() : null}
      {(Object.keys(interpretedData.modules).length > 0) ? modulesDataViewer() : null}
    </div>
  )
}