var domain		= require('domain');
var _			= require("underscore");
var pstack		= require("pstack");
var imageData	= require("image-data");
var pixfilters	= require("pixfilters");





/*
	          _ _ 
	  ___ ___| | |
	 / __/ _ \ | |
	| (_|  __/ | |
	 \___\___|_|_|
	              
*/
var cell	= function(data, options) {
	this.data	= {
		width:	data.width,
		height:	data.height
	};
	this.data.pixels	= this.clone(data.pixels);
	
	this.options	= _.extend({
		mutation:	.1
	}, options);
	
	this.fitness	= 0;
	this.lifecycle	= 0;
	
	this.mutate();
}

cell.prototype.mutate = function() {
	var scope	= this;
	this.each(function(rgba) {
		var val = 1+_.random(scope.options.mutation*-1000,scope.options.mutation*1000)/1000;
		//console.log("val",val);
		return {
			r:	scope.range(rgba.r*val,0,255),
			g:	scope.range(rgba.g*val,0,255),
			b:	scope.range(rgba.b*val,0,255),
			a:	scope.range(rgba.a,0,255)
		};
	});
}
cell.prototype.each = function(update) {
	var scope = this;
	_.each(this.data.pixels, function(v, p) {
		scope.data.pixels[p]	= scope.rgba_encode(update(scope.rgba_decode(scope.data.pixels[p])));
		return true;
	});
	return this;
}
// Encode an rgba color into an int
cell.prototype.rgba_encode = function(color) {
	// We encode into a int a 255 buffer, probability, position and direction
	return (this.range(color.r, 0, 255)<<24|this.range(color.g, 0, 255)<<16|this.range(color.b, 0, 255)<<8|this.range(color.a, 0, 255));
}
cell.prototype.rgba_decode = function(pixel) {
	return {
		r:		0xFF & (pixel >> 24),
		g:		0xFF & (pixel >> 16),
		b:		0xFF & (pixel >> 8),
		a:		0xFF & pixel
	};
}
// Keep a value in a range
cell.prototype.range = function(n, min, max) {
	return Math.min(255, Math.max(n, min));
}
cell.prototype.clone = function(input) {
	var l		= input.length;
	var output	= new Uint32Array(l);
	for (i=0;i<l;i++) {
		output[i]	= input[i];
	}
	return output;
}







/*
	                             _               
	  ___  _ __ __ _  __ _ _ __ (_)___ _ __ ___  
	 / _ \| '__/ _` |/ _` | '_ \| / __| '_ ` _ \ 
	| (_) | | | (_| | (_| | | | | \__ \ | | | | |
	 \___/|_|  \__, |\__,_|_| |_|_|___/_| |_| |_|
	           |___/                             
*/
var organism	= function(options) {
	this.options	= _.extend({
		pixels:			[],
		width:			0,
		height:			0,
		population:		50,
		maxPopulation:	100,
		lifecycle:		20,
		mutation:		.15,
		mutationMerge:	.05,
		alpha:			.1,
		generations:	500,
		targetMSE:		5
	}, options);
	
	//console.log("this.options",this.options);
}

organism.prototype.run = function(callback) {
	var scope = this;
	/*
		Prepare the sample
			Stretch
			Add Noise
		Create a new population
	*/
	
	
	// Strech
	var stretched	= this.resize(this.options.pixels, this.options.width, this.options.height, this.options.stretchWidth, this.options.stretchHeight);
	
	// Add noise
	var noisy		= this.applyNoise(stretched);
	
	// Export for debug
	//this.exportPixels(this.options.pixels, this.options.width, this.options.height, 'test/export/clipped.png');
	//this.exportPixels(noisy.pixels, noisy.width, noisy.height, 'test/export/noisy.png');
	
	this.population	= [];
	var i;
	for (i=0;i<this.options.population;i++) {
		this.population.push(new cell(noisy, {
			mutation:	this.options.mutation
		}));
	}
	
	//this.exportPopulation('init');
	
	
	
	
	var i;
	var stack = new pstack();
	
	for (i=0;i<this.options.generations;i++) {
		stack.add(function(done, i) {
			scope.checkPopulationFitness();
			console.log("Generation ",i,scope.population.length);
			console.log(scope.getCurrentFitness());
			scope.cullPopulation();
			scope.reproductionCycle();
			//console.log("-----------");
			done();
			return true;
		},i);
	}
	stack.start(function() {
		//console.log("Done");
		scope.checkPopulationFitness();
		scope.cullPopulation(20);
		console.log(scope.getCurrentFitness());
		
		scope.exportPopulation('best');
		return true;
		
		//callback(scope.population[0].data);
		
		//console.log(scope.getCurrentFitness());
		//scope.exportPopulation('evolved');
		
		// scale the best one
		//var scaled		= scope.resize(scope.population[0].data.pixels, scope.population[0].data.width, scope.population[0].data.height, scope.options.width, scope.options.height);
		
		//scope.exportPixels(scaled.pixels, scaled.width, scaled.height, 'test/export/evolved-scaled.png');
		
		//scope.exportPixels(scope.population[0].data.pixels, scope.population[0].data.width, scope.population[0].data.height, 'test/export/evolved-winner.png');
	});
	
}


organism.prototype.checkPopulationFitness = function() {
	var scope = this;
	
	_.each(this.population, function(population, n) {
		// Scale down to the sample size
		var scaled		= scope.resize(population.data.pixels, population.data.width, population.data.height, scope.options.width, scope.options.height);
		
		// Compute the difference
		scope.population[n].fitness = scope.getPixelFitness(scaled);
		
		// Remember the age
		//scope.population[n].lifecycle++;
		return true;
	});
	
	
	// Rank the population
	this.population.sort(function(a,b) {
		return a.fitness-b.fitness;
	});
	
	return this;
}

organism.prototype.getCurrentFitness = function() {
	var scope = this;
	
	var scores = _.map(this.population, function(item) {
		return item.fitness.toFixed(6);
	});
	
	scores.sort(function(a,b) {
		return a-b;
	});
	
	return scores.slice(0,10);
}

organism.prototype.cullPopulation = function(n) {
	var scope = this;
	
	if (!n) {
		n	= this.options.maxPopulation;
	}
	
	// Rank the population
	this.population.sort(function(a,b) {
		return a.fitness-b.fitness;
	});
	
	if (this.population.length > n) {
		//console.log("Culling the population");
		this.population = this.population.slice(0, n);
	}
	
	return this;
}

organism.prototype.reproductionCycle = function() {
	var scope = this;
	
	// Rank the population
	this.population.sort(function(a,b) {
		return a.fitness-b.fitness;
	});
	
	var i,j;
	var l	= Math.ceil(this.population.length*this.options.alpha);
	var l2	= this.population.length;
	
	
	
	for (i=0;i<l;i++) {
		for (j=0;j<l2;j++) {
			if (i==j) {
				continue;
			}
			//console.log(">",i,j);
			//this.merge(this.population[i],this.population[j])
			this.population.push(this.merge(this.population[i],this.population[j]));
		}
	}
	return this;
}
organism.prototype.merge = function(cell1, cell2) {
	var newCell = new cell(cell1.data, {
		mutation:	this.options.mutationMerge
	});
	var i;
	var l = newCell.data.pixels.length;
	var color1, color2;
	for (i=0;i<l;i++) {
		color1	= this.rgba_decode(cell1.data.pixels[i]);
		color2	= this.rgba_decode(cell2.data.pixels[i]);
		//console.log("color",color1,color2, newCell.data.pixels[i]);
		newCell.data.pixels[i]	= this.rgba_encode({
			r:	Math.round((color1.r+color2.r)/2),
			g:	Math.round((color1.g+color2.g)/2),
			b:	Math.round((color1.b+color2.b)/2),
			a:	Math.round((color1.a+color2.a)/2)
		});
	}
	newCell.mutate();
	return newCell;
}

organism.prototype.agePopulation = function() {
	var scope = this;
	
	// Rank the population
	this.population	= _.filter(this.population, function(item) {
		return item.lifecycle<scope.options.lifecycle;
	});
	
	return this;
}

organism.prototype.getPixelFitness = function(input) {
	var i;
	var l = input.pixels.length;
	var buffer = {
		sum:	0
	};
	for (i=0;i<l;i++) {
		buffer.sum	+= Math.pow(Math.abs(this.rgba_decode(this.options.pixels[i]).r-this.rgba_decode(input.pixels[i]).r),2);
	}
	return Math.sqrt(buffer.sum/l);
}




organism.prototype.exportPopulation = function(name, callback) {
	var scope = this;
	
	var stack = new pstack({
		progress:	'Exporting the population...'
	});
	
	_.each(this.population, function(population, n) {
		stack.add(function(done) {
			scope.exportPixels(population.data.pixels, population.data.width, population.data.height, 'test/export/'+name+'-'+n+'.png', done);
		});
	});
	
	stack.start(function() {
		if (callback) {
			callback();
		}
	});
	return this;
}
organism.prototype.applyNoise = function(options) {
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
organism.prototype.grayscale = function() {
	this.pixfilter.each(function(rgba) {
		return {
			r:	rgba.r,
			g:	rgba.r,
			b:	rgba.r,
			a:	rgba.a
		};
	});
}
organism.prototype.exportPixels = function(pixels, width, height, filename, callback) {
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
organism.prototype.export = function(filename, callback) {
	this.image.export(filename,callback);
}

organism.prototype.resize = function(pixels, in_w, in_h, outputWidth, outputHeight) {
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

// Encode an rgba color into an int
organism.prototype.rgba_encode = function(color) {
	// We encode into a int a 255 buffer, probability, position and direction
	return (this.range(color.r, 0, 255)<<24|this.range(color.g, 0, 255)<<16|this.range(color.b, 0, 255)<<8|this.range(color.a, 0, 255));
}
organism.prototype.rgba_decode = function(pixel) {
	return {
		r:		0xFF & (pixel >> 24),
		g:		0xFF & (pixel >> 16),
		b:		0xFF & (pixel >> 8),
		a:		0xFF & pixel
	};
}
// Keep a value in a range
organism.prototype.range = function(n, min, max) {
	return Math.min(255, Math.max(n, min));
}

module.exports = organism;
