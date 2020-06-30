(function (global, chrome, window, $) {
'use strict';

var storage = global.localStorage;
var runtime = chrome.runtime;

var MENU = 'contextmenu';

var KEY = 'history.';
var LENGTH = KEY + 'length';

var inputs = {
	'filename_setting':   null,
	'mg_dirname_setting': null,
	'caption_dl':  null,
	'caption_txt': null
};

function size() {
	return ~~storage.getItem(LENGTH);
}

function create(i) {
	var textarea = $.createElement('textarea');
	textarea.rows = 40;
	if (i != null) {
		var value = storage.getItem(KEY + i);
		if (value != null) {
			textarea.value = value;
		}
	}
	return textarea;
}

$.addEventListener('DOMContentLoaded', function () {
	var reset = $.getElementById('reset');
	var save  = $.getElementById('save');
	
	function load() {
		for (var id in inputs) {
			var input = inputs[id];
			switch (input.type) {
				case 'checkbox':
				input.checked = +storage.getItem(id);
				break;
				
				default:
				input.value = storage.getItem(id);
				break;
			}
		}
		save.disabled = true;
	}
	function enable() {
		save.disabled = reset.disabled = false;
	}
	
	for (var id in inputs) {
		var input = $.getElementById(id);
		switch (input.type) {
			case 'checkbox':
			input.onclick = enable;
			break;
			
			default:
			input.oninput = enable;
			break;
		}
		inputs[id] = input;
	}
	load();
	
	reset.onclick = function () {
		if (window.confirm('設定をリセットしますか？')) {
			this.disabled = true;
			runtime.sendMessage({type: 'reset'}, load);
		}
	};
	
	save.onclick = function () {
		for (var id in inputs) {
			var input = inputs[id];
			switch (input.type) {
				case 'checkbox':
				storage.setItem(id, +input.checked);
				break;
				
				default:
				storage.setItem(id, input.value);
				break;
			}
		}
		this.disabled = true;
	};
	
	
	var enabled = +storage.getItem(MENU);
	var check  = $.getElementById('check');
	var button = $.getElementById('contextmenu');
	
	function set() {
		check.checked = enabled;
		button.value = enabled ? '無効化' : '有効化';
		button.disabled = false;
	}
	set();
	
	button.onclick = function () {
		this.disabled = true;
		var not = !enabled;
		runtime.sendMessage({
			type: 'contextmenu', create: not
		}, function () {
			enabled = +not;
			storage.setItem(MENU, enabled);
			set();
		});
	};
	
	
	var container = $.getElementById('history_container');
	var historyLoad = $.getElementById('history_load');
	var historySave = $.getElementById('history_save');
	
	var textareas = [];
	function saved() {
		var length = size();
		textareas.length = length;
		
		container.textContent = '';
		textareas[0] = container.appendChild(
			length ? create(0) : create()
		);
		for (var i = 1; i < length; i++) {
			textareas[i] = container.appendChild(create(i));
		}
		
		historyLoad.disabled = false;
		historySave.disabled = false;
	}
	function loaded() {
		historySave.disabled = false;
	}
	
	historyLoad.onclick = function () {
		this.disabled = true;
		runtime.sendMessage({type: 'save'}, saved);
	};
	
	historySave.onclick = function () {
		try {
			var i;
			for (i = size() - 1; i >= textareas.length; i--) {
				storage.removeItem(KEY + i);
			}
			storage.setItem(LENGTH, textareas.length);
			
			for (i = 0; i < textareas.length; i++) {
				storage.setItem(KEY + i, textareas[i].value);
			}
		} catch (e) {
			window.alert(e);
			return;
		}
		this.disabled = true;
		runtime.sendMessage({type: 'load'}, loaded);
	};
	
}, false);

})(this, chrome, window, document);
