(function (global, window, $, _) {
'use strict';

var storage = global.localStorage;

var MENU = 'contextmenu';

var inputs = {
	'filename_setting':   null,
	'mg_dirname_setting': null,
	'caption_dl':  null,
	'caption_txt': null
};

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
			_.runtime.sendMessage({type: 'reset'}, load);
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
		_.runtime.sendMessage({
			type: 'contextmenu', create: not
		}, function () {
			enabled = +not;
			storage.setItem(MENU, enabled);
			set();
		});
	};
	
	
	var historyText = $.getElementById('history_text');
	var historyLoad = $.getElementById('history_load');
	var historySave = $.getElementById('history_save');
	
	function setDisabled(disabled) {
		historyText.disabled = disabled;
		historyLoad.disabled = disabled;
		historySave.disabled = disabled;
	}
	
	function saved(response) {
		if (response != null) {
			window.alert('保存時にエラーが発生しました\n\n' + response.message);
		}
		setDisabled(false);
	}
	function loaded(response) {
		var error = response.error;
		if (error != null) {
			window.alert('読み込み時にエラーが発生しました\n\n' + error.message);
		}
		historyText.value = response.value;
		setDisabled(false);
	}
	
	historyLoad.onclick = function () {
		setDisabled(true);
		historyText.className = '';
		_.runtime.sendMessage({type: 'load'}, loaded);
	};
	
	historySave.onclick = function () {
		setDisabled(true);
		_.runtime.sendMessage({
			type: 'save',
			value: historyText.value
		}, saved);
	};
	
}, false);

})(this, window, document, chrome);
