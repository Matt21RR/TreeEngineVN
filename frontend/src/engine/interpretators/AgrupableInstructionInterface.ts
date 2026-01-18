import { Chaos, Interpretation } from "./ChaosInterpreter.ts";
import InstructionInterface from "./InstructionInterface.ts";

abstract class AgrupableInstructionInterface extends InstructionInterface{
  abstract agrupator (interpretedInstructions:Array<Interpretation>): Interpretation;
  protected agrupable = true;
}
export default AgrupableInstructionInterface