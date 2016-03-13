var domain		= require('domain');
var _			= require("underscore");
var pstack		= require("pstack");
var fstool		= require("fs-tool");
var imageData	= require("image-data");
var pixfilters	= require("pixfilters");
var organism	= require("./ga");
var path		= require("path");


var regrow	= function(image, options) {
	this.image		= image;
	this.options	= _.extend({
		sample:	2,
		factor:	2
	}, options);
}

regrow.prototype.regen = function() {
	this.pixfilter	= new pixfilters(this.image.pixels, this.image.options.width, this.image.options.height);
	this.grayscale();
	//this.export('test/export/grayscale.png', function() {});
	
	var ga			= new organism({
		pixels:			this.image.pixels,
		width:			this.image.options.width,
		height:			this.image.options.width,
		stretchWidth:	this.image.options.width*this.options.factor,
		stretchHeight:	this.image.options.width*this.options.factor
	});
	
	ga.run(function(response) {
		console.log("response",response);
		//scope.exportPixels(response.pixels, response.width, response.height, 'test/export/evolved.png');
	})
}

regrow.prototype.init = function() {
	var scope = this;
	/*
		Make the image black and white
		Get a sample into an object
		Strech the sample
		Add noise
		Run GA to approximate the original shape
			Generate
			Scale down
			compare
	*/
	this.pixfilter	= new pixfilters(this.image.pixels, this.image.options.width, this.image.options.height);
	this.grayscale();
	this.export('test/export/grayscale.png', function() {});
	
	// Clip
	this.pixmap	= [];
	
	var stack = new pstack({
		progress:	'Growing...'
	});
	
	var x,y,w,h;
	//w	= 4;
	//h	= 1;
	w	= this.image.options.width-this.options.sample;
	h	= this.image.options.height-this.options.sample;
	
	console.log("wh",w,h);
	
	//return false;
	for (x=0;x<w;x++) {
		for (y=0;y<h;y++) {
			stack.add(function(done, p) {
				//scope.pixmap[scope.index(p.x,p.y,w)] = [];
				//done();
				scope.clip(p.x,p.y, function(pixels) {
					scope.pixmap[scope.index(p.x,p.y,w)] = pixels;
					done();
				});
			}, {x:x,y:y});
		}
	}
	stack.start(function() {
		console.log("Exporting the pixmap", scope.pixmap.length);
		scope.exportPixmap(scope.pixmap);
		//scope.mergePixmap(scope.pixmap, scope.image.options.width*scope.options.factor, scope.image.options.height*scope.options.factor);
	});
	
	/*
	this.clip(0,0,function(response) {
		console.log("Evolved!",response);
	});
	*/
}

regrow.prototype.exportPixmap = function(pixmap) {
	var scope = this;
	
	// Prepare the data
	var stack = new pstack({
		progress:	'Exporting...'
	});
	var output = [];
	_.each(pixmap, function(item,n) {
		stack.add(function(done) {
			var filename = 'test/export/tile-'+n+'.png';
			console.log(">>>> EXPORT",item, filename);
			scope.exportPixels(item, scope.options.sample*scope.options.factor, scope.options.sample*scope.options.factor, filename, function() {
				output[n] = filename;
				done();
			});
		});
	})
	
	stack.start(function(done, p) {
		fstool.file.writeJson("test/export/pixmap.json", output, function() {
			console.log("Done!");
		});
	});
}

regrow.prototype.mergePixmap = function(pixmap, w, h) {
	
	console.log("Merging the clips", w, h);
	
	var image	= new imageData({
		width:	w,
		height:	h
	});
	var i,j;
	var l = pixmap.length;
	var l2 = (this.options.sample*this.options.factor)*(this.options.sample*this.options.factor);
	var x,y,xx,yy;
	for (i=0;i<l;i++) {
		x = this.inv_index(i, w).x*2;
		y = this.inv_index(i, w).y*2;
		//console.log(">>",x,y);
		for (j=0;j<l2;j++) {
			color	= this.rgba_decode(pixmap[i][j]);
			//color.a	= 120;
			xx = x+this.inv_index(j, this.options.sample*this.options.factor).x;
			yy = y+this.inv_index(j, this.options.sample*this.options.factor).y;
			console.log("color ",xx,yy,color);
			image.setPixel(xx, yy, color);
		}
	}
	
	image.export(path.normalize(__dirname+"/test/export/zoomed.png"), function(filename) {
		console.log("Exported: ", filename);
	});
}

regrow.prototype.expected = function(x,y) {
	this.pixfilter	= new pixfilters(this.image.pixels, this.image.options.width, this.image.options.height);
	this.grayscale();
	this.export('test/export/_expected-grayscale.png', function() {});
	
	// Clip from the source
	var clipped		= this.pixfilter.clip(0,0,this.options.sample,this.options.sample,'pixels');
	this.exportPixels(clipped, this.options.sample, this.options.sample, 'test/export/_expected-clipped.png');
}

regrow.prototype.clip = function(x,y, callback) {
	var scope		= this;
	
	// Clip from the source
	var clipped		= this.pixfilter.clip(x,y,this.options.sample,this.options.sample,'pixels');
	//callback(clipped);
	
	
	var ga			= new organism({
		pixels:			clipped,
		width:			this.options.sample,
		height:			this.options.sample,
		stretchWidth:	this.options.sample*this.options.factor,
		stretchHeight:	this.options.sample*this.options.factor
	});
	ga.run(function(response) {
		console.log("Done: ",x,y);
		callback(response);
		//scope.exportPixels(response.pixels, response.width, response.height, 'test/export/evolved.png');
	})
	
	// Strech
	//var streched	= this.resize(clipped, this.options.sample, this.options.sample, this.options.sample*this.options.factor, this.options.sample*this.options.factor);
	
	// Add noise
	//var noisy		= this.applyNoise(streched);
	//this.exportPixels(noisy.pixels, noisy.width, noisy.height, 'test/export/noisy.png');
	
	
	/*
	// Scaled down
	var scaled		= this.resize(noisy.pixels, noisy.width, noisy.height, this.options.sample, this.options.sample);
	
	this.exportPixels(clipped, this.options.sample, this.options.sample, 'test/export/clipped.png');
	this.exportPixels(streched.pixels, streched.width, streched.height, 'test/export/streched.png');
	this.exportPixels(noisy.pixels, noisy.width, noisy.height, 'test/export/noisy.png');
	this.exportPixels(scaled.pixels, scaled.width, scaled.height, 'test/export/scaled.png');
	
	*/
}
regrow.prototype.applyNoise = function(options) {
	var scope = this;
	var pix	= new pixfilters(options.pixels, options.width, options.height);
	pix.each(function(rgba) {
		var noise = _.random(-50,50);
		return {
			r:	scope.range(rgba.r+noise,0,255),
			g:	scope.range(rgba.g+noise,0,255),
			b:	scope.range(rgba.b+noise,0,255),
			a:	scope.range(rgba.a,0,255)
		};
	});
	return {
		pixels:	pix.pixels,
		width:	pix.width,
		height:	pix.height
	};
}
regrow.prototype.grayscale = function() {
	this.pixfilter.each(function(rgba) {
		return {
			r:	rgba.r,
			g:	rgba.r,
			b:	rgba.r,
			a:	rgba.a
		};
	});
}
regrow.prototype.exportPixels = function(pixels, width, height, filename, callback) {
	if (!callback) {
		callback = function() {};
	}
	var image	= new imageData({
		width:	width,
		height:	height
	});
	image.pixels	= pixels;
	image.export(filename, callback);
}
regrow.prototype.export = function(filename, callback) {
	this.image.export(filename,callback);
}

regrow.prototype.resize = function(pixels, in_w, in_h, outputWidth, outputHeight) {
	/* Original code: http://stackoverflow.com/a/19223362/690236 */
	
	// Prepare the output pixels
	var output			= new Uint32Array(outputWidth*outputHeight);
	
	var W				= in_w;
	var H				= in_h;
	var time1			= Date.now();
	outputWidth			= Math.round(outputWidth);
	outputHeight		= Math.round(outputHeight);
	var ratio_w			= W / outputWidth;
	var ratio_h			= H / outputHeight;
	var ratio_w_half	= Math.ceil(ratio_w/2);
	var ratio_h_half	= Math.ceil(ratio_h/2);
	var color;
	
	for(var j = 0; j < outputHeight; j++){
		for(var i = 0; i < outputWidth; i++){
			var weight = 0;
			var weights = 0;
			var weights_alpha = 0;
			var gx_r = gx_g = gx_b = gx_a = 0;
			var center_y = (j + 0.5) * ratio_h;
			for(var yy = Math.floor(j * ratio_h); yy < (j + 1) * ratio_h; yy++){
				var dy = Math.abs(center_y - (yy + 0.5)) / ratio_h_half;
				var center_x = (i + 0.5) * ratio_w;
				var w0 = dy*dy //pre-calc part of w
				for(var xx = Math.floor(i * ratio_w); xx < (i + 1) * ratio_w; xx++){
					var dx = Math.abs(center_x - (xx + 0.5)) / ratio_w_half;
					var w = Math.sqrt(w0 + dx*dx);
					if(w >= -1 && w <= 1){
						//hermite filter
						weight = 2 * w*w*w - 3*w*w + 1;
						if(weight > 0) {
							dx = (xx + yy*W);
							// Get the color
							color	= this.rgba_decode(pixels[dx]);
							//alpha
							gx_a += weight * color.a;
							weights_alpha += weight;
							//colors
							if(color.a < 255)
							weight = weight * color.a / 250;
							gx_r += weight * color.r;
							gx_g += weight * color.g;
							gx_b += weight * color.b;
							weights += weight;
						}
					}
				}
			}
			var x2 = (i + j*outputWidth);
			output[x2]		= this.rgba_encode({
				r:	gx_r / weights,
				g:	gx_g / weights,
				b:	gx_b / weights,
				a:	gx_a / weights_alpha
			});
		}
	}
	
	return {
		width:	outputWidth,
		height:	outputHeight,
		pixels:	output
	};
	
}
regrow.prototype.index = function(x, y, w) {
	if (!w) {
		w = this.options.width;
	}
	return y * w + x;
}

regrow.prototype.inv_index = function(i, w) {
	/*
		y	= (i/w)^0
		x	= i-(y*w)
	*/
	if (!w) {
		w = this.options.width;
	}
	var y	= (i/w)^0;
	var x	= i-(y*w);
	return {
		x:	x,
		y:	y
	}
}
// Encode an rgba color into an int
regrow.prototype.rgba_encode = function(color) {
	// We encode into a int a 255 buffer, probability, position and direction
	return (this.range(color.r, 0, 255)<<24|this.range(color.g, 0, 255)<<16|this.range(color.b, 0, 255)<<8|this.range(color.a, 0, 255));
}
regrow.prototype.rgba_decode = function(pixel) {
	return {
		r:		0xFF & (pixel >> 24),
		g:		0xFF & (pixel >> 16),
		b:		0xFF & (pixel >> 8),
		a:		0xFF & pixel
	};
}
// Keep a value in a range
regrow.prototype.range = function(n, min, max) {
	return Math.min(255, Math.max(n, min));
}

module.exports = regrow;
