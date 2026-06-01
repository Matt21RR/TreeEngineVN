import { Lexer, CommandStats } from './lexer.ts';
import { Parser } from './parser.ts';
import { GameInterpreter, GameMap } from './interpreter.ts';
import Swal from 'sweetalert2';


export type AnimationsEngineLambdas = {
    move: () => void;
    jump: () => void;
    rotate: () => void;
};


function ejecutarNivel(
        code: string, 
        mapaNivel: GameMap, 
        spawnX: number, 
        spawnY: number, 
        animationsEngineLambdas: AnimationsEngineLambdas, 
        resetLevel: () => void,
        onLevelComplete: () => void
    ) {
    const verificarMedallas = (stats: CommandStats) => {
        Swal.fire({
            title: '¡Nivel Completado!',
            text: 'Has llegado a la meta. Ahora, veamos qué medallas has ganado...',
            icon: 'success',
            confirmButtonText: 'Ver Medallas'
        }).then(() => {
            Swal.fire({
                title: '¡Medallas Obtenidas!',
                text: `Has ganado ${stats.operators === 3 ? "1" : "0"} medallas de lógica y ${stats.loops < 2 ? "1" : "0"} medallas de optimización.`,
                icon: 'info',
                confirmButtonText: 'Cerrar'
            })
            .then(() => {
                console.log("¡Nivel completamente terminado! Puedes cerrar el juego o intentar otro nivel.");
                console.log(onLevelComplete);
                onLevelComplete();
            });
        });
    }
    
    // Simulador de animación de tu juego
    const animarJuego = (accion: string): Promise<void>  => {
        return new Promise(resolve => {
            setTimeout(() =>{ 
                resolve()
            }, 400); // Tarda 400ms en caminar
        });
    }

    console.log(code, mapaNivel, spawnX, spawnY, animationsEngineLambdas);

    try {
        // 1. Análisis y conteo de bloques
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        
        // 2. Parseo del árbol
        const parser = new Parser(tokens);
        const ast = parser.parse();

        // 3. Inicio del Juego
        const interpreter = new GameInterpreter(mapaNivel, spawnX, spawnY);

        interpreter.onLineChange = async (line, accion) => {
            if (["move", "jump", "rotate"].includes(accion)) {
                animationsEngineLambdas[accion as keyof AnimationsEngineLambdas]();
                await animarJuego(accion);
            } else {
                await new Promise(res => setTimeout(res, 200));
            }
        };

        interpreter.onError = (line, msg) => {
            Swal.fire({
                title: '¡Error en el Código!',
                text: `En la línea ${line}: ${msg}`,
                icon: 'error',
                confirmButtonText: 'Corregir Código'
            }).then(() => {                
                resetLevel();
            });
        }
        
        interpreter.onWin = () => {
            Swal.fire({
                title: '¡Nivel Completado!',
                text: 'Has llegado a la meta con éxito. ¡Veamos qué medallas has ganado!',
                icon: 'success',
                confirmButtonText: 'Ver Medallas'
            });
            verificarMedallas(lexer.stats);
        };
        
        // interpreter.onFail = (msg) => console.error(`\n❌ PERDISTE: ${msg}`);
        interpreter.onFail = (msg) => {
            Swal.fire({
                title: '¡Nivel Fallido!',
                text: msg,
                icon: 'error',
                confirmButtonText: 'Intentar de Nuevo'
            }).then(() => {
                resetLevel();
            });
        }

        interpreter.execute(ast);

    } catch (error) {
        console.error("❌ Error Crítico:", (error as Error).message);
        Swal.fire({
            title: '¡Error en el Código!',
            text: (error as Error).message,
            icon: 'error',
            confirmButtonText: 'Corregir Código'
        }).then(() => {
            resetLevel();
        });
    }
}


export default function LoadGameToWindow() {
  // Aquí podrías integrar el código del juego real, usando el Lexer, Parser e Interpreter
  window.ejecutarNivelBloxorz = (
    code: string, 
    mapa: GameMap, 
    spawnX: number, 
    spawnY: number,
    animationsEngineLambdas: AnimationsEngineLambdas,
    resetLevel: () => void,
    onLevelComplete: () => void
  ) => ejecutarNivel(code, mapa, spawnX, spawnY, animationsEngineLambdas, resetLevel, onLevelComplete);
}