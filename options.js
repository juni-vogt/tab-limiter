const browser = chrome || browser

const tabQuery = (options, params = {}) => new Promise(res => {
	if (!options.countPinnedTabs) params.pinned = false // only non-pinned tabs
	browser.tabs.query(params, tabs => res(tabs))
})

const windowRemaining = options =>
	tabQuery(options, { currentWindow: true })
		.then(tabs => options.maxWindow - tabs.length)

const totalRemaining = options =>
	tabQuery(options)
		.then(tabs => options.maxTotal - tabs.length)

const updateBadge = options => {
	if (!options.displayBadge) {
		browser.browserAction.setBadgeText({ text: "" })
		return;
	}

	Promise.all([windowRemaining(options), totalRemaining(options)])
	.then(remaining => {
		// console.log(remaining)
		// remaining = [remainingInWindow, remainingInTotal]
		browser.browserAction.setBadgeText({
			text: Math.min(...remaining).toString()
		})
	})
}

// ----------------------------------------------------------------------------

let $inputs;



// Saves options to browser.storage
const saveOptions = () => {

	const values = {};

	for (let i = 0; i < $inputs.length; i++) {
		const input = $inputs[i];

		const value =
			input.type === "checkbox" ?
			input.checked :

			input.value;

		values[input.id] = value;
	}

	const options = values;

	browser.storage.sync.set(options, () => {

		// Update status to let user know options were saved.
		const status = document.getElementById('status');
		status.className = 'notice';
		status.textContent = 'Options saved.';
		setTimeout(() => {
			status.className += ' invisible';
		}, 100);


		updateBadge(options)
	});
}

// Restores select box and checkbox state using the preferences
// stored in browser.storage.
const restoreOptions = () => {
	browser.storage.sync.get("defaultOptions", (defaults) => {
		browser.storage.sync.get(defaults.defaultOptions, (options) => {

			for (let i = 0; i < $inputs.length; i++) {
				const input = $inputs[i];

				const valueType =
					input.type === "checkbox" ?
					"checked" :
					"value";

				input[valueType] = options[input.id];
			};
		});
	});
}

document.addEventListener('DOMContentLoaded', () => {
	restoreOptions();

	$inputs = document.querySelectorAll('#options input');

	const onChangeInputs =
		document.querySelectorAll('#options [type="checkbox"], #options [type="number"]');
	const onKeyupInputs =
		document.querySelectorAll('#options [type="text"], #options [type="number"]');

	for (let i = 0; i < onChangeInputs.length; i++) {
		onChangeInputs[i].addEventListener('change', saveOptions);
	}
	for (let i = 0; i < onKeyupInputs.length; i++) {
		onKeyupInputs[i].addEventListener('keyup', saveOptions);
	}


	// show special message

	if (!localStorage.getItem('readMessage') && (new Date() < new Date('09-20-2020'))) {
		document.querySelector('.message').classList.remove('hidden')
		setTimeout(() => {
			localStorage.setItem('readMessage', true)
		}, 2000);
	}
});




