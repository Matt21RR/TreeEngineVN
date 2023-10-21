# Basics of the project

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

Uses GPU.js Library, to achieve the effect of blur without consuming a lot of GPU performance (I wrote a "kernel" function that uses the box blur principle).

## Why this project exist

This project aims to provide a base engine for it's use in visual novels videogames.

Due it's written in javascript you can show the results of the changes in your game script in realtime.

Also.... something something related to 

## Aspect to improve

The code of the engine isn't too much well documented (or commented, whatever) 

Sometimes, a very rarely bug appears. Basically when you tab out the window of the engine and, after a long time woy tab back to the window (without click inside of it), the engine appears to call to the draw function twice. That's fix simply clicking inside the window but that doesn't are a decent fix.
