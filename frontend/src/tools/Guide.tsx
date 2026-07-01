import { RequestFile } from '../../wailsjs/go/main/App.js';
import MarkdownPreview from '@uiw/react-markdown-preview';
import React from 'react';


export default function Guide() {
  const [guideContent, setGuideContent] = React.useState<string>("");
  try {
    RequestFile("./docs/scriptingDoc.md")
    .then(res=> atob(res))
    .then(decodedContent => {
      setGuideContent(decodedContent);
    });
  } catch (error) {
    console.error("Error loading guide content:", error);
  }
  return (
    <div className="">
      <h2>Guide</h2>
      {guideContent ? (
        // @ts-ignore
        <MarkdownPreview source={guideContent}  style={{ padding: "8%" }} />
      ) : (
        <p>Loading guide content...</p>
      )}
    </div>
  );
}