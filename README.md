browser-renderer-test
=====================

Quick and dirty research project for testing various rendering techniques within the browser (HTML5 Canvas, WebGl through pixi.js, Worker-based pixel-by-pixel rendering with/without PNG).

Reasoning behind this research project was to test various drawing libraries for a browser based map rendering.

We only test the line drawing functionality here.

[Brensenham's](http://en.wikipedia.org/wiki/Bresenham's_line_algorithm#Simplification) and [Xialin Wu's](http://en.wikipedia.org/wiki/Xiaolin_Wu%27s_line_algorithm) line rendering implementations are within the webworkers.

Using [pixi.js](https://github.com/GoodBoyDigital/pixi.js/) for WebGl rendering.

Using [PNG encoder in Javascript](http://www.xarg.org/2010/03/generate-client-side-png-files-using-javascript/) implementation in webworkers.

Renderers
=========

- **drawLinesOnCanvasDirectly**: Simply using the canvas' 2D context directly to draw.
- **drawLinesOnCanvasOffScreen**: Creating a canvas in the background (off-screen), drawing on it, and finally when ready pasting it via `context.drawImage(offScreenCanvas, 0, 0)` to the visible canvas.
- **drawLinesUsingPixi**: WebGl library.
- **drawLinesUsingWorkers**: Using webworkers (only one worker thread tested for comparison's sake, but expect proportional improvement in speed when using more workers). Workers render lines in the background pixel by pixel. This generated pixelmap is later returned to the main thread and pasted on the canvas as imageData or PNG (see below for more info).

Renderer _drawLinesUsingWorkers_ can be configured to use Bresenham's non-anti-aliased or Xiaolin Wu's anti-aliased algorithm.

Renderer _drawLinesUsingWorkers_ has two implementations:

- **pixel implementation:** Pixels are calculated using the above line rendering algorithms and the pixel map is passed back to the main thread where it is pasted on the canvas via `putImageData`
- **png implementation:** Pixels are calculated (same as for _pixel_ implementation) using the above line rendering algorithms and a PNG images (base64 encoded) is created. Main thread recieves this PNG image and pastes it using drawImage onto the canvas.


Results
=======

In Chrome Canary:

linesToDraw: 5000

Results sorted ascendingly with respect to execution times:

- **drawLinesOnCanvasDirectly**: 12ms
- **drawLinesOnCanvasOffScreen**: 15ms
- **drawLinesUsingPixi**: 42ms
- **drawLinesUsingWorkers** (algorithm: pixel, anti-aliasing: false): 269ms
- **drawLinesUsingWorkers** (algorithm: png, anti-aliasing: false): 1044ms
- **drawLinesUsingWorkers** (algorithm: pixel, anti-aliasing: true): 1490ms
- **drawLinesUsingWorkers** (algorithm: png, anti-aliasing: true): 2715ms


Conclusion
==========

HTML5 Canvas drawing is still the fastest.

Worker based rendering is slow, especially if we turn on anti-aliasing, then we have to do the heavy work of [alpha compositing](http://en.wikipedia.org/wiki/Alpha_compositing). On the other hand, we can use PNG alpha channel to do this alpha compositing for us, but constructing the PNG image is slow. Hence, doing the alpha compositing is less expensive then constructing a PNG. Additionally one would need to implement a complete 2D drawing library to use this technique. The reasoning for attempting this was only to see if we could offload the drawing to the background and, thus, make the application more responsive.

WebGL drawing is about 3-5 times slower than canvas drawing. Although slower than canvas, being vector based, we might want to use this feature on our maps when zooming in and out as to avoid the pixelization with CSS scaling, wich is the case with [Leaflet](http://leafletjs.com/)

