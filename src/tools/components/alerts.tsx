import React from "react";

type LoadingProps = {
  hide?:boolean,
  text: string
}


export default function Loading ({hide,text}:LoadingProps) {
  return(
    <div className={`z-30 rounded-md absolute left-2 p-1 bg-cyan-600 text-white bottom-2 ${((hide) ? "hidden":"inline-flex")}`}> 
      <div className=" mx-1 w-7 h-7">
        <svg className="loadIconAlter" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
          <path style={{ fill: '#fff' }} d="M12 22c5.421 0 10-4.579 10-10h-2c0 4.337-3.663 8-8 8s-8-3.663-8-8c0-4.336 3.663-8 8-8V2C6.579 2 2 6.58 2 12c0 5.421 4.579 10 10 10z" />
        </svg>
      </div>
      {text}
    </div>
  );
}