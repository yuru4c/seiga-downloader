(function (global, window, _) {
'use strict';

var Object = global.Object;
var Promise = global.Promise;
var Blob = global.Blob;
var URL = global.URL;
var XHR = global.XMLHttpRequest;

var storage = global.localStorage;
var local = _.storage.local;

var KEYS = {
	FILENAME: 'filename_setting',
	DIRNAME:  'mg_dirname_setting',
	CAPTION_DL:  'caption_dl',
	CAPTION_TXT: 'caption_txt'
};

var LOHAS = 'https://lohas.nicoseiga.jp';

var EXT = /^image\/(\w+)/;
var SRC = /data-src="(.*?)"/;
var EOL = /\n|\r\n/g;

function reset(flag) {
	if (flag || storage.getItem(KEYS.FILENAME) == null) {
		storage.setItem(KEYS.FILENAME,
			'seiga/?member-id? ?member-name?/' +
			'?illust-id? ?title?');
	}
	if (flag || storage.getItem(KEYS.DIRNAME) == null) {
		storage.setItem(KEYS.DIRNAME,
			'seiga/?member-id? ?member-name?/' +
			'?manga-id? ?manga-title?/?illust-id? ?title?');
	}
	if (flag || storage.getItem(KEYS.CAPTION_DL) == null) {
		storage.setItem(KEYS.CAPTION_DL, '1');
	}
	if (flag || storage.getItem(KEYS.CAPTION_TXT) == null) {
		storage.setItem(KEYS.CAPTION_TXT,
			'?title?\n?manga-title?\n?member-name?\n?tags?' +
			'\n\n?caption-html?');
	}
}

var history = (function () {
	
	var KEY = 'history.';
	var LENGTH = KEY + 'length';
	var DIFF = 'diff';
	
	var SPACE = ' ';
	
	function History() {
		this._dict = null;
		var item = storage.getItem(DIFF);
		this._diff = item ? item.split(SPACE) : [];
		
		this._error = null;
		this._queue = null;
	}
	var prototype = History.prototype;
	
	prototype.save = function () {
		storage.setItem(DIFF, this._diff.join(SPACE));
	};
	
	prototype._load = function () {
		var self = this;
		local.get(["history"], function (items) {
			var error = _.runtime.lastError;
			self._init(items, error);
			
			if (error != null) {
				window.console.warn('_load', error.message);
			}
		});
	};
	
	prototype._save = function (dict) {
		var d = dict != null ? dict : this._dict;
		return new Promise(function (resolve, reject) {
			local.set({"history": Object.keys(d)}, function () {
				var error = _.runtime.lastError;
				if (error != null) {
					reject(error);
					
					window.console.warn('_save', error.message);
				} else {
					resolve();
				}
			});
		});
	};
	
	prototype._update = function (save) {
		var diff = this._diff;
		if (diff.length > 0) {
			this._putAll(diff);
			if (save == false) return;
			
			var newDiff = this._diff = [];
			var promise = this._save();
			var self = this;
			promise.then(null, function (reason) {
				if (self._diff == newDiff) {
					self._diff = diff.concat(newDiff);
				}
			});
			return promise;
		} else if (save) {
			return this._save();
		}
	};
	
	prototype._loadStorage = function () {
		var length = ~~storage.getItem(LENGTH);
		for (var i = 0; i < length; i++) {
			var value = storage.getItem(KEY + i);
			if (value) {
				this._putAll(value.split(SPACE));
			}
		}
		this._update(true).then(function () {
			storage.removeItem(LENGTH);
			for (var i = 0; i < length; i++) {
				storage.removeItem(KEY + i);
			}
		});
	};
	
	prototype._init = function (items, error) {
		this._dict = Object.create(null);
		this._error = error;
		if (error != null) {
			this._update(false);
		} else {
			var history = items["history"];
			if (history == null) {
				this._loadStorage();
			} else {
				this._putAll(history);
				this._update();
			}
		}
		for (var i = 0; i < this._queue.length; i++) {
			this._queue[i].exec(this);
		}
		this._queue = null;
	};
	
	prototype._call = function (arg) {
		if (this._dict == null) {
			if (this._queue == null) {
				this._queue = [arg];
				this._load();
			} else {
				this._queue.push(arg);
			}
			return true;
		}
		arg.exec(this);
	};
	
	prototype._test = function (id) {
		return id in this._dict;
	};
	prototype._putAll = function (history) {
		for (var i = 0; i < history.length; i++) {
			this._dict[history[i]] = true;
		}
	};
	
	prototype.put = function (id) {
		if (this._dict != null) {
			this._dict[id] = true;
		}
		this._diff.push(id);
	};
	
	prototype.test = function (id, sendResponse) {
		return this._call(new Test(id, sendResponse));
	};
	prototype.list = function (idList, sendResponse) {
		return this._call(new List(idList, sendResponse));
	};
	
	prototype.getValue = function (sendResponse) {
		return this._call(new GetValue(sendResponse));
	};
	prototype.setValue = function (value, sendResponse) {
		var dict = Object.create(null);
		if (value) {
			var history = value.split(SPACE);
			for (var i = 0; i < history.length; i++) {
				var id = history[i];
				if (id) {
					dict[id] = true;
				}
			}
		}
		var self = this;
		this._save(dict).then(function () {
			self._dict = dict;
			self._diff = [];
			sendResponse();
		}, function (reason) {
			sendResponse(reason);
		});
		return true;
	};
	
	function Test(id, callback) {
		this.id = id;
		this.callback = callback;
	}
	Test.prototype.exec = function (history) {
		this.callback(history._test(this.id));
	};
	
	function List(idList, callback) {
		this.idList = idList;
		this.callback = callback;
	}
	List.prototype.exec = function (history) {
		var list = [];
		list.length = this.idList.length;
		for (var i = 0; i < list.length; i++) {
			list[i] = history._test(this.idList[i]);
		}
		this.callback(list);
	};
	
	function GetValue(callback) {
		this.callback = callback;
	}
	GetValue.prototype.exec = function (history) {
		var result = {value: Object.keys(history._dict).join(SPACE)};
		var error = history._error;
		if (error != null) {
			result.error = error;
		}
		this.callback(result);
	};
	
	return new History();
})();


function replace(textKey, safe, sender) {
	return new Promise(function (resolve) {
		_.tabs.sendMessage(sender.tab.id, {
			type: 'replace',
			text: storage.getItem(textKey),
			safe: safe
		}, resolve);
	});
}

function setErrorHandler(xhr, reject) {
	xhr.ontimeout = xhr.onerror = xhr.onabort = reject;
}

function getExt(url) {
	return new Promise(function (resolve, reject) {
		var xhr = new XHR();
		xhr.open('HEAD', url);
		xhr.onload = function () {
			try {
				var mime = this.getResponseHeader('Content-Type');
				switch (mime) {
					case 'image/jpeg':
					resolve('.jpg');
					return;
					case 'image/null':
					resolve('.webp');
					return;
				}
				var ext = EXT.exec(mime);
				if (ext != null) {
					resolve('.' + ext[1]);
					return;
				}
			} catch (e) {
				reject(e);
			}
			reject();
		};
		setErrorHandler(xhr, reject);
		xhr.send();
	});
}

function getURL(url) {
	return new Promise(function (resolve, reject) {
		var xhr = new XHR();
		xhr.open('GET', url);
		xhr.onload = function () {
			try {
				var src = SRC.exec(this.responseText)[1];
				resolve(src.startsWith('/priv/') ? LOHAS + src : src);
			} catch (e) {
				reject(e);
			}
		};
		setErrorHandler(xhr, reject);
		xhr.send();
	});
}

function downloadAsync(url, filename) {
	return new Promise(function (resolve, reject) {
		_.downloads.download({
			url: url,
			filename: filename
		}, function (downloadId) {
			var error = _.runtime.lastError;
			if (error != null) {
				reject(error);
			} else {
				resolve(downloadId);
			}
		});
	});
}


function downloadText(p_filename, sender) {
	if (!+storage.getItem(KEYS.CAPTION_DL)) {
		return Promise.resolve();
	}
	var p_text = replace(KEYS.CAPTION_TXT, false, sender);
	
	return Promise.all([p_filename, p_text]).then(function (values) {
		var filename = values[0], text = values[1];
		
		var url = URL.createObjectURL(new Blob([
			'\uFEFF', text.replace(EOL, '\r\n')
		]));
		return downloadAsync(url, filename + '.txt');
	});
}

function downloadMain(p_url, sender) {
	var p_filename = replace(KEYS.FILENAME, true, sender);
	var p_ext = p_url.then(getExt);
	
	return downloadText(p_filename, sender).then(function () {
		return Promise.all([p_url, p_filename, p_ext]);
	}).then(function (values) {
		var url = values[0];
		var filename = values[1], ext = values[2];
		
		return downloadAsync(url, filename + ext);
	});
}

function download(url, id, version, sender, sendResponse) {
	var p_url;
	switch (version) {
		case 1:
		p_url = getURL(url);
		break;
		
		default:
		p_url = Promise.resolve(url);
		break;
	}
	downloadMain(p_url, sender).then(function () {
		history.put(id);
		done(sender, id);
		sendResponse();
	}, function (reason) {
		done(sender);
		sendResponse(reason || true);
		
		window.console.warn('download', [url, id, version], reason && reason.message);
	});
}


function downloadMgMain(p_dirname, filename, url) {
	var p_ext = getExt(url);
	return Promise.all([p_dirname, p_ext]).then(function (values) {
		var dirname = values[0], ext = values[1];
		
		return downloadAsync(url, dirname + '/' + filename + ext);
	});
}

function downloadMg(urlList, id, version, sender, sendResponse) {
	var p_dirname = replace(KEYS.DIRNAME, true, sender);
	
	var promise = version ?
		downloadText(p_dirname, sender) :
		Promise.resolve();
	promise.then(function () {
		var downloads = [];
		var fails = [];
		for (var i = 0; i < urlList.length; i++) {
			var url = urlList[i];
			if (url == null) {
				fails.push(i + 1);
			} else {
				var filename = (version ? '' : 's ') + (i + 1);
				downloads[i] = downloadMgMain(p_dirname, filename, url);
			}
		}
		if (fails.length) {
			window.alert(fails.join(', ') + ' ページ目は欠落します。');
		}
		return Promise.all(downloads);
	}).then(function () {
		history.put(id);
		done(sender, id);
		sendResponse();
	}, function (reason) {
		var response = reason || true;
		if (version) {
			sendResponse(response);
		} else {
			done(sender);
			sendResponse(response);
			
			window.console.warn('download-mg', [urlList, id, version], reason && reason.message);
		}
	});
}


var createdToOpener = Object.create(null);

function test(request, sender, sendResponse) {
	if (sender.tab.id in createdToOpener) {
		sendResponse(null);
	} else {
		return history.test(request.id, sendResponse);
	}
}
function list(request, sender, sendResponse) {
	if (sender.tab.id in createdToOpener) {
		sendResponse(null);
	} else {
		return history.list(request.idList, sendResponse);
	}
}

function done(sender, loadedId) {
	var tabId = sender.tab.id;
	if (tabId in createdToOpener) {
		_.tabs.remove(tabId);
		if (loadedId != null) {
			_.tabs.sendMessage(createdToOpener[tabId], {
				type: 'loaded', id: loadedId
			});
		}
		delete createdToOpener[tabId];
	}
}


function contextmenu(create, callback) {
	if (create) {
		_.contextMenus.create({
			title: 'ダウンロード',
			id: 'download',
			contexts: ['link'],
			documentUrlPatterns: [
				'*://seiga.nicovideo.jp/*'
			],
			targetUrlPatterns: [
				'*://seiga.nicovideo.jp/seiga/im*',
				'*://seiga.nicovideo.jp/watch/mg*'
			]
		}, callback);
	} else {
		_.contextMenus.removeAll(callback);
	}
}

function onclick_download(linkUrl, tab) {
	_.tabs.create({
		url: linkUrl, openerTabId: tab.id, active: false
	}, function (newTab) {
		createdToOpener[newTab.id] = tab.id;
	});
}


window.onunload = function () {
	history.save();
};

_.contextMenus.onClicked.addListener(function (info, tab) {
	switch (info.menuItemId) {
		case 'download':
		onclick_download(info.linkUrl, tab);
		break;
	}
});

_.runtime.onInstalled.addListener(function () {
	reset(false);
	contextmenu(+storage.getItem('contextmenu'));
});

_.runtime.onMessage.addListener(function (request, sender, sendResponse) {
	switch (request.type) {
		case 'test':
		return test(request, sender, sendResponse);
		
		case 'list':
		return list(request, sender, sendResponse);
		
		case 'download':
		download(
			request.url, request.id, request.version,
			sender, sendResponse
		);
		return true;
		
		case 'download-mg':
		downloadMg(
			request.urlList, request.id, request.version,
			sender, sendResponse
		);
		return true;
		
		case 'reset':
		reset(true);
		sendResponse();
		break;
		
		case 'load':
		return history.getValue(sendResponse);
		
		case 'save':
		return history.setValue(request.value, sendResponse);
		
		case 'contextmenu':
		contextmenu(request.create, sendResponse);
		return true;
	}
});

})(this, window, chrome);
