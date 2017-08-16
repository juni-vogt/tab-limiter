const tabs = options => new Promise((resolve, reject) => {
	const queryFactory = params => new Promise((resolve, reject) =>
		chrome.tabs.query(params, tabs => resolve(tabs.length)))

	const allWindowsTabsLength = queryFactory({
		pinned: false
	})

	const currentWindowTabsLength = queryFactory({
		currentWindow: true,
		pinned: false
	})

	resolve(Object.assign(options, {
		allWindowsTabsLength: allWindowsTabsLength,
		currentWindowTabsLength: currentWindowTabsLength,
	}))
})


const updateBadge = options => new Promise((resolve, reject) => {

	const setBadge = max => length => {
		count = max - length
		chrome.browserAction.setBadgeText({
			text: count.toString()
		})
	}

	if (options.displayBadge) {
		options.currentWindowTabsLength.then(setBadge(options.maxWindow))
	} else {
		setBadge("")
	}

	resolve(options)
})

const windowTabs = options => new Promise(function(resolve, reject) {
	chrome.tabs.query({
		currentWindow: true,
		pinned: false
	}, function(tabs) {
		if (tabs.length > options.maxWindow) {
			resolve("window");
		}
	});
});

const totalTabs = options => new Promise(function(resolve, reject) {
	chrome.tabs.query({
		pinned: false
	}, function(tabs) {
		// Minimum of 1 allowed tab to prevent breaking chrome
		if (tabs.length > Math.max(options.maxTotal, 1)) {
			resolve("total");
		}
	});
});

const sync = () => new Promise(function(resolve, reject) {
	chrome.storage.sync.get("defaultOptions", function(defaults) {
		chrome.storage.sync.get(defaults.defaultOptions, function(options) {
			resolve(options);
		})
	})
})

const displayAlert = (options, which) => new Promise(function(resolve, reject) {
	if (!options.displayAlert) { return resolve(false) }

	const replacer = (match, p1, offset, string) => {
		switch (p1) {
			case "which":
				return which === "window" ?
					"one window" : "total";
				break;

			case "maxWhich":
				return options[
					"max" + capitalizeFirstLetter(which)
				];
				break;

			default:
				return options[p1] || "?";
		}
	};

	const renderedMessage = options.alertMessage.replace(/{\s*(\S+)\s*}/g, replacer)
	alert(renderedMessage);
})

const handleTabCreated = tab => options => {
	return Promise.race([windowTabs(options), totalTabs(options)]).then(function(which) {
		displayAlert(options, which)
		chrome.tabs.remove(tab.id);
	});
}

const app = {
	init: function() {
		chrome.storage.sync.set({
			defaultOptions: {
				maxTotal: 50,
				maxWindow: 20,
				displayAlert: true,
				displayBadge: false,
				alertMessage: "You decided not to open more than { maxWhich } tabs in { which }"
			}
		});

		chrome.tabs.onCreated.addListener(tab => sync().then(handleTabCreated(tab)))

		// Fill the current tabs
		const load = () => sync().then(tabs).then(updateBadge)
		load()

		// Update Badge when tab is removed
		chrome.tabs.onCreated.addListener(load)

		// Update Badge when tab is deleted
		chrome.tabs.onRemoved.addListener(load)
	}
};

app.init();

function capitalizeFirstLetter(string) {
	return string[0].toUpperCase() + string.slice(1);
}
