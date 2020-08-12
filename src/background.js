(function (global, chrome, window) {
'use strict';

var Object = global.Object;
var URL = global.URL;
var XHR = global.XMLHttpRequest;
var Promise = global.Promise;
var Blob    = global.Blob;

var storage = global.localStorage;
var runtime = chrome.runtime;

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
	
	var SPACE = ' ';
	var CHUNK = 1024;
	var VALUE = true;
	
	function History() {
		this.load();
	}
	var prototype = History.prototype;
	
	function size() {
		return ~~storage.getItem(LENGTH);
	}
	function save(i, list) {
		storage.setItem(KEY + i, list.join(SPACE));
	}
	
	prototype.put = function (id) {
		this._dict[id] = VALUE;
	};
	prototype.test = function (id) {
		return id in this._dict;
	};
	prototype.list = function (idList) {
		var list = [];
		list.length = idList.length;
		for (var i = 0; i < list.length; i++) {
			list[i] = this.test(idList[i]);
		}
		return list;
	};
	
	prototype.load = function () {
		var dict = Object.create(null);
		var length = size();
		for (var i = 0; i < length; i++) {
			var value = storage.getItem(KEY + i);
			if (value) {
				var ids = value.split(SPACE);
				for (var j = 0; j < ids.length; j++) {
					dict[ids[j]] = VALUE;
				}
			}
		}
		this._dict = dict;
	};
	prototype.save = function () {
		var i = 0;
		var list = [];
		for (var id in this._dict) {
			if (id) {
				if (list.push(id) == CHUNK) {
					save(i++, list);
					list.length = 0;
				}
			}
		}
		if (list.length) {
			save(i++, list);
		}
		
		for (var j = size() - 1; j >= i; j--) {
			storage.removeItem(KEY + j);
		}
		storage.setItem(LENGTH, i);
	};
	
	return new History();
})();


function replace(textKey, safe, sender) {
	return new Promise(function (resolve) {
		chrome.tabs.sendMessage(sender.tab.id, {
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
		chrome.downloads.download({
			url: url,
			filename: filename
		}, function (downloadId) {
			var error = runtime.lastError;
			if (error == null) {
				resolve(downloadId);
			} else {
				reject(error.message);
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
		
		console.warn('download', [url, id, version], reason);
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
		if (!version) {
			done(sender);
		}
		sendResponse(reason || true);
		
		console.warn('download-mg', [urlList, id, version], reason);
	});
}


var silentTabs = Object.create(null);

function test(request, sender) {
	if (sender.tab.id in silentTabs) {
		return null;
	}
	return history.test(request.id);
}

function done(sender, loadedId) {
	var tabId = sender.tab.id;
	if (tabId in silentTabs) {
		chrome.tabs.remove(tabId);
		if (loadedId != null) {
			chrome.tabs.sendMessage(silentTabs[tabId], {
				type: 'loaded', id: loadedId
			});
		}
		delete silentTabs[tabId];
	}
}


function contextmenu(create, callback) {
	if (create) {
		chrome.contextMenus.create({
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
		chrome.contextMenus.removeAll(callback);
	}
}

function onclick_download(linkUrl, tab) {
	chrome.tabs.create({
		url: linkUrl, openerTabId: tab.id, active: false
	}, function (newTab) {
		silentTabs[newTab.id] = tab.id;
	});
}


window.onunload = function () {
	history.save();
};

chrome.contextMenus.onClicked.addListener(function (info, tab) {
	switch (info.menuItemId) {
		case 'download':
		onclick_download(info.linkUrl, tab);
		break;
	}
});

runtime.onInstalled.addListener(function () {
	reset(false);
	contextmenu(+storage.getItem('contextmenu'));
});

runtime.onMessage.addListener(function (request, sender, sendResponse) {
	switch (request.type) {
		case 'test':
		sendResponse(test(request, sender));
		break;
		
		case 'list':
		sendResponse(history.list(request.idList));
		break;
		
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
		
		case 'save':
		history.save();
		sendResponse();
		break;
		
		case 'load':
		history.load();
		sendResponse();
		break;
		
		case 'contextmenu':
		contextmenu(request.create, sendResponse);
		return true;
	}
});

})(this, chrome, window);
