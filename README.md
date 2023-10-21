## Basics of the project

This project was bootstrapped using [Create React App](https://github.com/facebook/create-react-app).

Uses the GPU.js library to get the blur effect without using a lot of GPU power (I wrote a "kernel" function that uses the box blur principle).

## Why this project exists

This project aims to provide a base engine for it's use in visual novel video games.

Since it's written in javascript, you can see the results of changes in your game script in real time.

Also.... something something related to 

## Aspect to improve

The engine code is not very well documented (or commented, whatever). 

Sometimes a very rare bug appears. Basically, if you tab out of the engine window and, after a long time, tab back into the window (without clicking inside it), the engine seems to call the draw function twice. This is fixed by simply clicking inside the window, but that's not a decent fix.

The code itself is a mess because the project files are a combination of a very old (and particularly inefficient) first attempt to build a game engine and the current approach, but that can be fixed by simply finding and removing the files that are no longer used.
