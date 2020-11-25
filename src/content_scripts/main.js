(function ($, _) {
'use strict';

var RE = /^\/seiga\/(im\d+)|^\/watch\/(mg\d+)/;

function anchorOf(element) {
	if (element == null || element.tagName == 'A') {
		return element;
	}
	return anchorOf(element.parentNode);
}

function Item(element) {
	this.element = element;
	this.loaded = false;
}
Item.prototype.setState = function (loaded) {
	if (this.loaded) return;
	if (loaded) {
		this.element.className += ' sd-downloaded';
		this.loaded = true;
	}
};

var idList   = [];
var itemList = [];
var length = 0;

var imgs = $.querySelectorAll('a[href] img');
for (var i = 0, l = imgs.length; i < l; i++) {
	var img = imgs[i];
	
	var anchor = anchorOf(img);
	if (anchor == null) continue;
	
	var match = RE.exec(anchor.pathname);
	if (match == null) continue;
	
	var id = match[1];
	if (id) {
		idList  [length] = id;
		itemList[length] = new Item(anchor);
	} else {
		idList  [length] = match[2];
		itemList[length] = new Item(img);
	}
	length++;
}

_.runtime.sendMessage({
	type: 'list', idList: idList
}, function (response) {
	if (response != null) {
		for (var i = 0; i < response.length; i++) {
			itemList[i].setState(response[i]);
		}
	}
});

function loaded(id) {
	for (var i = 0; i < length; i++) {
		if (idList[i] == id) {
			itemList[i].setState(true);
		}
	}
}

_.runtime.onMessage.addListener(function (message) {
	switch (message.type) {
		case 'loaded':
		loaded(message.id);
		break;
	}
});

})(document, chrome);
