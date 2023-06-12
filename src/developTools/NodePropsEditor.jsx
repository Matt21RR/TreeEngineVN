import gsap from "gsap";
import React from "react";
import { MenuButton } from "../components/buttons";
import TextareaAutosize from 'react-textarea-autosize';
import { generateRndRGBColor, removeCharAt } from "../logic/Misc";
import trashIcon from "../res/engineRes/trash.svg";
import showIcon from "../res/engineRes/eye.svg";
import hideIcon from "../res/engineRes/eye-closed.svg";
class ShowButton extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      show: true,
    }
    this.ref = React.createRef();
  }
  icon() {
    return this.state.show ? showIcon : hideIcon;
  }
  callback() {

  }
  render() {
    return (
      <div onClick={() => { this.props.action(this.ref.current, (res) => { this.setState({ show: res }) }); }} className={"relative w-4 h-4 mx-[2px] border-[1px]" + (this.props.hide ? " hidden" : "")} ref={this.ref}>
        <div className="absolute top-0 left-0 w-full h-full" style={{ backgroundImage: "url('" + this.icon() + "')", backgroundSize: "contain" }} />
      </div>
    );
  }
}
class MoveButton extends React.Component {
  render() {
    return (
      <div className="relative rotate-90 w-4 h-4 mx-[2px]">
        <div className="absolute left-0 w-2 h-4 border-[1px] flex cursor-pointer">
          <span className="bottom-[-20%] absolute">{"<"}</span>
        </div>
        <div className="absolute right-0 w-2 h-4 border-[1px] cursor-pointer">
          <span className="bottom-[-20%] absolute">{">"}</span>
        </div>
      </div>
    );
  }
}
class DeleteButton extends React.Component {
  render() {
    return (
      <div className="relative w-4 h-4 mx-[2px] border-[1px]">
        <div className="absolute top-0 left-0 w-full h-full" style={{ backgroundImage: "url('" + trashIcon + "')", backgroundSize: "contain" }} />
      </div>
    );
  }
}
class PropertiesOperationButtons extends React.Component {
  constructor(props) {
    super(props);
  }
  render() {
    return (<>
      <MoveButton />
      <DeleteButton />
      <ShowButton action={(self, callbackFun) => { this.props.showAction(self, callbackFun) }} hide={this.props.showButton} />
    </>)
  }
}
class NodePropsEditor extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      nodeInfo: this.props.node,//replace with node id
      nodeId: this.props.nodeId,
      showing: false,
    }
    this.target = React.createRef();
  }
  componentDidUpdate() {
    if (this.props.showing && !this.state.showing) {
      this.setState({ showing: true, nodeInfo: this.props.node }, () => {
        if (this.props.interpretedMode) {//if need to interpret the editor script copy, then get the node

        } else {//else get the node directly from the uninterpreted scrip't

        }
        //fadeInAnimation
        gsap.to(this.target.current, 0.5, { opacity: 1 });
        gsap.to(this.target.current.childNodes[1], 0.5, { right: "0px" });
      });
    } else if (!this.props.showing && this.state.showing) {
      this.setState({ showing: false }, () => {
        //fadeOutAnimation
        gsap.to(this.target.current, 0.5, { opacity: 0 });
        gsap.to(this.target.current.childNodes[1], 0.5, { right: "-400px" });
      });
    }
  }
  editNode(route = new String()){
    const editkey = route.at(-1) == "-";
    if(editkey)
      route = removeCharAt(route,-1);
    route = removeCharAt(removeCharAt(route,-1),0);
    const routeArray = route.split("/");
    //clone array
    //go down the array, following the route
    console.log(routeArray);
  }
  propertiesOperationButtons(doubleParentJump) {
    if (!this.props.interpretedMode) {
      return (
        <PropertiesOperationButtons showButton={!doubleParentJump} showAction={(self, callbackFun) => {
          var show = false
          //For action get the inmediate next child instead of childNodes 1
          if (doubleParentJump) {
            var childs = self.parentNode.parentNode.childNodes;
            var procedentChild = self.parentNode;
            var targetChild;
            for (let index = 0; index < childs.length; index++) {
              if (childs[index] == procedentChild) {
                // console.log(index);
                targetChild = childs[index + 1];
              }
            }
            if (targetChild.className.indexOf("hidden") != -1) {
              targetChild.className = targetChild.className.replace(" hidden", "");
              show = true;
            } else {
              targetChild.className += " hidden";
            }
          } else {//The simple jump appear useless
            // if(self.parentNode.childNodes[1].className.indexOf("hidden") != -1){
            //   self.parentNode.childNodes[1].className = self.parentNode.childNodes[1].className.replace(" hidden","");
            //   show = true;
            // }else{
            //   self.parentNode.childNodes[1].className += " hidden";
            // }
          }
          callbackFun(show);
        }} />
      )
    }
    return (<></>)
  }
  //ruta=rutaRecursiva
  renderLista(lista = new Array(), ruta = new String()) {
    return (
      lista.map((element, index) => (
        <>
          <div className="flex">
            {this.propertiesOperationButtons(true)}
            {index}:
          </div>
          {this.renderPropiedades(element, ruta + index + "/")}
        </>
      ))
    );
  }
  //ruta = rutaRecursiva
  renderObjetoConditional(objeto, key, ruta = new String()) {
    if (typeof objeto == "object") {
      return (
        <>
          <div className="flex">
            {this.propertiesOperationButtons(true)}
            {this.renderPropiedad(key, ruta + "-")}
            :
          </div>
          {this.renderPropiedades(objeto, ruta)}
        </>
      )
    } else {
      return (
        <>
          <div className="flex">
            {this.propertiesOperationButtons(false)}
            {this.renderPropiedad(key, ruta + "-")}
            :
            {this.renderPropiedades(objeto, ruta)}
          </div>

        </>
      )
    }

  }
  //ruta=rutaRecursiva
  renderObjeto(objeto = new Object(), ruta = new String()) {
    return (
      Object.keys(objeto).map((key, index) => (
        <div>
          {this.renderObjetoConditional(objeto[key], key, ruta + key + "/")}
        </div>
      ))

    );
  }
  //ruta=rutaRecursiva
  renderPropiedad(valorPropiedad = new String(), ruta = new String()) {
    //Agregar condicionales para valor tipo numerico y valor tipo archivo/imagen
    return (
      <div
        onClick={(e) => {
          if (!this.props.interpretedMode) {
            var self = e.target.parentNode;
            if (self.childNodes[0].className == "hidden") {
              self.childNodes[0].className = "";
              setTimeout(() => { self.childNodes[0].childNodes[0].focus(); }, 100)
              self.childNodes[1].className = "hidden";
            }
          }
        }}
      >
        <div className="hidden">
          <TextareaAutosize
            onBlur={(e) => {
              var self = e.target.parentNode.parentNode;
              self.childNodes[0].className = "hidden";
              self.childNodes[1].className = "";
            }}
            className=" rounded-md px-1"
            defaultValue={valorPropiedad}
            onChange={(e) => { this.editNode(ruta); }}
            style={{ backgroundColor: "black", width: "200px", borderWidth: "1px", borderColor: "#40404075" }} />
        </div>
        <div className="">
          {valorPropiedad}
        </div>
      </div>

    );
  }
  //ruta=rutaRecursiva
  renderPropiedades(info = this.state.nodeInfo, ruta = "/") {
    //Si la propiedad está definida como un array u objeto, hay que repetir
    //Si no parar
    if (Array.isArray(info)) {
      //Prohibición de mostrar aquí
      return (
        <div className="ml-2 pt-1" style={{ borderLeft: "#40404075 solid 1px", borderTop: "#40404075 dotted 2px" }}>
          {this.renderLista(info, ruta)}
          {/* FIN LISTA */}

        </div>
      );
    } else if (typeof info == "object") {
      //Prohibicion de mostrar aqui
      const rgbColor = generateRndRGBColor(35);
      return (
        <div className="ml-2 pl-1 pt-1" style={{ borderLeft: "#40404075 solid 1px", borderTop: "#40404075 dotted 2px", backgroundColor: rgbColor }}>
          {this.renderObjeto(info, ruta)}
          {/* FIN OBJETO */}
        </div>
      );
    } else {
      return (
        <>
          {this.renderPropiedad(info, ruta)}
        </>
      );
    }
  }
  render() {
    return (
      <div ref={this.target} className={"absolute top-0 left-0 w-full h-full opacity-0" + (!this.state.showing ? " pointer-events-none" : "")}>
        <div className="absolute top-0 left-0 w-full h-full"
          style={{
            opacity: 0.5,
            backgroundColor: "#000000"
          }}>

        </div>
        <div className="text-white overflow-x-hidden"
          style={{
            // transform:"translate(-50%,50%)",
            right: "-400px",
            top: "0%",
            height: "100%",
            width: "550px",
            position: "absolute",
            backgroundColor: "black",
            fontSize: "13.5px",
            fontFamily: "consolas",
            color: "rgb(200,200,200)"
          }}>
          <div className="absolute w-full h-fit"
            id="nodeScript"
            style={{
              left: "20px",
              top: "10px",
            }}>
            {"Propiedades del nodo" + (this.props.interpretedMode ? " interpretadas" : " sin interpretar")}
            <br /><br />
            {this.renderPropiedades()}
          </div>
          <div className="absolute top-2 right-2">
            <MenuButton text="Cerrar" action={() => { this.props.close() }} />
            <MenuButton text="Guardar" action={() => { this.props.saveNode() }}  hide={this.props.node == this.state.nodeInfo}/>
          </div>
        </div>
      </div>
    )
  }
}
export { NodePropsEditor }