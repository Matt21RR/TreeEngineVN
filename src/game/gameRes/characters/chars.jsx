const Aisha = Object.assign(require("./Aisha/Aisha.json"),
  {"char1":require("./Aisha/char1.webp")}
)
const Bob = Object.assign(require("./Bob/Bob.json"),
  {body:
    {"body":require("./Bob/body/body.png")}
  },
  {face:
    {1:require("./Bob/face/1.png"),
    2:require("./Bob/face/2.png")}
  }
);
var charsFiles = {
  Aisha:Aisha,
  Bob:Bob
};
export {charsFiles};