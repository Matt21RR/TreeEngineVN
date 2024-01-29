import React from "react";
import scroll from "scroll";
import { Button1, PauseButton } from "../components/buttons";
import { PauseMenu } from "./PauseMenu";
var ease = require("ease-component"); 

class GameEnvironment extends React.Component {
  constructor(props) {
    super(props);
    
    this.state = {
      actualNode: this.props.actualNode !== null ? this.props.actualNode : "-1",
      phase: 0,//1 - Draw scenario & upper scenario(capaSuperior) & music | 2 - Draw characters | 3 - Play dialogs | 4 - show player dialogs
      triggerFadeOutAnimations: false,
      showMenuPausa: false,
      storyVars: this.props.storyVars != null ? this.props.storyVars : new Object(),
      dummy:null,
      instantNodeWarn:false,
      noNextNodeWarn:false
    }
    this.gameScript = this.props.gameScript;
    this.nextNode = undefined;
    this.fadeOutTriggerDuration = 0;
    this.componentMounted = false;
    this.cameraReference = React.createRef();
  }
  componentDidMount() {
    window.ease = ease;
    window.scroll = scroll;
    if (!this.componentMounted) {
      this.componentMounted = true;
    }
  }
  render() {
    return (
      <div className="absolute h-full w-full" style={{zoom:this.props.developMode != undefined?"20%":""}}>
        <div className="relative h-full w-full overflow-hidden" id="gameCanvasScreenshotTarget">
          {/* game display here */}

          <div className={"absolute top-2 left-2" + (this.props.developMode == true? " hidden": "")}>
            <PauseButton action={() => { this.setState({ showMenuPausa: true }) }} text="" />
          </div>
        </div>
        <div className={"top-0 absolute h-full w-full overflow-hidden" + (this.state.showMenuPausa ? "" : " pointer-events-none")  + (this.props.developMode == true? " hidden": "")}>
          <PauseMenu
            showing={this.state.showMenuPausa}
            reanudar={() => { this.setState({ showMenuPausa: false }) }}
            volverAlMenuPrincipal={() => { this.props.changeSection(0); }}
            actualNode={this.state.actualNode}
            dataToSave={this.state.storyVars}

            aspectRatioCalc={(op)=>{this.props.aspectRatioCalc(op)}}
          />
        </div>
      </div>
    );
  }
}
export { GameEnvironment }