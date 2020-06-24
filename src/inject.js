(function (global, window) {
'use strict';

function load(loader, originals, i, callback) {
	loader.loadImage(originals[i], function (src) {
		callback(i, src);
	});
}

function loadImage(originals, source) {
	var length = originals.length;
	var loader = global.ImageLoader.getInstance(global.jQuery, window);
	
	var urlList = [];
	urlList.length = length;
	
	var l = length;
	function callback(i, src) {
		urlList[i] = src;
		if (!--l) {
			source.postMessage({
				type: 'sd-loaded',
				urlList: urlList
			}, window.location.origin);
		}
	}
	for (var i = 0; i < length; i++) {
		load(loader, originals, i, callback);
	}
}

window.addEventListener('message', function (e) {
	if (e.origin == window.location.origin) {
		var data = e.data;
		switch (data.type) {
			case 'sd-load-image':
			loadImage(data.originals, e.source);
			break;
		}
	}
}, false);

})(this, window);
