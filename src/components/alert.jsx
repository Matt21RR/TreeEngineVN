import React from "react";
class Alert extends React.Component{
  render(){
    return(
      <div className={"z-30 inline-flex rounded-md absolute left-3 p-1 bg-cyan-600 text-white "+(this.props.gallery == undefined ? "bottom-12":"bottom-3")}> 
        <div className=" mx-1 w-7 h-7">
          <svg importance="high" className="loadIconAlter" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path style={{ fill: '#fff' }} d="M12 22c5.421 0 10-4.579 10-10h-2c0 4.337-3.663 8-8 8s-8-3.663-8-8c0-4.336 3.663-8 8-8V2C6.579 2 2 6.58 2 12c0 5.421 4.579 10 10 10z" /></svg>
        </div>
        {this.props.text}
      </div>
    );
  }
}
class Notify extends React.Component{
  render(){
    return(
      <div className={"z-30 inline-flex rounded-md absolute bottom-12 left-3 py-2 px-2 bg-amber-600 text-white "+(this.props.gallery == undefined ? "bottom-12":"bottom-3")}>
        {this.props.text}
      </div>
    );
  }
}

export {Alert,Notify};