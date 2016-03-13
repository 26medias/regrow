
var path		= require("path");
var imageData	= require("image-data");
var pixfilters	= require("pixfilters");
var regrow		= require("./regrow");


var image	= new imageData();
image.open(path.normalize(__dirname+"/test/10.png"), function(err) {
	
	var growth	= new regrow(image, {
		sample:	2,
		factor:	2
	});
	growth.regen();
	
	/*
	growth.export(path.normalize(__dirname+"/test/40.png"), function(filename) {
		console.log("Exported: ", filename);
	});
	*/
});

/*
var image2	= new imageData();
image2.open(path.normalize(__dirname+"/test/40.png"), function(err) {
	
	var growth	= new regrow(image, {
		sample:	4,
		factor:	2
	});
	growth.expected();
	
});
*/