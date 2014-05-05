var RgbColor = function(r, g, b) {

	if (typeof(r) === 'string') {

		// straing, not color values .... parse 
		var colorString = r.toLowerCase();

		// remove all whitespace
		colorString = colorString.replace(/ /g, '');
		// remove any leading hash character
		colorString = colorString.replace(/^#/, '');

		var self = this,
			parsedAnything = false;

		// loop through each of the color parser definitions
		_.each(
			colorParsers,
			function(parser) {
				var match = parser.regex.exec(colorString);
				if (match) {
					parser.apply(match, self);
					parsedAnything = true;
				}
			}
		);

		if (!parsedAnything)
			throw new Error("Unable to parse '" + r + "' as a RGB color.");
	} else {
		this.R = r;
		this.G = g;
		this.B = b;
	}

	if (!this.isValid()) {
		throw new Error('Values are out of range ' + r + ' ' + g + ' ' + b);
	}

};

RgbColor.prototype.isValid = function() {
	return 0 <= this.R && this.R <= 1 && 0 <= this.G && this.G <= 1 && 0 <= this.B && this.B <= 1;
};

RgbColor.prototype.getValue = function(index) {
	if (index < 0 || index > 2)
		throw new Error("Index can only be between 0 and 2, inclusive.");
	switch (index) {
		case 0:
			return this.R;
		case 1:
			return this.G;
		case 2:
			return this.B;
	}
};

RgbColor.blend = function(from, to, ratio) {
	if (ratio <= 0)
		return from;
	if (ratio >= 1)
		return to;

	var h = from.R + ratio * (to.R - from.R);
	var s = from.G + ratio * (to.G - from.G);
	var l = from.B + ratio * (to.B - from.B);

	return new RgbColor(h, s, l);
};

RgbColor.random = function() {
	return new RgbColor(Math.random(), Math.random(), Math.random());
};

RgbColor.prototype.ColorType = RgbColor;

RgbColor.prototype.toString = function() {
	var r = Math.round(this.R * 255).toString(16);
	var g = Math.round(this.G * 255).toString(16);
	var b = Math.round(this.B * 255).toString(16);
	if (r.length == 1) r = '0' + r;
	if (g.length == 1) g = '0' + g;
	if (b.length == 1) b = '0' + b;
	return '#' + r + g + b;
};

var colorParsers = [{
	// eg: 'rgb(1,2,3)'
	regex: /^rgb\((\d{1,3}),(\d{1,3}),(\d{1,3})\)$/,
	apply: function(match, rgbColor) {
		rgbColor.R = parseInt(match[1]) / 0xFF;
		rgbColor.G = parseInt(match[2]) / 0xFF;
		rgbColor.B = parseInt(match[3]) / 0xFF;
	}
}, {
	// eg: '001122'
	regex: /^[0-9a-f]{6}$/,
	apply: function(match, rgbColor) {
		var hex = match[0];
		rgbColor.R = parseInt(hex.substr(0, 2), 16) / 0xFF;
		rgbColor.G = parseInt(hex.substr(2, 2), 16) / 0xFF;
		rgbColor.B = parseInt(hex.substr(4, 2), 16) / 0xFF;
	}
}, {
	// eg: '123'
	regex: /^[0-9a-f]{3}$/,
	apply: function(match, rgbColor) {
		var hex = match[0];
		rgbColor.R = parseInt(hex[0] + hex[0], 16) / 0xFF;
		rgbColor.G = parseInt(hex[1] + hex[1], 16) / 0xFF;
		rgbColor.B = parseInt(hex[2] + hex[2], 16) / 0xFF;
	}
}];

module.exports = RgbColor; 
