(function (global, _) {
'use strict';

var Object = global.Object;
var Promise = global.Promise;
var Blob = global.Blob;
var FileReader = global.FileReader;
var fetch = global.fetch;

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

var options = (function () {
	
	var DEF = {};
	DEF[KEYS.FILENAME] = (
		'seiga/?member-id? ?member-name?/' +
		'?illust-id? ?title?'
	);
	DEF[KEYS.DIRNAME] = (
		'seiga/?member-id? ?member-name?/' +
		'?manga-id? ?manga-title?/?illust-id? ?title?'
	);
	DEF[KEYS.CAPTION_DL] = true;
	DEF[KEYS.CAPTION_TXT] = (
		'?title?\n?manga-title?\n?member-name?\n?tags?' +
		'\n\n?caption-html?'
	);
	
	function Options() {
		this.current = null;
	}
	var prototype = Options.prototype;
	
	prototype.DEF = DEF;
	
	prototype._get = function () {
		var self = this;
		return new Promise(function (resolve, reject) {
			local.get({'options': DEF}, function (items) {
				var error = _.runtime.lastError;
				if (error != null) {
					reject(error);
					return;
				}
				self.current = items.options;
				resolve(self.current);
			});
		});
	};
	
	prototype.get = function () {
		if (this.current != null) {
			return Promise.resolve(this.current);
		}
		return this._get();
	};
	
	prototype.set = function (options) {
		var self = this;
		return new Promise(function (resolve, reject) {
			local.set({'options': options}, function () {
				var error = _.runtime.lastError;
				if (error != null) {
					reject(error);
					return;
				}
				resolve(self._get());
			});
		});
	};
	
	return new Options();
})();

var history = (function () {
	
	var SPACE = ' ';
	
	function History() {
		this._dict = null;
		this._diff = [];
		this._diffLoaded = false;
		
		this._error = null;
		this._queue = null;
	}
	var prototype = History.prototype;
	
	prototype._load = function () {
		var self = this;
		var items = ['history'];
		if (!this._diffLoaded) {
			items[items.length] = 'diff';
		}
		local.get(items, function (items) {
			var error = _.runtime.lastError;
			self._init(items, error);
			
			if (error != null) {
				global.console.warn('_load', error.message);
			}
		});
	};
	
	prototype._save = function (dict) {
		var d = dict != null ? dict : this._dict;
		return new Promise(function (resolve, reject) {
			local.set({
				'history': Object.keys(d),
				'diff': null
			}, function () {
				var error = _.runtime.lastError;
				if (error != null) {
					reject(error);
					
					global.console.warn('_save', error.message);
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
	
	prototype._init = function (items, error) {
		this._dict = Object.create(null);
		this._error = error;
		if (error != null) {
			this._update(false);
		} else {
			var diff = items['diff'];
			if (diff != null) {
				this._diff = this._diff.concat(diff);
			}
			this._diffLoaded = true;
			var history = items['history'];
			if (history != null) {
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
		
		if (this._diffLoaded) {
			local.set({'diff': this._diff});
		} else {
			var copy = this._diff.slice();
			var self = this;
			local.get(['diff'], function (items) {
				var diff = items['diff'];
				if (diff != null) {
					self._diff = diff.concat(copy);
				}
				self._diffLoaded = true;
				local.set({'diff': self._diff});
			});
		}
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
			self._diffLoaded = true;
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
	return options.get().then(function (options) {
		return new Promise(function (resolve) {
			_.tabs.sendMessage(sender.tab.id, {
				type: 'replace',
				text: options[textKey],
				safe: safe
			}, resolve);
		});
	});
}

function getExt(url) {
	return fetch(url, {method: 'HEAD'}).then(function (response) {
		return new Promise(function (resolve, reject) {
			try {
				var mime = response.headers.get('Content-Type')
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
		});
	});
}

function getURL(url) {
	return fetch(url).then(function (response) {
		return response.text();
	}).then(function (text) {
		return new Promise(function (resolve, reject) {
			try {
				var src = SRC.exec(text)[1];
				resolve(src.startsWith('/priv/') ? LOHAS + src : src);
			} catch (e) {
				reject(e);
			}
		});
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
	return options.get().then(function (options) {
		if (!options[KEYS.CAPTION_DL]) {
			return;
		}
		var p_text = replace(KEYS.CAPTION_TXT, false, sender);
		
		return Promise.all([p_filename, p_text]).then(function (values) {
			var filename = values[0], text = values[1];
			
			var blob = new Blob([
				'\uFEFF', text.replace(EOL, '\r\n')
			]);
			return new Promise(function (resolve, reject) {
				var reader = new FileReader();
				reader.onload = function () {
					resolve(this.result);
				};
				reader.onerror = function (error) {
					reject(error);
				};
				reader.readAsDataURL(blob);
			}).then(function (url) {
				return downloadAsync(url, filename + '.txt');
			});
		});
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
		
		global.console.warn('download', [url, id, version], reason && reason.message);
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
		var all = Promise.all(downloads);
		if (fails.length) {
			return new Promise(function (resolve) {
				var tabId = sender.tab.id;
				if (tabId in createdToOpener) {
					tabId = createdToOpener[tabId];
				}
				_.tabs.sendMessage(tabId, {
					type: 'alert',
					message: fails.join(', ') + ' ページ目は欠落します。'
				}, resolve);
			}).then(function () {
				return all;
			});
		} else {
			return all;
		}
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
			
			global.console.warn('download-mg', [urlList, id, version], reason && reason.message);
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

_.contextMenus.onClicked.addListener(function (info, tab) {
	switch (info.menuItemId) {
		case 'download':
		onclick_download(info.linkUrl, tab);
		break;
	}
});

_.runtime.onInstalled.addListener(function () {
	local.get(['contextmenu'], function (items) {
		contextmenu(items['contextmenu']);
	});
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
		
		case 'options-get':
		options.get().then(function (options) {
			sendResponse(options);
		});
		return true;
		
		case 'options-set':
		options.set(request.options).then(function () {
			sendResponse();
		});
		return true;
		
		case 'options-default':
		sendResponse(options.DEF);
		return;
		
		case 'load':
		return history.getValue(sendResponse);
		
		case 'save':
		return history.setValue(request.value, sendResponse);
		
		case 'contextmenu':
		contextmenu(request.create, sendResponse);
		return true;
	}
});

})(this, chrome);
