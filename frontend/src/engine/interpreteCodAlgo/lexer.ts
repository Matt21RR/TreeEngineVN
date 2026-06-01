export enum TokenType {
    MOVE, ROTATE, JUMP, 
    LOOP, WHILE, 
    IF,
    CONTINUE, BREAK,
    TRUE, FALSE, NUMBER, X, Y,
    AND, OR, EQ, NEQ, GT, LT, GTE, LTE,
    COLON, INDENT, DEDENT, NEWLINE, EOF
}

export interface Token {
    type: TokenType;
    value?: string | number | boolean;
    line: number;
}


// Aquí se guarda la cantidad de bloques exactos que el jugador arrastró/escribió.
export interface CommandStats {
    actions: number;      // move, rotate, jump
    loops: number;        // loop, while
    conditionals: number; // if
    controlFlow: number;  // break, continue
    operators: number;    // ==, !=, >, <, and, or
    total: number;        // Suma de todas las palabras
}

export class Lexer {
    private source: string;
    private line: number = 1;
    private indentStack: number[] = [0]; // Pila de tabulaciones
    private tokens: Token[] = [];
    
    // Contadores
    public stats: CommandStats = { actions: 0, loops: 0, conditionals: 0, controlFlow: 0, operators: 0, total: 0 };

    private keywords: Record<string, TokenType> = {
        'move': TokenType.MOVE, 'rotate': TokenType.ROTATE, 'jump': TokenType.JUMP,
        'loop': TokenType.LOOP, 'while': TokenType.WHILE, 'if': TokenType.IF,
        'continue': TokenType.CONTINUE, 'break': TokenType.BREAK,
        'true': TokenType.TRUE, 'false': TokenType.FALSE,
        'and': TokenType.AND, 'or': TokenType.OR,
        'x': TokenType.X, 'y': TokenType.Y
    };

    constructor(source: string) {
        this.source = source;
    }

    public tokenize(): Token[] {
        const lines = this.source.split(/\r?\n/);

        for (let i = 0; i < lines.length; i++) {
            this.line = i + 1;
            let currentLine = lines[i];
            
            // Linea vacia
            if (currentLine.trim() === '') continue;

            currentLine = currentLine.replace(/ {4}/g, '\t');

            // Contamos tabulaciones al inicio de la línea
            const indentMatch = currentLine.match(/^(\t*)/);
            const indentLevel = indentMatch ? indentMatch[1].length : 0;

            // Si hay mas tabulaciones que antes, entramos a un nuevo bloque
            if (indentLevel > this.indentStack[this.indentStack.length - 1]) {
                this.indentStack.push(indentLevel);
                this.tokens.push({ type: TokenType.INDENT, line: this.line });
            } 
            // Si hay menos, cerramos bloques hasta igualar
            else if (indentLevel < this.indentStack[this.indentStack.length - 1]) {
                while (indentLevel < this.indentStack[this.indentStack.length - 1]) {
                    this.indentStack.pop();
                    this.tokens.push({ type: TokenType.DEDENT, line: this.line });
                }
            }

            // Analizamos las palabras de la línea
            this.processLine(currentLine.trim());
            this.tokens.push({ type: TokenType.NEWLINE, line: this.line });
        }

        // Al terminar el archivo, cerramos cualquier bloque que haya quedado abierto
        while (this.indentStack.length > 1) {
            this.indentStack.pop();
            this.tokens.push({ type: TokenType.DEDENT, line: this.line });
        }

        this.tokens.push({ type: TokenType.EOF, line: this.line });
        return this.tokens;
    }

    private processLine(lineStr: string) {
        // Busca palabras enteras, numeros, operadores dobles o simples, y dos puntos
        const regex = /([a-zA-Z_]\w*)|(\d+)|(==|!=|>=|<=|>|<)|(:)/g;
        let match;

        while ((match = regex.exec(lineStr)) !== null) {
            const tokenStr = match[0];

            if (this.keywords[tokenStr] !== undefined) {
                const type = this.keywords[tokenStr];
                this.tokens.push({ type, line: this.line });
                this.trackStats(type, tokenStr); // Enviamos a contar
            } else if (/\d+/.test(tokenStr)) {
                this.tokens.push({ type: TokenType.NUMBER, value: parseInt(tokenStr, 10), line: this.line });
            } else if (tokenStr === ':') {
                this.tokens.push({ type: TokenType.COLON, line: this.line });
            } else {
                // Son operadores matemáticos/lógicos
                this.stats.operators++; // Contamos el uso de una expresión
                switch (tokenStr) {
                    case '==': this.tokens.push({ type: TokenType.EQ, line: this.line }); break;
                    case '!=': this.tokens.push({ type: TokenType.NEQ, line: this.line }); break;
                    case '>=': this.tokens.push({ type: TokenType.GTE, line: this.line }); break;
                    case '<=': this.tokens.push({ type: TokenType.LTE, line: this.line }); break;
                    case '>': this.tokens.push({ type: TokenType.GT, line: this.line }); break;
                    case '<': this.tokens.push({ type: TokenType.LT, line: this.line }); break;
                }
            }
        }
    }

    // Clasifica y suma al contador estático (tu API)
    private trackStats(type: TokenType, tokenStr: string) {
        if ([TokenType.MOVE, TokenType.ROTATE, TokenType.JUMP].includes(type)) {
            this.stats.actions++; this.stats.total++;
        } else if ([TokenType.LOOP, TokenType.WHILE].includes(type)) {
            this.stats.loops++; this.stats.total++;
        } else if (type === TokenType.IF) {
            this.stats.conditionals++; this.stats.total++;
        } else if ([TokenType.BREAK, TokenType.CONTINUE].includes(type)) {
            this.stats.controlFlow++; this.stats.total++;
        } else if (['and', 'or'].includes(tokenStr)) {
            this.stats.operators++; // También consideramos and/or como operadores de expresiones
        }
    }
}