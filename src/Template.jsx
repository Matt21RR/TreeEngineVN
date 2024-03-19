import gsap from 'gsap';
import React from 'react';
import { Config } from './sections/Config';
import { GameEnvironment } from './sections/GameEnvironment';
import { MainMenu } from "./sections/MainMenu";
import { SavedGamesScreen } from "./sections/SavedGamesScreen";

import $ from "jquery";


class Template extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      section: 0,
      actualNode: null,
      storyVars: null,
      ingameSavedGamesList: false,
      aspectRatio: "unset",
      componentMounted:false,
    }
    this.resizeTimeout = 0;
    this.gameScript = null;
    this.componentMounted = false;

  }
  componentDidMount() {
    if (!this.componentMounted) {
      this.componentMounted = true;

      window.setTimeout(() => {
        if (Object.keys(localStorage).indexOf("aspectRatio") != -1) {
          this.setState({ aspectRatio: localStorage.getItem("aspectRatio") }, () => {
            this.aspectRatioCalc(null,()=>{this.setState({componentMounted:true});});
            
          });
        } else {
          localStorage.setItem("aspectRatio", "unset");
        }

        window.addEventListener('resize', () => {
          gsap.to(document.getElementById("display"), 0, { opacity: 0 });
          clearTimeout(this.resizeTimeout);
          this.resizeTimeout = setTimeout(
            () => {
              this.aspectRatioCalc();
              gsap.to(document.getElementById("display"), 0, { opacity: 1 });
            }, 1000);
        });
      }, 200);
    }
  }
  aspectRatioCalc(op = null,fun = null) {
    if (op != null) {
      this.setState({ aspectRatio: op }, () => { localStorage.setItem("aspectRatio", op) });
    } else {
      op = this.state.aspectRatio;
    }
    if (op != "unset") {
      let newWidth = Math.floor((window.innerHeight / (op.split(":")[1] * 1)) * (op.split(":")[0] * 1));
      let newHeight = Math.floor((window.innerWidth / (op.split(":")[0] * 1)) * (op.split(":")[1] * 1));
      if (newWidth <= window.innerWidth) {
        document.getElementById("display").style.width = newWidth + "px";
        document.getElementById("display").style.height = window.innerHeight + "px";
      } else {
        document.getElementById("display").style.width = window.innerWidth + "px";
        document.getElementById("display").style.height = newHeight + "px";
      }

    } else {
      document.getElementById("display").style.width = "";
      document.getElementById("display").style.height = "";
    }
    console.log(document.getElementById("display").style.width,
    document.getElementById("display").style.height);
    if(fun != null){
      fun();
    }
  }
  changeSection(sectionToLoad) {
    this.setState({ section: sectionToLoad });
  }
  renderSection() {
    if(this.state.componentMounted){
      switch (this.state.section) {
        case 0://MainMenu
          return (
            <MainMenu
              loadSavedGame={(actualNode, storyVars, onComplete) => { this.setState({ actualNode: actualNode, storyVars: storyVars }, () => { onComplete(); }) }}
              loadNewGame={(onComplete) => { this.setState({ actualNode: null, storyVars: new Object() }, () => { onComplete(); }) }}
              changeSection={(sectionToLoad) => { this.changeSection(sectionToLoad) }}
  
              aspectRatioCalc={(op) => { this.aspectRatioCalc(op) }}
            />
          );
          break;
        case 1://SavedGamesScreeen
          return (
            <SavedGamesScreen
              loadSavedGame={(actualNode, storyVars, onComplete) => { this.setState({ actualNode: actualNode, storyVars: storyVars }, () => { onComplete(); }) }}
              changeSection={(sectionToLoad) => { this.changeSection(sectionToLoad) }}
            />
          );
          break;
        case 2://GameEnvironment
          return (
            <GameEnvironment
              storyVars={this.state.storyVars}
              actualNode={this.state.actualNode}
              gameScript={this.gameScript}
              changeSection={(sectionToLoad) => { this.changeSection(sectionToLoad) }}
  
              loadSavedGame={(actualNode, storyVars, onComplete) => { this.setState({ actualNode: actualNode, storyVars: storyVars }, () => { onComplete(); }) }}
              aspectRatioCalc={(op) => { this.aspectRatioCalc(op) }}
            />
          );
          break;
  
        case 3:
          return (
            <Config
              changeSection={(sectionToLoad) => { this.changeSection(sectionToLoad) }}
              aspectRatioCalc={(op) => { this.aspectRatioCalc(op) }}
            />
          );
  
        break;
      }
    }
    
  }
  render() {
    return (
      <div className=" bg-black absolute w-full h-full flex">
        <div className=" bg-black relative w-full h-full mx-auto my-auto" id='display'>
          {this.renderSection()}
        </div>
      </div>
    );
  }
}
export { Template }