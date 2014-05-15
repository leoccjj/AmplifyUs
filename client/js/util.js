function RGBAColor(r, g, b, alpha) {
	this.r = r;
	this.g = g;
	this.b = b;
	this.alpha = alpha;
}

RGBAColor.prototype.setFromHSV = function(h, s, v, alpha) {

	h = h % 360;

	if (h < 0) {
		h += 360;
	}

	var c = v * s;
	var h1 = h / 60;
	var x = c * (1 - Math.abs(h1%2 - 1));
	var r1 = 0, g1 = 0, b1 = 0;

	switch (Math.floor(h1)) {
		case 0: r1 = c; g1 = x; b1 = 0; break;
		case 1: r1 = x; g1 = c; b1 = 0; break;
		case 2: r1 = 0; g1 = c; b1 = x; break;
		case 3: r1 = 0; g1 = x; b1 = c; break;
		case 4: r1 = x; g1 = 0; b1 = c; break;
		case 5: r1 = c; g1 = 0; b1 = x; break;
	}

	var m = v - c;

	this.r = Math.floor((r1 + m) * 255);
	this.g = Math.floor((g1 + m) * 255);
	this.b = Math.floor((b1 + m) * 255);
	this.alpha = alpha;
	
};

RGBAColor.prototype.setRGBA = function(r, g, b, alpha) {
	this.r = r;
	this.g = g;
	this.b = b;
	this.alpha = alpha;
};

function square(n) {
	return n*n;
}

function rad_to_deg(angle) {
	return angle * 180 / Math.PI;
};

function map(x, a1, a2, b1, b2) {
	return b1 + ( x - a1 ) * ( b2 - b1 ) / ( a2 - a1 );
};
