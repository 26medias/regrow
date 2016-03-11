
var path		= require("path");
var imageData	= require("image-data");
var pixfilters	= require("pixfilters");
var regrow		= require("./regrow");


var image	= new imageData();
image.open(path.normalize(__dirname+"/test/origin.png"), function(err) {
	
	image.scale({
		display:	'crop',	// crop, fit
		scaleUp:	false,
		width:		20,
		height:		20
	});
	
	image.export(path.normalize(__dirname+"/test/20.png"), function(filename) {
		console.log("Exported: ", filename);
	});
});
image.open(path.normalize(__dirname+"/test/origin.png"), function(err) {
	
	image.scale({
		display:	'crop',	// crop, fit
		scaleUp:	false,
		width:		40,
		height:		40
	});
	
	image.export(path.normalize(__dirname+"/test/40.png"), function(filename) {
		console.log("Exported: ", filename);
	});
});
