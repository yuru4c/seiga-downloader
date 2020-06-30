(function (global, chrome, window, $) {
'use strict';

var Object  = global.Object;
var runtime = chrome.runtime;

var NO = {NAME: 'null', ID: '0'};

var LAST = /[^\/]*$/;
function filename(url) {
	return LAST.exec(url.pathname)[0];
}
var id = filename($.location);


var instance;
var silent, flag, complete = false;

runtime.sendMessage({type: 'test', id: id}, function (response) {
	silent = response == null;
	if (silent) {
		flag = false;
		if (complete) {
			instance.onclick();
		}
	} else {
		flag = response;
		if (instance != null) {
			instance.update();
		}
	}
});

runtime.onMessage.addListener(function (request, sender, sendResponse) {
	switch (request.type) {
		case 'replace':
		sendResponse(instance.replace(request.text, request.safe));
		break;
	}
});

function download(urls, version) {
	runtime.sendMessage({
		type: 'download-mg', id: id, urlList: urls.urlList, version: version
	}, function (response) {
		if (response) {
			if (version) {
				window.postMessage({
					type: 'sd-load-image', originals: urls.originals
				}, window.location.origin);
				return;
			}
		} else {
			flag = true;
		}
		instance.onload(response);
	});
}


var State = (function () {
	
	function State(name) {
		this.name = name;
	}
	var prototype = State.prototype;
	
	State.READY   = new State('ready');
	State.LOADING = new State('loading');
	State.FAILED  = new State('failed');
	
	prototype.confirm = function () {
		switch (this) {
			case State.LOADING: return false;
		}
		return !flag || window.confirm(
			'既に保存済みのファイルです。再度ダウンロードを行いますか？'
		);
	};
	
	prototype.toString = function () {
		return this.name;
	};
	
	State.READY.toString = function () {
		return flag ? 'loaded' : this.name;
	};
	
	return State;
})();


var SD = (function () {
	
	var REPLACE = /\?(.+?)\?/g;
	var UNSAFE  = /\\|\/|:|\*|\?|"|<|>|\|/g;
	
	var SRC = 'https://seiga.nicovideo.jp/image/source/';
	var NOT_D = /\D+/;
	var USER_ID = /user_id=(\d+)/;
	
	function SD() { }
	var prototype = SD.prototype;
	
	SD.main = function () {
		var t = new this();
		if (!t.init()) {
			try {
				t.addLink();
			} catch (e) { return; }
			instance = t;
		}
	};
	
	prototype._VERSION = 1;
	prototype._data = null;
	prototype._urls = null;
	
	prototype._state = State.READY;
	prototype._div = null;
	
	prototype._getImageURLs = function () {
		var pages = $.querySelectorAll('#page_contents .page');
		var urls = [], originals = [];
		originals.length = urls.length = pages.length;
		
		for (var i = 0; i < urls.length; i++) {
			var img = pages[i].querySelector('img[data-image-id]');
			if (img == null) continue;
			
			urls[i] = SRC + img.getAttribute('data-image-id');
			originals[i] = img.getAttribute('data-original');
		}
		return {urlList: urls, originals: originals};
	};
	
	prototype._getMangaTitle = function () {
		var element = $.querySelector('#detail .manga_title');
		return element.textContent.trim();
	};
	prototype._getMangaId = function () {
		var element = $.querySelector('#detail .manga_title a');
		return filename(element);
	};
	
	prototype._getImageTitle = function () {
		var element = $.querySelector('#detail .episode_title');
		return element.textContent.trim();
	};
	prototype._getImageCreator = function () {
		var element = $.querySelector('#detail .user_name strong');
		return element == null ? NO.NAME : element.textContent.trim();
	};
	prototype._getImageCreatorId = function () {
		var element = $.querySelector('#detail .user_name a');
		if (element == null) return NO.ID;
		var queries = element.search.split('&');
		for (var i = 0; i < queries.length; i++) {
			var match = USER_ID.exec(queries[i]);
			if (match != null) {
				return match[1];
			}
		}
	};
	
	prototype._getCreatedDate = function (i) {
		var element = $.querySelector('#detail .created');
		return element.textContent.split(NOT_D)[i];
	};
	prototype._getDiscription = function (html) {
		var element = $.querySelector('#detail .description .full');
		return (html ? element.innerHTML : element.textContent).trim();
	};
	prototype._getTags = function () {
		var elements = $.querySelectorAll('#ko_taglist .manga_tag:first-child .tag');
		var tags = [];
		tags.length = elements.length;
		for (var i = 0; i < tags.length; i++) {
			tags[i] = elements[i].textContent.trim();
		}
		return tags.join(' ');
	};
	
	
	prototype.init = function () {
		this._data = Object.create(null);
		try {
			this._data['member-name'] = this._getImageCreator();
			this._data['member-id']   = this._getImageCreatorId();
			this._data['title']       = this._getImageTitle();
			this._urls = this._getImageURLs();
		} catch (e) {
			return true;
		}
		for (var group in this._data) {
			if (this._data[group] == null) {
				return true;
			}
		}
	};
	
	prototype.getReplacement = function (group) {
		try {
			switch (group) {
				case 'manga-title':
				return this._getMangaTitle();
				
				case 'manga-id':
				return this._getMangaId();
				
				case 'illust-id':
				return id;
				
				case 'illust-year':
				return this._getCreatedDate(0);
				
				case 'illust-month':
				return this._getCreatedDate(1);
				
				case 'illust-day':
				return this._getCreatedDate(2);
				
				case 'illust-hour':
				return this._getCreatedDate(3);
				
				case 'illust-minute':
				return this._getCreatedDate(4);
				
				case 'caption':
				return this._getDiscription(false);
				
				case 'caption-html':
				return this._getDiscription(true);
				
				case 'tags':
				return this._getTags();
			}
		} catch (e) {
			return null;
		}
		return this._data[group];
	};
	
	prototype.replace = function (text, safe) {
		var self = this;
		return text.replace(REPLACE, function (match, group) {
			var substr = self.getReplacement(group);
			return substr == null ? '' :
				safe ? substr.replace(UNSAFE, '_') : substr;
		});
	};
	
	
	prototype.update = function () {
		this._div.className = 'sd-' + this._state;
	};
	
	prototype.onload = function (response) {
		this._state = response ? State.FAILED : State.READY;
		this.update();
	};
	
	prototype.onclick = function () {
		if (this._state.confirm()) {
			this._state = State.LOADING;
			this.update();
			download(this._urls, this._VERSION);
		}
	};
	
	prototype._createLink = function () {
		var self = this;
		var span = $.createElement('span');
		
		var a = $.createElement('a');
		a.onclick = function () {
			self.onclick();
		};
		a.appendChild(span);
		
		var div = $.createElement('div');
		div.id = 'SD';
		div.appendChild(a);
		
		this._div = div;
		return div;
	};
	
	prototype.addLink = function () {
		var parent = $.getElementById('ko_content_list');
		parent.insertBefore(this._createLink(), parent.firstChild);
	};
	
	return SD;
})();

function sdLoaded(urlList) {
	download({urlList: urlList}, 0);
}


window.addEventListener('message', function (e) {
	if (e.origin == window.location.origin) {
		var data = e.data;
		switch (data.type) {
			case 'sd-loaded':
			sdLoaded(data.urlList);
			break;
		}
	}
}, false);

$.addEventListener('DOMContentLoaded', function () {
	var script = this.createElement('script');
	script.type = 'text/javascript';
	script.src = runtime.getURL('inject.js');
	this.head.appendChild(script);
	
	SD.main();
	
	if (!silent && flag != null) {
		instance.update();
	}
}, false);

window.addEventListener('load', function () {
	complete = true;
	
	if (silent && flag != null) {
		instance.onclick();
	}
}, false);

})(this, chrome, window, document);
