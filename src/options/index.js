(function (global, window, $, _) {
'use strict';

var local = _.storage.local;

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
	
	function load(options) {
		for (var id in inputs) {
			var input = inputs[id];
			switch (input.type) {
				case 'checkbox':
				input.checked = options[id];
				break;
				
				default:
				input.value = options[id];
				break;
			}
		}
	}
	function enable() {
		save.disabled = false;
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
	_.runtime.sendMessage({type: 'options-get'}, function (options) {
		load(options);
		save.disabled = true;
	});
	
	reset.onclick = function () {
		this.disabled = true;
		_.runtime.sendMessage({type: 'options-default'}, function (options) {
			load(options);
			reset.disabled = false;
			save.disabled = false;
		});
	};
	
	save.onclick = function () {
		var options = {};
		for (var id in inputs) {
			var input = inputs[id];
			switch (input.type) {
				case 'checkbox':
				options[id] = input.checked;
				break;
				
				default:
				options[id] = input.value;
				break;
			}
		}
		_.runtime.sendMessage({type: 'options-set', options: options}, function () {
			save.disabled = true;
		});
	};
	
	
	var check  = $.getElementById('check');
	var button = $.getElementById('contextmenu');
	local.get([MENU], function (items) {
		var enabled = !!items[MENU];
		
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
				var items = {};
				items[MENU] = enabled;
				local.set(items, set);
			});
		};
	});
	
	
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
