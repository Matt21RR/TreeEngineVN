import { TokenType } from './lexer.ts';
import { 
    ASTNode, 
    MoveNode, 
    RotateNode, 
    JumpNode, 
    BreakNode, 
    ContinueNode, 
    LoopNode, 
    WhileNode, 
    IfNode, 
    ExprNode, 
    BinaryExpr, 
    LiteralExpr, 
    VariableExpr } from './ast.ts';

// Excepciones internas para controlar saltos en ciclos
class BreakException {}
class ContinueException {}

export interface GameMap { 
    width: number; height: number; 
    holes: {x: number, y: number}[]; 
    target: {x: number, y: number}; 
}

export class GameInterpreter {
    public x: number = 0; 
    public y: number = 0;
    public direction: number = 0; // 0: Norte(Arriba), 1: Este(Derecha), 2: Sur(Abajo), 3: Oeste(Izquierda)
    public map: GameMap;
    
    // Estos eventos los defines tú en main.ts para conectar el código con tu entorno gráfico
    public onLineChange?: (line: number, action: string, destX: number, destY: number, destDir: number) => Promise<void> | void;
    public onError?: (line: number, message: string) => void;
    public onWin?: () => void;
    public onFail?: (message: string) => void;
    
    constructor(map: GameMap, startX: number, startY: number) {
        this.map = map; this.x = startX; this.y = startY;
    }

    public async execute(nodes: ASTNode[]) {
        try {
            await this.runBlock(nodes);
            
            // Una vez que se acaban los nodos (instrucciones), 
            // comprobamos si terminó exactamente encima de la bandera final.
            if (this.x === this.map.target.x && this.y === this.map.target.y) {
                if (this.onWin) this.onWin();
            } else {
                if (this.onFail) this.onFail("Te quedaste sin instrucciones o no paraste sobre el objetivo final.");
            }
        } catch (e) {
            if (e instanceof BreakException || e instanceof ContinueException) {
                if (this.onError) this.onError(0, "Usaste 'break' o 'continue' fuera de un ciclo.");
            }
        }
    }

    private async runBlock(nodes: ASTNode[]) {
        for (const node of nodes) {
            let actionName = "none";

            if (node instanceof MoveNode) actionName = "move";
            else if (node instanceof JumpNode) actionName = "jump";
            else if (node instanceof RotateNode) actionName = "rotate";
            else if (node instanceof LoopNode) actionName = "loop";
            else if (node instanceof WhileNode) actionName = "while";
            else if (node instanceof IfNode) actionName = "if";

            // Modificamos las coordenadas matemáticas del motor ANTES de animar
            if (node instanceof MoveNode) this.movePlayer(1);
            else if (node instanceof JumpNode) this.movePlayer(2);
            else if (node instanceof RotateNode) this.direction = (this.direction + 1) % 4;


            if (this.onLineChange) {
                await this.onLineChange(node.line, actionName, this.x, this.y, this.direction);
            }

            try {
                // Ejecución recursiva de bloques
                if (node instanceof LoopNode) {
                    for (let i = 0; i < node.count; i++) {
                        try { await this.runBlock(node.body); } 
                        catch (e) { if (e instanceof BreakException) break; if (e instanceof ContinueException) continue; throw e; }
                    }
                } else if (node instanceof WhileNode) {
                    let safety = 0;
                    // Se evalua la condición en tiempo real antes de cada vuelta
                    while (this.evaluateExpr(node.condition)) {
                        if (safety++ > 1000) throw new Error("Loop infinito detectado. Tu juego fue abortado.");
                        try { await this.runBlock(node.body); } 
                        catch (e) { if (e instanceof BreakException) break; if (e instanceof ContinueException) continue; throw e; }
                    }
                } else if (node instanceof IfNode) {
                    if (this.evaluateExpr(node.condition)) {
                        await this.runBlock(node.body);
                    }
                } else if (node instanceof BreakNode) { throw new BreakException(); }
                else if (node instanceof ContinueNode) { throw new ContinueException(); }

                // MUERTE: Después de moverse físicamente, ¿cayo en un hueco?
                if (["move", "jump", "rotate"].includes(actionName)) {
                    this.checkDeathConditions();
                }

            } catch (error) {
                if (error instanceof BreakException || error instanceof ContinueException) throw error;
                if (this.onError) this.onError(node.line, (error as Error).message);
                throw new Error("Game Over");
            }
        }
    }

    private checkDeathConditions() {
        // Coordenada Y crece hacia abajo
        if (this.x < 0 || this.x >= this.map.width || this.y < 0 || this.y >= this.map.height) {
            throw new Error("¡El jugador se cayo fuera de los limites del nivel!");
        }
        if (this.map.holes.some(h => h.x === this.x && h.y === this.y)) {
            throw new Error("Pisaste un hueco! Has perdido.");
        }
    }

    // Lee la variable actual de X y Y, o procesa mayor que, menor que, etc.
    private evaluateExpr(expr: ExprNode): any {
        if (expr instanceof LiteralExpr) return expr.value;
        if (expr instanceof VariableExpr) return expr.name === 'x' ? this.x : this.y;
        if (expr instanceof BinaryExpr) {
            const left = this.evaluateExpr(expr.left);
            const right = this.evaluateExpr(expr.right);
            
            switch (expr.operator) {
                case TokenType.EQ: return left === right;
                case TokenType.NEQ: return left !== right;
                case TokenType.GT: return left > right;
                case TokenType.GTE: return left >= right;
                case TokenType.LT: return left < right;
                case TokenType.LTE: return left <= right;
                case TokenType.AND: return left && right;
                case TokenType.OR: return left || right;
            }
        }
        return false;
    }

    private movePlayer(distance: number) {
        if (this.direction === 0) this.y -= distance; // 0 = NORTE (resta Y)
        if (this.direction === 1) this.x += distance; // 1 = ESTE (suma X)
        if (this.direction === 2) this.y += distance; // 2 = SUR (suma Y)
        if (this.direction === 3) this.x -= distance; // 3 = OESTE (resta X)
    }
}