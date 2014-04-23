// Includes algorithms from Iñigo Quilez
// http://www.iquilezles.org/www/articles/functions/functions.htm

// Includes code from Processing.js (MIT)
// https://github.com/jeresig/processing-js/

// Includes code from d3.js (BSD)
// https://github.com/mbostock/d3

// ToDo: Most of the below could benefit from having some unit tests in place!

var util = exports = module.exports = {};
var _ 	 = require('underscore');

var startTime = new Date().getTime() / 1000;
var currentRandom = Math.random;

util.clamp = function(x, min, max) {
	return Math.min( Math.max(x,min), max );
};

util.map = function(x, a1, a2, b1, b2) {
	return b1 + ( x - a1 ) * ( b2 - b1 ) / ( a2 - a1 );
};

util.normalize = function(x, min, max) {
	return (x - min) / (max - min)
};

util.linear_interpolate = function(x, y, amt) {
	return (y - x) * amt + x;
};

// Smoothstep interpolates between min and max, smoothing out the values as they
// leave min and approach max.
util.smoothstep = function(x, min, max) {

	if ( x <= min ) return 0.0;
	if ( x >= max ) return 1.0;

	x = ( x - min )/( max - min );

	return x * x * (3 - 2 * x);

};

// Blends a value X (via a cubic polynomial) with the threshhold M (since it's too small for us)
// until it reaches M. Anything above M stays unchanged and N is returned when X == 0;
util.almost_identity = function(x, m, n) {

	if (x > m) return x;

	var a = 2.0 * n - m
	var b = 2.0 * m - 3.0 * n;
	var t = x/m;

	return (a * t + b) * t * t + n;

};

// Envelope generator: grows fast and slowly decays. K controls the stretch.
// The maximum 1.0 happens at x = 1/k.
util.impulse = function(k, x) {

	var h = k * x;
	return h * Math.exp(1.0 - h);

};

// Cubic smoothstep via (smoothstep(c-w,c,x) - smoothstep(c,c+w,x)). Gaussian replacement.
util.cubic_pulse = function(c, x, w) {

	x = Math.abs(x - c);

	if (x > w) return 0.0;

	x /= w;

	return 1.0 - x * x * (3.0 - 2.0 * x);

};

util.rgb_to_hsb = function(rgb) {

	var hsb = {};
	hsb.b = Math.max(Math.max(rgb.r,rgb.g),rgb.b);
	hsb.s = (hsb.b <= 0) ? 0 : Math.round(100*(hsb.b - Math.min(Math.min(rgb.r,rgb.g),rgb.b))/hsb.b);
	hsb.b = Math.round((hsb.b /255)*100);

	if((rgb.r==rgb.g) && (rgb.g==rgb.b)) hsb.h = 0;
	else if(rgb.r>=rgb.g && rgb.g>=rgb.b) hsb.h = 60*(rgb.g-rgb.b)/(rgb.r-rgb.b);
	else if(rgb.g>=rgb.r && rgb.r>=rgb.b) hsb.h = 60 + 60*(rgb.g-rgb.r)/(rgb.g-rgb.b);
	else if(rgb.g>=rgb.b && rgb.b>=rgb.r) hsb.h = 120 + 60*(rgb.b-rgb.r)/(rgb.g-rgb.r);
	else if(rgb.b>=rgb.g && rgb.g>=rgb.r) hsb.h = 180 + 60*(rgb.b-rgb.g)/(rgb.b-rgb.r);
	else if(rgb.b>=rgb.r && rgb.r>=rgb.g) hsb.h = 240 + 60*(rgb.r-rgb.g)/(rgb.b-rgb.g);
	else if(rgb.r>=rgb.b && rgb.b>=rgb.g) hsb.h = 300 + 60*(rgb.r-rgb.b)/(rgb.r-rgb.g);
	else hsb.h = 0;

	hsb.h = Math.round(hsb.h);

	return hsb;

};

util.hsb_to_rgb = function(hsb) {

	var rgb = {};
	var h = Math.round(hsb.h);
	var s = Math.round(hsb.s*255/100);
	var v = Math.round(hsb.b*255/100);

	if(s == 0) {
		rgb.r = rgb.g = rgb.b = v;
	} else {
		var t1 = v;
		var t2 = (255-s)*v/255;
		var t3 = (t1-t2)*(h%60)/60;
		if(h==360) h = 0;
		if(h<60) {rgb.r=t1;	rgb.b=t2; rgb.g=t2+t3}
		else if(h<120) {rgb.g=t1; rgb.b=t2;	rgb.r=t1-t3}
		else if(h<180) {rgb.g=t1; rgb.r=t2;	rgb.b=t2+t3}
		else if(h<240) {rgb.b=t1; rgb.r=t2;	rgb.g=t1-t3}
		else if(h<300) {rgb.b=t1; rgb.g=t2;	rgb.r=t2+t3}
		else if(h<360) {rgb.r=t1; rgb.g=t2;	rgb.b=t1-t3}
		else {rgb.r=0; rgb.g=0;	rgb.b=0}
	}

	return {r:Math.round(rgb.r), g:Math.round(rgb.g), b:Math.round(rgb.b)};
};

util.rgb_to_hex = function(rgb) {

	function componentToHex(c) {
    	var hex = c.toString(16);
   		return hex.length == 1 ? "0" + hex : hex;
	}

	return "#" + componentToHex(rgb.r) + componentToHex(rgb.g) + componentToHex(rgb.b);

};

util.hex_to_rgb = function(hex) {
	return {r: (hex & 0xFF0000) >> 16, g: (hex & 0x00FF00) >> 8, b: (hex & 0x0000FF)};
};

util.random_rgb = function() {
	return {r: util.random_integer(0, 255), g: util.random_integer(0, 255), b: util.random_integer(0, 255)};
};

util.random_string = function(bits) {

	var chars, rand, i, ret;

	chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
	ret = '';

	// in v8, Math.random() yields 32 pseudo-random bits (in spidermonkey it gives 53)
	while (bits > 0) {

		// 32-bit integer
		rand = Math.floor(Math.random() * 0x100000000);

		// base 64 means 6 bits per character, so we use the top 30 bits from rand to give 30/6=5 characters.
		for (i = 26; i > 0 && bits > 0; i -= 6, bits -= 6) {
			ret += chars[0x3F & rand >>> i];
		}

	}

	return ret;

};

util.random_float = function(min, max) {
	return min + Math.random() * ( max - min );
};

util.random_float_normalized = function() {
	return ( 65280 * Math.random() + 255 * Math.random() ) / 65535;
};

util.sign = function (x) {
	return ( x < 0 ) ? -1 : ( ( x > 0 ) ? 1 : 0 );
};

util.random_integer = function(min, max) {
	return min + Math.floor( Math.random() * ( max - min + 1 ) );
};

util.deg_to_rad = function(angle) {
	return angle / 180 * Math.PI
};

util.rad_to_deg = function(angle) {
	return angle * 180 / Math.PI
};

util.in_range = function(x, min, max) {
	return x >= min && x <= max;
};

util.flatten_object = function(x) {

	var toReturn = {};

	for (var i in x) {
		if (!x.hasOwnProperty(i)) continue;

		if ((typeof x[i]) == 'object') {
			var flatObject = flattenObject(x[i]);
			for (var x in flatObject) {
				if (!flatObject.hasOwnProperty(x)) continue;

				toReturn[i + '.' + x] = flatObject[x];
			}
		} else {
			toReturn[i] = x[i];
		}
	}
	return toReturn;

};

util.find_property = function(property, object) {

	if (property) {

		var result = undefined;

		function r(obj) {

			if (obj) {
				for (var key in obj) {
					if (typeof obj[key] == "object"){
						r(obj[key]);
					}
					else if (typeof obj[key] != "function") {
						if (obj[key] == property) {
							result = obj;
						}
					}
				}
			}
		};

		r(object);

		return result;

	} else {
		return undefined;
	}

};

util.quantile = function(values, p) {

	var H = (values.length - 1) * p + 1,
	h = Math.floor(H),
	v = values[h - 1],
	e = H - h;
	return e ? v + e * (values[h] - v) : v;

};

util.mean = function(array, f) {

	var n = array.length,
	a,
	m = 0,
	i = -1,
	j = 0;
	if (arguments.length === 1) {
		while (++i < n) if (isNumber(a = array[i])) m += (a - m) / ++j;
	} else {
		while (++i < n) if (isNumber(a = f.call(array, array[i], i))) m += (a - m) / ++j;
	}
	return j ? m : undefined;

};

util.median = function(array, f) {

	if (arguments.length > 1) array = array.map(f);
	array = array.filter(isNumber);
	return array.length ? util.quantile(array.sort(ascending), .5) : undefined;

};

util.min = function(array, f) {

	var i = -1,
	n = array.length,
	a,
	b;
	if (arguments.length === 1) {
		while (++i < n && ((a = array[i]) == null || a != a)) a = undefined;
		while (++i < n) if ((b = array[i]) != null && a > b) a = b;
	} else {
		while (++i < n && ((a = f.call(array, array[i], i)) == null || a != a)) a = undefined;
		while (++i < n) if ((b = f.call(array, array[i], i)) != null && a > b) a = b;
	}
	return a;

};

util.max = function(array, f) {

	var i = -1,
	n = array.length,
	a,
	b;
	if (arguments.length === 1) {
		while (++i < n && ((a = array[i]) == null || a != a)) a = undefined;
		while (++i < n) if ((b = array[i]) != null && b > a) a = b;
	} else {
		while (++i < n && ((a = f.call(array, array[i], i)) == null || a != a)) a = undefined;
		while (++i < n) if ((b = f.call(array, array[i], i)) != null && b > a) a = b;
	}
	return a;

};

util.elapsed_time_millis = function() {
	var markTime = new Date().getTime() / 1000;
	return markTime - startTime;
};

function isNumber(x) {
	return x != null && !isNaN(x);
}

function ascending (a, b) {
	return a < b ? -1 : a > b ? 1 : 0;
}

function descending (a, b) {
	return b < a ? -1 : b > a ? 1 : 0;
}
