import { Chaos, Interpretation } from "./ChaosInterpreter";
import InstructionInterface from "./InstructionInterface";

abstract class AgrupableInstructionInterface extends InstructionInterface{
  abstract agrupator (interpretedInstructions:Array<Interpretation>): Interpretation;
  protected agrupable = true;
}
export default AgrupableInstructionInterface