import gsap from 'gsap';
import React from 'react';
import { NodesBuilder } from './logic/NodesBuilder';
import { Config } from './sections/Config';
import { GameEnvironment } from './sections/GameEnvironment';
import { MainMenu } from "./sections/MainMenu";
import { SavedGamesScreen } from "./sections/SavedGamesScreen";
import $ from "jquery";
import { NodesWatch } from './developTools/NodesWatch';
import { charsFiles } from './res/gameRes/characters/chars';


class Template extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      section: 0,
      actualNode: null,
      storyVars: null,
      ingameSavedGamesList: false,
      aspectRatio: "unset"
    }
    this.resizeTimeout = 0;
    this.gameScript = null;
    this.componentMounted = false;
  }
  componentDidMount() {
    console.log(charsFiles);
    if (!this.componentMounted) {
      this.componentMounted = true;
      window.setTimeout(() => {
        if (Object.keys(localStorage).indexOf("aspectRatio") != -1) {
          this.setState({ aspectRatio: localStorage.getItem("aspectRatio") }, () => {
            this.aspectRatioCalc();
          });
        } else {
          localStorage.setItem("aspectRatio", "unset");
        }
        window.addEventListener('resize', () => {
          gsap.to(document.getElementById("display"), 0.3, { opacity: 0 });
          clearTimeout(this.resizeTimeout);
          this.resizeTimeout = setTimeout(
            () => {
              this.aspectRatioCalc();
              gsap.to(document.getElementById("display"), 0.3, { opacity: 1 });
            }, 1000);
        });
        // $(window).on("blur", function (e) {
        //   document.getElementById("display").style.display = "none";
        // });
        // $(window).on("focus", function (e) {
        //   document.getElementById("display").style.display = "";
        // });
        console.log(NodesBuilder.getRequiredNodesList(NodesBuilder.getUninterpretedGameScript()));
        this.gameScript = NodesBuilder.buildGameScript();
        console.log(this.gameScript);
      }, 2);
    }
  }
  aspectRatioCalc(op = null) {
    if (op != null) {
      this.setState({ aspectRatio: op }, () => { localStorage.setItem("aspectRatio", op) });
    } else {
      op = this.state.aspectRatio;
    }
    if (op != "unset") {
      let newWidth = (window.innerHeight / (op.split(":")[1] * 1)) * (op.split(":")[0] * 1);
      let newHeight = (window.innerWidth / (op.split(":")[0] * 1)) * (op.split(":")[1] * 1);
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

  }
  changeSection(sectionToLoad) {
    this.setState({ section: sectionToLoad });
  }
  renderSection() {
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
      case 4:
        return (
          <NodesWatch
            gameScript={this.gameScript}
          />
        );

      break;
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