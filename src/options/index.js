(function (global, chrome, window, $) {
'use strict';

var localStorage = global.localStorage;
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
	return ~~localStorage[LENGTH];
}

function create(i) {
	var textarea = $.createElement('textarea');
	textarea.rows = 40;
	if (i != null) {
		var value = localStorage[KEY + i];
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
				input.checked = +localStorage[id];
				break;
				
				default:
				input.value = localStorage[id];
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
	
	reset.addEventListener('click', function () {
		if (window.confirm('設定をリセットしますか？')) {
			this.disabled = true;
			runtime.sendMessage({type: 'reset'}, load);
		}
	}, false);
	
	save.addEventListener('click', function () {
		for (var id in inputs) {
			var input = inputs[id];
			switch (input.type) {
				case 'checkbox':
				localStorage[id] = +input.checked;
				break;
				
				default:
				localStorage[id] = input.value;
				break;
			}
		}
		this.disabled = true;
	}, false);
	
	
	var enabled = +localStorage[MENU];
	var check  = $.getElementById('check');
	var button = $.getElementById('contextmenu');
	
	function set(enabled) {
		check.checked = enabled;
		button.value = enabled ? '無効化' : '有効化';
		button.disabled = false;
	}
	set(enabled);
	
	button.addEventListener('click', function () {
		this.disabled = true;
		var not = !enabled;
		runtime.sendMessage({
			type: 'contextmenu', create: not
		}, function () {
			localStorage[MENU] = enabled = +not;
			set(enabled);
		});
	}, false);
	
	
	var historyContainer = $.getElementById('history_container');
	var historyLoad = $.getElementById('history_load');
	var historySave = $.getElementById('history_save');
	
	var textareas = [];
	function loadHistory() {
		var length = size();
		textareas.length = length;
		
		historyContainer.textContent = '';
		textareas[0] = historyContainer.appendChild(
			length ? create(0) : create()
		);
		for (var i = 1; i < length; i++) {
			textareas[i] = historyContainer.appendChild(create(i));
		}
		
		historyLoad.disabled = false;
		historySave.disabled = false;
	}
	
	historyLoad.addEventListener('click', function () {
		this.disabled = true;
		runtime.sendMessage({type: 'save'}, loadHistory);
	}, false);
	
	historySave.addEventListener('click', function () {
		var i, l = size();
		localStorage[LENGTH] = textareas.length;
		
		for (i = 0; i < textareas.length; i++) {
			localStorage[KEY + i] = textareas[i].value;
		}
		for (; i < l; i++) {
			delete localStorage[KEY + i];
		}
		
		runtime.sendMessage({type: 'load'});
	}, false);
	
}, false);

})(this, chrome, window, document);
