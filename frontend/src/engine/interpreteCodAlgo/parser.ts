import { Token, TokenType } from './lexer.ts';
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

export class Parser {
    private tokens: Token[];
    private current: number = 0;

    constructor(tokens: Token[]) { this.tokens = tokens; }

    public parse(): ASTNode[] {
        const statements: ASTNode[] = [];
        while (!this.isAtEnd()) {
            // Ignoramos lineas vacias que nos haya pasado el Lexer
            if (this.peek().type === TokenType.NEWLINE) { this.advance(); continue; }
            statements.push(this.statement());
        }
        return statements;
    }

    // Lee la instrucción de turno y genera el nodo correspondiente
    private statement(): ASTNode {
        const line = this.peek().line; // Guardamos la línea de este token

        if (this.match(TokenType.MOVE)) return new MoveNode(line);
        if (this.match(TokenType.ROTATE)) return new RotateNode(line);
        if (this.match(TokenType.JUMP)) return new JumpNode(line);
        if (this.match(TokenType.BREAK)) return new BreakNode(line);
        if (this.match(TokenType.CONTINUE)) return new ContinueNode(line);

        if (this.match(TokenType.LOOP)) {
            const count = this.consume(TokenType.NUMBER, "Se esperaba número tras 'loop'").value as number;
            this.consume(TokenType.COLON, "Se esperaba ':'");
            return new LoopNode(line, count, this.block());
        }

        if (this.match(TokenType.WHILE)) {
            const condition = this.expression();
            this.consume(TokenType.COLON, "Se esperaba ':'");
            return new WhileNode(line, condition, this.block());
        }

        if (this.match(TokenType.IF)) {
            const condition = this.expression();
            this.consume(TokenType.COLON, "Se esperaba ':'");
            return new IfNode(line, condition, this.block());
        }

        throw new Error(`[Línea ${line}] Instrucción no válida o mal escrita.`);
    }

    // Lee un bloque de código anidado (indentado)
    private block(): ASTNode[] {
        if (this.match(TokenType.NEWLINE)) {} // Saltar salto de línea previo
        this.consume(TokenType.INDENT, "Se esperaba indentación (tabulación) tras los ':'.");
        
        const statements: ASTNode[] = [];
        // Mientras no lleguemos a un Dedent (quitar tabulación), seguimos agregando instrucciones a este bloque
        while (!this.check(TokenType.DEDENT) && !this.isAtEnd()) {
            if (this.match(TokenType.NEWLINE)) continue;
            statements.push(this.statement());
        }
        
        this.consume(TokenType.DEDENT, "Error al cerrar el bloque de indentación.");
        return statements;
    }

    // --- EVALUADOR DE MATEMÁTICAS (Respeta el orden lógico) ---
    private expression(): ExprNode { return this.logicalOr(); }

    private logicalOr(): ExprNode {
        let expr = this.logicalAnd();
        while (this.match(TokenType.OR)) {
            const operator = this.previous().type;
            const right = this.logicalAnd();
            expr = new BinaryExpr(expr, operator, right);
        }
        return expr;
    }

    private logicalAnd(): ExprNode {
        let expr = this.equality();
        while (this.match(TokenType.AND)) {
            const operator = this.previous().type;
            const right = this.equality();
            expr = new BinaryExpr(expr, operator, right);
        }
        return expr;
    }

    private equality(): ExprNode {
        let expr = this.comparison();
        while (this.match(TokenType.EQ) || this.match(TokenType.NEQ)) {
            const operator = this.previous().type;
            const right = this.comparison();
            expr = new BinaryExpr(expr, operator, right);
        }
        return expr;
    }

    private comparison(): ExprNode {
        let expr = this.primary();
        while (this.match(TokenType.GT) || this.match(TokenType.GTE) || this.match(TokenType.LT) || this.match(TokenType.LTE)) {
            const operator = this.previous().type;
            const right = this.primary();
            expr = new BinaryExpr(expr, operator, right);
        }
        return expr;
    }

    private primary(): ExprNode {
        if (this.match(TokenType.FALSE)) return new LiteralExpr(false);
        if (this.match(TokenType.TRUE)) return new LiteralExpr(true);
        if (this.match(TokenType.NUMBER)) return new LiteralExpr(this.previous().value as number);
        if (this.match(TokenType.X)) return new VariableExpr('x');
        if (this.match(TokenType.Y)) return new VariableExpr('y');
        
        throw new Error(`[Línea ${this.peek().line}] Se esperaba un valor o variable válido en la condición.`);
    }

    // Funciones auxiliares para consumir el array de tokens
    private match(...types: TokenType[]): boolean {
        for (const type of types) { if (this.check(type)) { this.advance(); return true; } }
        return false;
    }
    private check(type: TokenType): boolean { return this.isAtEnd() ? false : this.peek().type === type; }
    private advance(): Token { if (!this.isAtEnd()) this.current++; return this.previous(); }
    private peek(): Token { return this.tokens[this.current]; }
    private previous(): Token { return this.tokens[this.current - 1]; }
    private consume(type: TokenType, msg: string): Token {
        if (this.check(type)) return this.advance();
        throw new Error(`[Línea ${this.peek().line}] ${msg}`);
    }
    private isAtEnd(): boolean { return this.peek().type === TokenType.EOF; }
}