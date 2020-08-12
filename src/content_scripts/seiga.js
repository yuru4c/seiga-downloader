(function (global, chrome, window, $) {
'use strict';

var Object  = global.Object;
var runtime = chrome.runtime;

var SEIGA = 'http://seiga.nicovideo.jp';
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

function download(url, version) {
	runtime.sendMessage({
		type: 'download', id: id, url: url, version: version
	}, function (response) {
		if (!response) {
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


var Old = (function () {
	
	var REPLACE = /\?(.+?)\?/g;
	var UNSAFE  = /\\|\/|:|\*|\?|"|<|>|\||\.|~/g;
	
	function Old() { }
	var prototype = Old.prototype;
	
	Old.main = function () {
		var t = new this();
		if (!t.init()) {
			try {
				t.addLink();
			} catch (e) { return; }
			instance = t;
		}
	};
	
	prototype._VERSION = 0;
	prototype._data = null;
	
	prototype._state = State.READY;
	prototype._div = null;
	
	prototype._getImageURL = function () {
		var element = $.querySelector('#illust_main_top a:eq(1)');
		return SEIGA + '/' + element.getAttribute('href');
	};
	
	prototype._getImageTitle = function () {
		var element = $.querySelector('div.title_text');
		return element.textContent.trim();
	};
	prototype._getImageCreator = function () {
		var element = $.querySelector('.illust_user_name strong');
		return element == null ? NO.NAME : element.textContent.trim();
	};
	prototype._getImageCreatorId = function () {
		var element = $.querySelector('.illust_user_name a');
		return element == null ? NO.ID : filename(element);
	};
	
	
	prototype.init = function () {
		this._data = Object.create(null);
		try {
			this._data['member-name'] = this._getImageCreator();
			this._data['member-id']   = this._getImageCreatorId();
			this._data['title']       = this._getImageTitle();
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
		switch (group) {
			case 'illust-id':
			return id;
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
			download(this._getImageURL(), this._VERSION);
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
		var parent = $.querySelector('#illust_main_top td td');
		parent.insertBefore(this._createLink(), parent.firstChild);
	};
	
	return Old;
})();

var SD = (function (Base) {
	var base = Base.prototype;
	var prototype = new Base;
	
	var NOT_D = /\D+/;
	
	function SD() { }
	SD.prototype = prototype;
	
	SD.main = Base.main;
	
	prototype._VERSION = 1;
	
	prototype._getImageURL = function () {
		var element = $.getElementById('illust_link');
		return element.href;
	};
	
	prototype._getImageTitle = function () {
		var element = $.querySelector('h1.title');
		return element.textContent.trim();
	};
	prototype._getImageCreator = function () {
		var element = $.querySelector('.user_name strong');
		return element == null ? NO.NAME : element.textContent.trim();
	};
	prototype._getImageCreatorId = function () {
		var element = $.querySelector('.user_name a');
		return element == null ? NO.ID : filename(element);
	};
	
	
	prototype._getCreatedDate = function (i) {
		var element = $.querySelector('#detail .created');
		return element.textContent.split(NOT_D)[i];
	};
	prototype._getDiscription = function (html) {
		var element = $.querySelector('#detail .discription');
		return (html ? element.innerHTML : element.textContent).trim();
	};
	prototype._getTags = function () {
		var elements = $.querySelectorAll('#detail .illust_tag:first-child .tag');
		var tags = [];
		tags.length = elements.length;
		for (var i = 0; i < tags.length; i++) {
			tags[i] = elements[i].textContent.trim();
		}
		return tags.join(' ');
	};
	
	prototype.getReplacement = function (group) {
		try {
			switch (group) {
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
		return base.getReplacement.call(this, group);
	};
	
	
	prototype.addLink = function () {
		var parent = $.querySelector('.thum_large');
		parent.insertBefore(this._createLink(), parent.firstChild);
	};
	
	return SD;
})(Old);


$.addEventListener('DOMContentLoaded', function () {
	SD.main();
	if (instance == null) Old.main();
	
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
