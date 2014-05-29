// Global variables
canvas = undefined;
context = undefined;
canvasWebGl = undefined;
contextWebGl = undefined;

var settings = {
    linesToDraw: 5000,
    numberOfWorkers: 8,
    width: window.innerWidth,
    height: window.innerHeight,
    algorithm: 'pixel', // 'png' or 'pixel'
    antiAliasing: true,
    lineWidth: 2
};

(function init() {

    function initCanvas() {
        canvas = document.getElementById("canvas");
        canvas.width = settings.width; //document.width is obsolete
        canvas.height = settings.height;
    }

    function initContext() {
        context = canvas.getContext("2d");
        context.canvas.width = settings.width;
        context.canvas.height = settings.height;
    }

    function initWebGl() {
        try {
            canvasWebGl = document.getElementById("canvasWebGl");
            contextWebGl = canvasWebGl.getContext("experimental-webgl") || canvasWebGl.getContext("webgl");
            if (!contextWebGl) throw "contextWebGl not initialized";
        } catch (err) {
            throw "Your web browser does not support WebGL!";
        }

    }

    initCanvas();
    initContext();
    initWebGl();

})();

function benchmark(func) {
    var start = +new Date();  // log start timestamp

    func();

    var end = +new Date();  // log end timestamp
    console.log(arguments[0].name + ": " + (end - start) + "ms");
}

function clearCanvas() {
    context.clearRect(0, 0, canvas.width, canvas.height);
}


var drawLinesOnCanvasDirectly = function drawLinesOnCanvasDirectly() {
    drawLinesOnContext(context, '#0000FF');
};

var drawLinesOnCanvasOffScreen = function drawLinesOnCanvasOffScreen() {

    var offScreenCanvas = document.createElement('canvas');
    offScreenCanvas.width = settings.width; //document.width is obsolete
    offScreenCanvas.height = settings.height;

    var offScreenContext = offScreenCanvas.getContext("2d");
    offScreenContext.canvas.width = settings.width;
    offScreenContext.canvas.height = settings.height;


    drawLinesOnContext(offScreenContext, '#00FF00');

    context.drawImage(offScreenCanvas, 0, 0);
};

function drawLinesOnContext(_context, _color) {

    _context.beginPath();
    _context.strokeStyle = _color;
    _context.lineWidth = settings.lineWidth;

    for (var n = 0; n < settings.linesToDraw; n++) {

        var randomX = Math.random() * settings.width | 0;
        var randomY = Math.random() * settings.height | 0;
        _context.moveTo(randomX, randomY);

        var randomX = Math.random() * settings.width | 0;
        var randomY = Math.random() * settings.height | 0;
        _context.lineTo(randomX, randomY);
    }

    _context.stroke();

    // draw red line
    _context.beginPath();
    _context.strokeStyle = '#FFFFFF';
    _context.moveTo(0, 0);
    _context.lineTo(settings.width, settings.height);
    _context.stroke();
}

var drawLinesUsingWorkers = function drawLinesUsingWorkers() {

    var start = +new Date();  // log start timestamp

    var worker = new Worker('js/worker.js');

    worker.addEventListener('message', function (e) {

        console.log("Worker returned data");

        if (settings.algorithm == 'pixel') {
            var imageData = context.createImageData(settings.width, settings.height);
            for (var i = 0; i < imageData.data.length; i++)
                imageData.data[i] = e.data.data[i];

            context.putImageData(imageData, 0, 0);

        }

        else if (settings.algorithm == 'png') {
            var img = new Image();
            img.src = e.data.png;
            context.drawImage(img, 0, 0);
        }

        var end = +new Date();  // log end timestamp
        console.log("drawLinesUsingWorkers (alorithm: " + settings.algorithm + ", anti-aliasing: " + settings.antiAliasing + "): " + (end - start) + "ms");

    }, false);

    var data;

    if (settings.algorithm == 'pixel')
        data = context.getImageData(0, 0, settings.width, settings.height).data;
    else
        data = new Uint8Array(4 * settings.width * settings.height);

    worker.postMessage(
        {
            data: data,
            width: settings.width,
            height: settings.height,
            linesToDraw: settings.linesToDraw,
            algorithm: settings.algorithm,
            antiAliasing: settings.antiAliasing
        }
    );

};

function clearGl() {
    contextWebGl.clearColor(0.0, 0.0, 0.0, 0.0);
    contextWebGl.clear(contextWebGl.COLOR_BUFFER_BIT);
}

var drawLinesUsingWebGl = function drawLinesUsingWebGl() {

    function shaderProgram(gl, vs, fs) {
        var prog = gl.createProgram();
        var addshader = function (type, source) {
            var s = gl.createShader((type == 'vertex') ?
                gl.VERTEX_SHADER : gl.FRAGMENT_SHADER);
            gl.shaderSource(s, source);
            gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
                throw "Could not compile " + type +
                    " shader:\n\n" + gl.getShaderInfoLog(s);
            }
            gl.attachShader(prog, s);
        };
        addshader('vertex', vs);
        addshader('fragment', fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            throw "Could not link the shader program!";
        }
        return prog;
    }

    function attributeSetFloats(gl, prog, attr_name, rsize, arr) {
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr),
            gl.STATIC_DRAW);
        var attr = gl.getAttribLocation(prog, attr_name);
        gl.enableVertexAttribArray(attr);
        gl.vertexAttribPointer(attr, rsize, gl.FLOAT, false, 0, 0);
    }

    var prog = shaderProgram(contextWebGl,
            "attribute vec3 pos;" +
            "void main() {" +
            "	gl_Position = vec4(pos, 2.0);" +
            "}",
            "void main() {" +
            "	gl_FragColor = vec4(0.5, 0.5, 1.0, 0.1);" +
            "}"
    );
    contextWebGl.useProgram(prog);

    attributeSetFloats(contextWebGl, prog, "pos", 3, [
        -1, 0, 0,
        0, 1, 0,
        0, -1, 0,
        1, 0, 0
    ]);

    contextWebGl.drawArrays(contextWebGl.TRIANGLE_STRIP, 0, 4);
}

var drawLinesUsingPixi = function drawLinesUsingPixi() {
    // create an new instance of a pixi stage
    var stage = new PIXI.Stage(0X000000, true);

    stage.interactive = false;

    var renderer = PIXI.autoDetectRenderer(settings.width, settings.height, canvasWebGl, true, settings.antiAliasing);

    // set the canvas width and height to fill the screen
    //renderer.view.style.width = window.innerWidth + "px";
    //renderer.view.style.height = window.innerHeight + "px";
    renderer.view.style.display = "block";

    // add render view to DOM
    document.body.appendChild(renderer.view);

    var graphics = new PIXI.Graphics();

    graphics.lineStyle(settings.lineWidth, 0X000000, 1);

    for (var n = 0; n < settings.linesToDraw; n++) {

        var randomX = Math.random() * settings.width | 0;
        var randomY = Math.random() * settings.height | 0;
        graphics.moveTo(randomX, randomY);

        var randomX = Math.random() * settings.width | 0;
        var randomY = Math.random() * settings.height | 0;
        graphics.lineTo(randomX, randomY);
    }


    stage.addChild(graphics);
    renderer.render(stage);
}

//clearCanvas();
benchmark(drawLinesOnCanvasDirectly);

//clearCanvas();
benchmark(drawLinesOnCanvasOffScreen);

//clearGl();
//benchmark(drawLinesUsingWebGl);

//clearGl();
benchmark(drawLinesUsingPixi);

//clearCanvas();
drawLinesUsingWorkers();


