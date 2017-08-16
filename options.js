var inputs;

const windowRemaining = options => new Promise((resolve, reject) => {
	chrome.tabs.query({
		currentWindow: true,
		pinned: false
	}, tabs => resolve(options.maxWindow - tabs.length));
});
const totalRemaining = options => new Promise((resolve, reject) => {
	chrome.tabs.query({
		pinned: false
	}, tabs => resolve(options.maxTotal - tabs.length));
});

const updateBadge = options => {
	if (options.displayBadge) {
		Promise.all([windowRemaining(options), totalRemaining(options)]).then(remaining => {
			chrome.browserAction.setBadgeText({
				text: Math.min(...remaining).toString()
			})
		})
	} else {
		chrome.browserAction.setBadgeText({ text: "" })
	}
}

// Saves options to chrome.storage
var saveOptions = function() {

	var values = {};

	for (var i = 0; i < inputs.length; i++) {
		var input = inputs[i];

		var value =
			input.type === "checkbox" ?
			input.checked :

			input.value;

		values[input.id] = value;
	}

	const options = values;

	chrome.storage.sync.set(options, function() {

		// Update status to let user know options were saved.
		var status = document.getElementById('status');
		status.className = 'notice';
		status.textContent = 'Options saved.';
		setTimeout(function() {
			status.className += ' invisible';
		}, 100);


		updateBadge(options)
	});
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
var restoreOptions = function() {
	chrome.storage.sync.get("defaultOptions", function(defaults) {
		chrome.storage.sync.get(defaults.defaultOptions, function(options) {

			for (var i = 0; i < inputs.length; i++) {
				var input = inputs[i];

				var valueType =
					input.type === "checkbox" ?
					"checked" :
					"value";

				input[valueType] = options[input.id];
			};
		});
	});
}

document.addEventListener('DOMContentLoaded', function() {
	restoreOptions();

	inputs = document.querySelectorAll('#options input');

	var onChangeInputs =
		document.querySelectorAll('#options [type="checkbox"], #options [type="number"]');
	var onKeyupInputs =
		document.querySelectorAll('#options [type="text"], #options [type="number"]');

	for (var i = 0; i < onChangeInputs.length; i++) {
		onChangeInputs[i].addEventListener('change', saveOptions);
	}
	for (var i = 0; i < onKeyupInputs.length; i++) {
		onKeyupInputs[i].addEventListener('keyup', saveOptions);
	}


	// show special message

	if (!localStorage.getItem('readMessage') && (new Date() < new Date('09-16-2017'))) {
		document.querySelector('.message').classList.remove('hidden')
		setTimeout(() => {
			localStorage.setItem('readMessage', true)
		}, 2000);
	}
});




