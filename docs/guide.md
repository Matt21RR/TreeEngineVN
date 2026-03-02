# First steps
## Setting up the project structure

As in any software program, we require to define an entry point, a main file, for our application. In TreeEngineVN, this file is named `main.txt` and is located in the `game` directory. 

The next step is to define the assets that our game will use, such as textures, scripts, and sounds. To do this, we create three JSON files: `textures.json`, `scripts.json`, and `sounds.json`. These files will be located in their respective directories within the `game` folder. The structure of the `game` directory will look like this:

```
game/
├── textures/
│   ├── ...resource files...
│   └── textures.json
├── scripts/
│   ├── ...resource files...
│   └── scripts.json
├── sounds/
│   ├── ...resource files...
│   └── sounds.json
└── main.txt
```

Actually, the `*.json` files content could be generated via the engine tools, but you can also create them manually. The content of these files should be a JSON object where the keys are the names of the resources and the values are the paths to those resources relative to each directory. For example, the `textures.json` file might look like this:

```json
{
  "background": "./background.png",
  "character": "./character.png"
}
``` 
Where `background` and `character` are the names of the textures, and `./background.png` and `./character.png` are the paths to the texture files relative to the `textures` directory.

## The main file
The `main.txt` file is the entry point of our game. The content of this file will be written in a custom scripting language designed for TreeEngineVN. The scripting language will include commands for displaying text, showing images, playing sounds, and handling user input. For example, the `main.txt` file might look like this:

```typescript
background = new GraphObject({
  texture:"background", 
  enabled:true})
congratulation = new GraphObject({
  text:"Hurray!",
  fontSize:144, 
  enabled:true})
sound welcome play
"Welcome to TreeEngineVN!"
```

In this example, we create two graphical objects, `background`, using the textures defined in `textures.json`, and `congratulation`, as a text object. We also play a sound named `welcome` and display a line of text to the player. 

## Organizing the game scripts

Depending on the complexity of your game, the `main.txt` file can become quite large. To manage this, you can create additional script files in the `scripts` directory and include them in `main.txt` using an `include` command. For example:

```ruby
include backgroudsDefinitions
```
This command would include the `backgroundsDefinitions` module defined previously in another script file from the `scripts` directory, allowing you to organize your code more effectively.

### Defining script modules
In the `scripts` directory, you can create script files that define modules. A module is a reusable piece of code that can be included in multiple places in your game. For example, you might have a `definitions.txt` file that defines all the background objects for your game:

```typescript
module backgroundsDefinitions

background1 = new GraphObject({
  texture:"background1", 
  x:0.7,
  y:0.5})
background2 = new GraphObject({
  texture:"background2",
  x:0.3,
  y:0.5})

end module

module characterDefinitions
  ...
end module
```
In this example, we define two background objects, `background1` and `background2`, which can be included in the `main.txt` file or any other script file using the `include` command. This allows you to keep your code organized and maintainable as your game grows in complexity.

Also, note that we could define as many modules as we want in a single script file, and we can include a specific module from that file using the `include` command.
