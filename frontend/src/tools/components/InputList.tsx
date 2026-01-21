import React from "react";

import gsap from "gsap";
import $ from "jquery";


interface InputListProps {
  action: (number)=>void,
  value: number,
  options: Array<any>,
  height?: number,
  selected?: number,
  optionsBoxHeight?:number,
  placeholder?: string
}

interface InputListState {
  animate: boolean,
  showAnimationDone: boolean,
  activateHideAnimation: boolean,
  zIndex: number,
  error: boolean,
  heightPerOption: number,
}


class InputList extends React.Component<InputListProps, InputListState> {
  selected: number
  optionsBoxId: string
  inputRef: React.RefObject<HTMLDivElement>
  optionsBoxRef: React.RefObject<HTMLDivElement>

  constructor(props: InputListProps) {
    super(props);
    this.state = {
      animate: false,
      showAnimationDone: false,
      activateHideAnimation: false,
      zIndex: 10,
      error: !props.action || !props.value || !props.options,
      heightPerOption: props.height ?? 16,
    }
    this.selected = props.selected ?? 0;
    this.optionsBoxId = "boxOptions" + String(window.performance.now()).replaceAll(".","");
    this.inputRef = React.createRef();
    this.optionsBoxRef = React.createRef();
    this.handleClickOutside = this.handleClickOutside.bind(this);
    this.preventDefault = this.preventDefault.bind(this);
  }
  calculateHeight() {
    let boxHeight;

    const optionsBox = this.optionsBoxRef.current.childNodes[1] as HTMLDivElement;
    const customMaxHeight = (this.props.optionsBoxHeight ?? 0);

    if (customMaxHeight > 0 && customMaxHeight < optionsBox.scrollHeight) {
      boxHeight = customMaxHeight;

    } else {
      boxHeight = optionsBox.scrollHeight;

    }
    //Calcuulate Max
    var offset = $("#"+this.optionsBoxId).offset();
    const max = (window.innerHeight -(offset.top-window.scrollY));
    if(boxHeight>max){boxHeight=max;}
    return boxHeight
  }
  componentWillUnmount() {
    document.removeEventListener("mousedown", this.handleClickOutside);
  }
  componentDidUpdate() {
    if (this.state.animate && !this.state.showAnimationDone && !this.state.activateHideAnimation) {
      this.animateHover();
      this.setState({ showAnimationDone: true });
    }
    if (this.state.showAnimationDone && this.state.activateHideAnimation) {
      this.setState(
        {
          animate: false,
          showAnimationDone: false,
          activateHideAnimation: false
        },
        () => {
          this.animateUnHover();
        }
      );
    }
  }
  handleClickOutside(e) {
    if (this.inputRef && !this.inputRef.current.contains(e.target)) {
      this.unhover();
    }
  }
  animateHover() {
    const optionsBox = this.optionsBoxRef.current.childNodes[1];
    gsap.to(optionsBox, { height: this.calculateHeight(), duration: 0.4 });

    const inputRef = this.inputRef.current;
    gsap.to(inputRef, { borderColor: 'rgb(0, 115, 170)', zIndex:50 });
  }
  animateUnHover() {
    const optionsBox = this.optionsBoxRef.current.childNodes[1];
    gsap.to(optionsBox, { height: '0', duration: 0.4 });
    let inputRef = this.inputRef.current;
    gsap.to(inputRef, { borderColor: '#000', zIndex:0 });
  }
  hover() {
    this.animateHover();
    document.addEventListener("mousedown", this.handleClickOutside);
  }
  unhover() {
    this.animateUnHover();
    document.removeEventListener("mousedown", this.handleClickOutside);
  }
  preventDefault(e) {
    e.preventDefault();
  }
  action(value,option) {
    if (!this.state.error && ("action" in this.props)) {
      this.props.action(value);
      this.selected = value;
      this.forceUpdate();
    }else{
      window.alert("Compurebe que existan las propiedades action, value, y options para esta implementación del componente");
    }
  }
  calcScrollAutoDisplace(){
    let heightPerOption = this.state.heightPerOption;
    let optionsBoxHeight = this.calculateHeight();
    let optionsBox = this.optionsBoxRef.current.childNodes[1] as HTMLDivElement;
    let actualOptionInYAxis = (this.selected+1)*heightPerOption;

    if(actualOptionInYAxis > (optionsBox.scrollTop+optionsBoxHeight)){
      optionsBox.scrollTop = actualOptionInYAxis-optionsBoxHeight;
    }else if((actualOptionInYAxis-heightPerOption) < optionsBox.scrollTop){
      optionsBox.scrollTop = (actualOptionInYAxis-heightPerOption);
    }
  }
  renderOptions(/*customHeight*/) {
    let options = this.props.options;
    let selected = this.selected;
    let customHeight = "h-[28px] ";
    if (options) {
      if (options.length > 0) {
        return (
          options.map(
            (option, index) => (
              <div
                className={(selected == index ? "text-white " : "") + (index == 0 ? "" : "") + " py-0.5 text-[13px] px-2 cursor-pointer flex min-" + (customHeight.replace(/ /g, ""))}
                style={{ backgroundColor: (selected == index ? "rgb(10, 67, 145)" : "") }}
                key={index}
                onClick={() => { this.action(index, option) }}>
                <div className="my-auto w-fit h-fit">
                  {option}
                </div>
              </div>
            )
          )
        );
      }
      else {
        return ("NOOPTIONS");
      }
    }
    else {
      return ("NOOPTIONS");
    }
  }
  render() {
    let placeholder = (this.props.placeholder ?? 'Seleccionar');
    let textValue = this.selected != null ? this.props.options[this.selected] : placeholder;
    if(this.selected == -1){
      textValue = "";
    }
    let height = "h-[28px] ";
    let contStyle = " w-[217px]";
    let fatherStyle = '';
    let eStyle = " fixed ";
    return (
      <div className={contStyle + " h-7 flex m-1 relative"}>
        <div className={"  "+ eStyle}>
          <div
            style={{ zIndex: this.state.zIndex }}
            className={"select-none relative z-[" + this.state.zIndex + "] focus:outline-none text-black h-fit w-full border-[#0b2140] border-[1px] rounded-md bg-white overflow-x-hidden " + fatherStyle}
            ref={this.inputRef}
            tabIndex={0}
            onFocus={() => { this.hover() }}
            onBlur={() => { this.unhover() }}
            onMouseEnter={() => { this.hover() }}
            onMouseLeave={() => { this.unhover() }}>
            <div
              className={(height) + "flex w-full px-2 " + (this.selected == null ? 'text-gray-500' : '')}
              onClick={() => { this.hover() }}>
              <div className="my-auto w-full text-[13px]">
                <div className="w-full whitespace-nowrap text-ellipsis overflow-hidden">{textValue}</div>
                
              </div>
            </div>
            <div
              className=" w-full h-fit relative"
              id={this.optionsBoxId}
              ref={this.optionsBoxRef}>
              <div className="absolute top-0 w-full h-0"/>
              <div
                className={"w-full h-0 flex flex-col "+("overflow-auto")}>
                {this.renderOptions(/*height*/)}
              </div>
              <div className="absolute bottom-0 w-full h-0"/>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export {InputList}