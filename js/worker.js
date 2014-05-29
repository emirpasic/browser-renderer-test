/**
 * A handy class to calculate color values.
 *
 * @version 1.0
 * @author Robert Eisele <robert@xarg.org>
 * @copyright Copyright (c) 2010, Robert Eisele
 * @link http://www.xarg.org/2010/03/generate-client-side-png-files-using-javascript/
 * @license http://www.opensource.org/licenses/bsd-license.php BSD License
 *
 */

(function () {

    // helper functions for that ctx
    function write(buffer, offs) {
        for (var i = 2; i < arguments.length; i++) {
            for (var j = 0; j < arguments[i].length; j++) {
                buffer[offs++] = arguments[i].charAt(j);
            }
        }
    }

    function byte2(w) {
        return String.fromCharCode((w >> 8) & 255, w & 255);
    }

    function byte4(w) {
        return String.fromCharCode((w >> 24) & 255, (w >> 16) & 255, (w >> 8) & 255, w & 255);
    }

    function byte2lsb(w) {
        return String.fromCharCode(w & 255, (w >> 8) & 255);
    }

    self.PNGlib = function (width, height, depth) {

        this.width = width;
        this.height = height;
        this.depth = depth;

        // pixel data and row filter identifier size
        this.pix_size = height * (width + 1);

        // deflate header, pix_size, block headers, adler32 checksum
        this.data_size = 2 + this.pix_size + 5 * Math.floor((0xfffe + this.pix_size) / 0xffff) + 4;

        // offsets and sizes of Png chunks
        this.ihdr_offs = 0;									// IHDR offset and size
        this.ihdr_size = 4 + 4 + 13 + 4;
        this.plte_offs = this.ihdr_offs + this.ihdr_size;	// PLTE offset and size
        this.plte_size = 4 + 4 + 3 * depth + 4;
        this.trns_offs = this.plte_offs + this.plte_size;	// tRNS offset and size
        this.trns_size = 4 + 4 + depth + 4;
        this.idat_offs = this.trns_offs + this.trns_size;	// IDAT offset and size
        this.idat_size = 4 + 4 + this.data_size + 4;
        this.iend_offs = this.idat_offs + this.idat_size;	// IEND offset and size
        this.iend_size = 4 + 4 + 4;
        this.buffer_size = this.iend_offs + this.iend_size;	// total PNG size

        this.buffer = new Array();
        this.palette = new Object();
        this.pindex = 0;

        var _crc32 = new Array();

        // initialize buffer with zero bytes
        for (var i = 0; i < this.buffer_size; i++) {
            this.buffer[i] = "\x00";
        }

        // initialize non-zero elements
        write(this.buffer, this.ihdr_offs, byte4(this.ihdr_size - 12), 'IHDR', byte4(width), byte4(height), "\x08\x03");
        write(this.buffer, this.plte_offs, byte4(this.plte_size - 12), 'PLTE');
        write(this.buffer, this.trns_offs, byte4(this.trns_size - 12), 'tRNS');
        write(this.buffer, this.idat_offs, byte4(this.idat_size - 12), 'IDAT');
        write(this.buffer, this.iend_offs, byte4(this.iend_size - 12), 'IEND');

        // initialize deflate header
        var header = ((8 + (7 << 4)) << 8) | (3 << 6);
        header += 31 - (header % 31);

        write(this.buffer, this.idat_offs + 8, byte2(header));

        // initialize deflate block headers
        for (var i = 0; (i << 16) - 1 < this.pix_size; i++) {
            var size, bits;
            if (i + 0xffff < this.pix_size) {
                size = 0xffff;
                bits = "\x00";
            } else {
                size = this.pix_size - (i << 16) - i;
                bits = "\x01";
            }
            write(this.buffer, this.idat_offs + 8 + 2 + (i << 16) + (i << 2), bits, byte2lsb(size), byte2lsb(~size));
        }

        /* Create crc32 lookup table */
        for (var i = 0; i < 256; i++) {
            var c = i;
            for (var j = 0; j < 8; j++) {
                if (c & 1) {
                    c = -306674912 ^ ((c >> 1) & 0x7fffffff);
                } else {
                    c = (c >> 1) & 0x7fffffff;
                }
            }
            _crc32[i] = c;
        }

        // compute the index into a png for a given pixel
        this.index = function (x, y) {
            var i = y * (this.width + 1) + x + 1;
            var j = this.idat_offs + 8 + 2 + 5 * Math.floor((i / 0xffff) + 1) + i;
            return j;
        }

        // convert a color and build up the palette
        this.color = function (red, green, blue, alpha) {

            alpha = alpha >= 0 ? alpha : 255;
            var color = (((((alpha << 8) | red) << 8) | green) << 8) | blue;

            if (typeof this.palette[color] == "undefined") {
                if (this.pindex == this.depth) return "\x00";

                var ndx = this.plte_offs + 8 + 3 * this.pindex;

                this.buffer[ndx + 0] = String.fromCharCode(red);
                this.buffer[ndx + 1] = String.fromCharCode(green);
                this.buffer[ndx + 2] = String.fromCharCode(blue);
                this.buffer[this.trns_offs + 8 + this.pindex] = String.fromCharCode(alpha);

                this.palette[color] = String.fromCharCode(this.pindex++);
            }
            return this.palette[color];
        }

        // output a PNG string, Base64 encoded
        this.getBase64 = function () {

            var s = this.getDump();

            var ch = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
            var c1, c2, c3, e1, e2, e3, e4;
            var l = s.length;
            var i = 0;
            var r = "";

            do {
                c1 = s.charCodeAt(i);
                e1 = c1 >> 2;
                c2 = s.charCodeAt(i + 1);
                e2 = ((c1 & 3) << 4) | (c2 >> 4);
                c3 = s.charCodeAt(i + 2);
                if (l < i + 2) {
                    e3 = 64;
                } else {
                    e3 = ((c2 & 0xf) << 2) | (c3 >> 6);
                }
                if (l < i + 3) {
                    e4 = 64;
                } else {
                    e4 = c3 & 0x3f;
                }
                r += ch.charAt(e1) + ch.charAt(e2) + ch.charAt(e3) + ch.charAt(e4);
            } while ((i += 3) < l);
            return r;
        }

        // output a PNG string
        this.getDump = function () {

            // compute adler32 of output pixels + row filter bytes
            var BASE = 65521;
            /* largest prime smaller than 65536 */
            var NMAX = 5552;
            /* NMAX is the largest n such that 255n(n+1)/2 + (n+1)(BASE-1) <= 2^32-1 */
            var s1 = 1;
            var s2 = 0;
            var n = NMAX;

            for (var y = 0; y < this.height; y++) {
                for (var x = -1; x < this.width; x++) {
                    s1 += this.buffer[this.index(x, y)].charCodeAt(0);
                    s2 += s1;
                    if ((n -= 1) == 0) {
                        s1 %= BASE;
                        s2 %= BASE;
                        n = NMAX;
                    }
                }
            }
            s1 %= BASE;
            s2 %= BASE;
            write(this.buffer, this.idat_offs + this.idat_size - 8, byte4((s2 << 16) | s1));

            // compute crc32 of the PNG chunks
            function crc32(png, offs, size) {
                var crc = -1;
                for (var i = 4; i < size - 4; i += 1) {
                    crc = _crc32[(crc ^ png[offs + i].charCodeAt(0)) & 0xff] ^ ((crc >> 8) & 0x00ffffff);
                }
                write(png, offs + size - 4, byte4(crc ^ -1));
            }

            crc32(this.buffer, this.ihdr_offs, this.ihdr_size);
            crc32(this.buffer, this.plte_offs, this.plte_size);
            crc32(this.buffer, this.trns_offs, this.trns_size);
            crc32(this.buffer, this.idat_offs, this.idat_size);
            crc32(this.buffer, this.iend_offs, this.iend_size);

            // convert PNG to string
            return "\211PNG\r\n\032\n" + this.buffer.join('');
        }
    }

})();

function createPNG(width, height, data) {
    var png = new PNGlib(width, height, 256); // construcor takes height, weight and color-depth
    var background = png.color(0, 0, 0, 0); // set the background transparent

    for (var i = 0; i < data.length; i += 4) {

        var x = (i / 4) % width;
        var y = Math.floor((i / 4) / width);

        // use a color triad of Microsofts million dollar color
        png.buffer[png.index(x, y)] = png.color(
            data[i + 0],
            data[i + 1],
            data[i + 2],
            data[i + 3]
        );
    }
    return png;
}


self.addEventListener('message', function (e) {
    console.log("Worker received data");

    var width = e.data.width;
    var height = e.data.height;
    var linesToDraw = e.data.linesToDraw;
    var algorithm = e.data.algorithm;
    var antiAliasing = e.data.antiAliasing;

    var data = e.data.data;

    for (var n = 0; n < linesToDraw; n++) {

        var randomX0 = Math.random() * width | 0;
        var randomY0 = Math.random() * height | 0;

        var randomX1 = Math.random() * width | 0;
        var randomY1 = Math.random() * height | 0;

        if (antiAliasing)
            drawLineAA(data, width, height, randomX0, randomY0, randomX1, randomY1, 255, 0, 0, 255);
        else
            drawLine(data, width, height, randomX0, randomY0, randomX1, randomY1, 255, 0, 0, 255);
    }

    if (algorithm == 'pixel') {
        self.postMessage({
            data: data
        });
    }

    else if (algorithm == 'png') {
        var start = +new Date();  // log start timestamp

        var png = createPNG(width, height, data);

        self.postMessage({
            png: 'data:image/png;base64,' + png.getBase64()
        });

        var end = +new Date();  // log end timestamp
        console.log("Creating PNG: " + (end - start) + "ms");
    }

}, false);

// adapted from http://en.wikipedia.org/wiki/Bresenham's_line_algorithm#Simplification
function drawLine(data, width, height, x0, y0, x1, y1, r, g, b, a) {

    var dx = Math.abs(x1 - x0);
    var dy = Math.abs(y1 - y0);

    var sx = 1.0;
    if (x0 >= x1)  sx = -1.0;

    var sy = 1.0;
    if (y0 >= y1) sy = -1.0;

    var err = dx - dy;


    while (true) {

        drawPoint(data, width, height, x0, y0, r, g, b, a);
        if (x0 == x1 && y0 == y1) break;

        var e2 = 2.0 * err;
        if (e2 > -dy) {
            err = err - dy;
            x0 += sx;
        }
        if (e2 < dx) {
            err = err + dx;
            y0 = y0 + sy;
        }
    }
}

function drawPoint(data, width, height, x, y, r, g, b, a) {

    if (x < 0 || x > width || y < 0 || y > height)
        return;

    var index = 4 * (y * width + x);

    if (a == 255) {

        data[index + 0] = r;
        data[index + 1] = g;
        data[index + 2] = b;
        data[index + 3] = a;

    } else {

        data[index + 0] = Math.min(255, (r * a / 255) + ( data[index + 0] * (1.0 - a / 255)));
        data[index + 1] = Math.min(255, (g * a / 255) + ( data[index + 1] * (1.0 - a / 255)));
        data[index + 2] = Math.min(255, (b * a / 255) + ( data[index + 2] * (1.0 - a / 255)));
        data[index + 3] = Math.min(255, (a * a / 255) + ( data[index + 3] * (1.0 - a / 255)));

    }

}

// adapted from http://en.wikipedia.org/wiki/Xiaolin_Wu%27s_line_algorithm
function fpart(x) {
    return x - Math.floor(x);
}

function rfpart(x) {
    return 1 - fpart(x);
}

function drawLineAA(data, width, height, x0, y0, x1, y1, r, g, b, a) {

    var steep = Math.abs(y1 - y0) > Math.abs(x1 - x0);

    if (steep) {

        var tmp = x0;
        x0 = y0;
        y0 = tmp;

        tmp = x1;
        x1 = y1;
        y1 = tmp;
    }

    if (x0 > x1) {

        var tmp = x0;
        x0 = x1;
        x1 = tmp;

        tmp = y0;
        y0 = y1;
        y1 = tmp;
    }

    var dx = x1 - x0;
    var dy = y1 - y0;
    var gradient = dy / dx;

    // handle first endpoint
    var xend = Math.round(x0);
    var yend = y0 + gradient * (xend - x0);
    var xgap = rfpart(x0 + 0.5);
    var xpxl1 = xend;   //this will be used in the main loop
    var ypxl1 = Math.floor(yend);
    if (steep) {
        drawPoint(data, width, height, ypxl1, xpxl1, r, g, b, rfpart(yend) * xgap * a);
        drawPoint(data, width, height, ypxl1 + 1, xpxl1, r, g, b, fpart(yend) * xgap * a);
    } else {
        drawPoint(data, width, height, xpxl1, ypxl1, r, g, b, rfpart(yend) * xgap * a);
        drawPoint(data, width, height, xpxl1, ypxl1 + 1, r, g, b, fpart(yend) * xgap * a);
    }
    var intery = yend + gradient; // first y-intersection for the main loop

    // handle second endpoint

    xend = Math.round(x1);
    yend = y1 + gradient * (xend - x1)
    xgap = fpart(x1 + 0.5)
    xpxl2 = xend //this will be used in the main loop
    ypxl2 = Math.floor(yend)
    if (steep) {
        drawPoint(data, width, height, ypxl2, xpxl2, r, g, b, rfpart(yend) * xgap * a);
        drawPoint(data, width, height, ypxl2 + 1, xpxl2, r, g, b, fpart(yend) * xgap * a);
    } else {
        drawPoint(data, width, height, xpxl2, ypxl2, r, g, b, rfpart(yend) * xgap * a);
        drawPoint(data, width, height, xpxl2, ypxl2 + 1, r, g, b, fpart(yend) * xgap * a);
    }

    // main loop

    for (var x = xpxl1 + 1; x <= xpxl2 - 1; x++) {
        if (steep) {
            drawPoint(data, width, height, Math.floor(intery), x, r, g, b, rfpart(intery) * a);
            drawPoint(data, width, height, Math.floor(intery) + 1, x, r, g, b, fpart(intery) * a);
        } else {
            drawPoint(data, width, height, x, Math.floor(intery), r, g, b, rfpart(intery) * a);
            drawPoint(data, width, height, x, Math.floor(intery) + 1, r, g, b, fpart(intery) * a);
        }
        intery = intery + gradient
    }
}
