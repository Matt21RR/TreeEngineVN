import CreateInstruction from "./builders/CreateInstruction.ts";
import DialogInstruction from "./builders/DialogInstruction.ts";
import IncludeInstruction from "./builders/IncludeInstruction.ts";
import ModuleDefinitionInstruction from "./builders/ModuleDefinitionInstruction.ts";
import NarrationInstruction from "./builders/NarrationInstruction.ts";
import ResumeInstruction from "./builders/ResumeInstruction.ts";
import RunInstruction from "./builders/RunInstruction.ts";
import SceneDefinitionInstruction from "./builders/SceneDefinitionInstruction.ts";
import SetInstruction from "./builders/SetInstruction.ts";
import DeleteInstruction from "./builders/DeleteInstruction.ts";
import WaitInstruction from "./builders/WaitInstruction.ts";
import NodeDefinitionInstruction from "./builders/NodeDefinitionInstruction.ts";
import StructureEndInstruction from "./builders/StructureEndInstruction.ts";
import JumpToInstruction from "./builders/JumpToInstruction.ts";
import SetSpeakerInstruction from "./builders/SetSpeakerInstruction.ts";
import MoveActorInstruction from "./builders/MoveActorInstruction.ts";
import EmotionChangeInstruction from "./builders/EmotionChangeInstruction.ts";
import ArriveInstruction from "./builders/ArriveInstruction.ts";
import SoundInstruction from "./builders/SoundInstruction.ts";
import DecisionInstruction from "./builders/DecisionInstruction.ts";

const supportedInstructions = [
  new CreateInstruction(),
  new DecisionInstruction(),
  new DialogInstruction(),
  new IncludeInstruction(),
  new ModuleDefinitionInstruction(),
  new NodeDefinitionInstruction(),
  new JumpToInstruction(),
  new SetSpeakerInstruction(),
  new StructureEndInstruction(),
  new NarrationInstruction(),
  new ResumeInstruction(),
  new RunInstruction(),
  new SceneDefinitionInstruction(),
  new SetInstruction(),
  new DeleteInstruction(),
  new WaitInstruction(),
  new MoveActorInstruction(),
  new EmotionChangeInstruction(),
  new ArriveInstruction(),
  new SoundInstruction()
];

export default supportedInstructions;