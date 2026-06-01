import { TokenType } from './lexer.ts';

// NODOS
export interface ASTNode {
    line: number;
}

// Nodos de acciones
export class MoveNode implements ASTNode { type = 'Move'; constructor(public line: number) {} }
export class RotateNode implements ASTNode { type = 'Rotate'; constructor(public line: number) {} }
export class JumpNode implements ASTNode { type = 'Jump'; constructor(public line: number) {} }

// Nodos de control de ciclos
export class BreakNode implements ASTNode { type = 'Break'; constructor(public line: number) {} }
export class ContinueNode implements ASTNode { type = 'Continue'; constructor(public line: number) {} }

// Nodos de bloque
export class LoopNode implements ASTNode {
    constructor(public line: number, public count: number, public body: ASTNode[]) {}
}
export class WhileNode implements ASTNode {
    constructor(public line: number, public condition: ExprNode, public body: ASTNode[]) {}
}
export class IfNode implements ASTNode {
    constructor(public line: number, public condition: ExprNode, public body: ASTNode[]) {}
}

// Para las condiciones de if y while
export type ExprNode = BinaryExpr | LiteralExpr | VariableExpr;

// Una expresión binaria conecta dos valores con un operador (x == 3)
export class BinaryExpr {
    constructor(public left: ExprNode, public operator: TokenType, public right: ExprNode) {}
}
// Un valor literal estático (ej: 5, true, false)
export class LiteralExpr {
    constructor(public value: number | boolean) {}
}
// Una variable del juego (ej: la coordenada 'x' o 'y' del jugador)
export class VariableExpr {
    constructor(public name: 'x' | 'y') {}
}