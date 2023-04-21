var ease = require("ease-component"); 
//Shitty modification of scroll-js
function __awaiter(thisArg, _arguments, P, generator) {
  function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
  return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
      function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
      function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
}
function sanitizeScrollOptions(options = {}) {
  if (options.behavior === 'instant') {
      options.duration = 0;
      options.easing = ease.linear;
  }
  return options;
}

function scrollTo(el, options = {}) {
  return __awaiter(this, void 0, void 0, function* () {
      if (!(el instanceof Element) && !(el instanceof Window)) {
          throw new Error(`element passed to scrollTo() must be either the window or a DOM element, you passed ${el}!`);
      }
      options = sanitizeScrollOptions(options);
      const scroll = (from, to, prop, startTime, duration = 0, easeFunc, callback) => {
          window.requestAnimationFrame(() => {
              const currentTime = Date.now();
              const time = Math.min(1, (currentTime - startTime) / duration);
              if (from === to) {
                  return callback ? callback() : null;
              }
              setScrollPosition(el, easeFunc(time) * (to - from) + from, prop);
              /* prevent scrolling, if already there, or at end */
              if (time < 1) {
                  scroll(from, to, prop, startTime, duration, easeFunc, callback);
              }
              else if (callback) {
                  callback();
              }
          });
      };
      const currentScrollPosition = getScrollPosition(el,("top" in options ? "y" : "x"));
      const scrollProperty = getScrollPropertyByElement(el,("top" in options ? "y" : "x"));
    //   console.log(currentScrollPosition, (typeof (options.top) === 'number' || typeof(options.left) === 'number')
    //   ? (typeof (options.top) === 'number'? options.top: options.left)
    //   : currentScrollPosition,
    //   scrollProperty,
    //   Date.now(),
    //   options.duration,
    //   options.easing);

      return new Promise((resolve) => {
          scroll(currentScrollPosition, (typeof (options.top) === 'number' || typeof(options.left) === 'number')
          ? (typeof (options.top) === 'number'? options.top: options.left)
          : currentScrollPosition,
          scrollProperty,
                Date.now(),
                options.duration,
                options.easing,
                resolve);
      });
  });
}

function getScrollPropertyByElement(el,axis) {
  const props = {
      window: {
          y: 'scrollY',
          x: 'scrollX',
      },
      element: {
          y: 'scrollTop',
          x: 'scrollLeft',
      },
  };
  if (el instanceof Window) {
      return props.window[axis];
  }
  else {
      return props.element[axis];
  }
}

function getScrollPosition(el,axis) {
      return ((axis == "y")? el.scrollTop:el.scrollLeft);
}
function setScrollPosition(el, value,prop) {
      el[prop] = value;
}

export {scrollTo};