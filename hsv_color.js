RgbColor = require("./rgb_color");

var twoPi = Math.PI * 2;

var setFromRgb = function(hsv, rgb) {
	
	var r = rgb.R,
		g = rgb.G,
		b = rgb.B;

	var max = Math.max(r, g, b),
		min = Math.min(r, g, b),
		d = max - min;

	if (max == min) {
		// achromatic
		hsv.H = 0;
	} else {
		var h;
		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			case b:
				h = (r - g) / d + 4;
				break;
		}
		h /= 6;
		hsv.H = h;
	}

	hsv.S = max == 0 ? 0 : d / max;
	hsv.V = max;

};

var HsvColor = function(h, s, v) {

	if (typeof(h) === 'string') {
		var rgb = new RgbColor(h);
		setFromRgb(this, rgb);
	} else if (h instanceof RgbColor) {
		setFromRgb(this, h);
	} else {
		this.H = h;
		this.S = s;
		this.V = v;
	}

	if (!this.isValid()) {
		throw new Error('Values are out of range: ' + h + ' ' + s + ' ' + v);
	}

};

HsvColor.prototype.isValid = function() {
	return 0 <= this.H && this.H <= 1 && 0 <= this.S && this.S <= 1 && 0 <= this.V && this.V <= 1;
};

HsvColor.prototype.toRgb = function() {

	var i = Math.floor(this.H * 6);
	var f = this.H * 6 - i;
	var p = this.V * (1 - this.S);
	var q = this.V * (1 - f * this.S);
	var t = this.V * (1 - (1 - f) * this.S);

	var r, g, b;

	switch (i % 6) {
		case 0:
			r = this.V;
			g = t;
			b = p;
			break;
		case 1:
			r = q;
			g = this.V;
			b = p;
			break;
		case 2:
			r = p;
			g = this.V;
			b = t;
			break;
		case 3:
			r = p;
			g = q;
			b = this.V;
			break;
		case 4:
			r = t;
			g = p;
			b = this.V;
			break;
		case 5:
			r = this.V;
			g = p;
			b = q;
			break;
	}

	return new RgbColor(r, g, b);
	
};

//noinspection FunctionWithInconsistentReturnsJS
HsvColor.prototype.getValue = function(index) {
	if (index < 0 || index > 2)
		throw new Error("Index can only be between 0 and 2, inclusive.");
	switch (index) {
		case 0:
			return this.H;
		case 1:
			return this.S;
		case 2:
			return this.V;
	}
};

HsvColor.prototype.ColorType = HsvColor;

HsvColor.prototype.toString = function() {
	return this.toRgb().toString();
};

HsvColor.blend = function(from, to, ratio) {
	if (ratio <= 0)
		return from;
	if (ratio >= 1)
		return to;

	var h = from.H + ratio * (to.H - from.H);
	var s = from.S + ratio * (to.S - from.S);
	var v = from.V + ratio * (to.V - from.V);

	return new HsvColor(h, s, v);
};

HsvColor.random = function() {
	return new HsvColor(Math.random(), Math.random(), Math.random());
};

HsvColor.fromAngle = function(degrees, s, v) {

	var radians = degrees / 180 * Math.PI; 

	if (typeof(s) === 'undefined')
		s = 1;
	if (typeof(v) === 'undefined')
		v = 1;

	while (radians < 0) {
		radians += twoPi;
	}
	while (radians > twoPi) {
		radians -= twoPi;
	}

	return new HsvColor(radians / twoPi, s, v);
};

module.exports = HsvColor;