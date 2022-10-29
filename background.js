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
		browser.action.setBadgeText({ text: "" })
		return;
	}

	Promise.all([windowRemaining(options), totalRemaining(options)])
	.then(remaining => {
		// console.log(remaining)
		// remaining = [remainingInWindow, remainingInTotal]
		browser.action.setBadgeText({
			text: Math.min(...remaining).toString()
		})
	})
}

// ----------------------------------------------------------------------------


// const annotateOptionsWithTabInfo = options => new Promise((res, rej) => {

// 	const allWindowsTabsLength = queryFactory({
// 		pinned: options.countPinnedTabs
// 	})

// 	const currentWindowTabsLength = queryFactory({
// 		currentWindow: true,
// 		pinned: options.countPinnedTabs
// 	})

// 	res(Object.assign(options, {
// 		allWindowsTabsLength: allWindowsTabsLength,
// 		currentWindowTabsLength: currentWindowTabsLength,
// 	}))
// })

// only resolves if there are too many tabs
const detectTooManyTabsInWindow = options => new Promise(res => {
	tabQuery(options, { currentWindow: true }).then(tabs => {
		// Minimum of 1 allowed tab to prevent breaking browser
		if (options.maxWindow < 1) return;
		if (tabs.length > options.maxWindow) res("window");
	});
})

// only resolves if there are too many tabs
const detectTooManyTabsInTotal = options => new Promise(res => {
	tabQuery(options).then(tabs => {
		// Minimum of 1 allowed tab to prevent breaking browser
		if (options.maxTotal < 1) return;
		if (tabs.length > options.maxTotal) res("total");
	});
})

// get user options from storage
const getOptions = () => new Promise((res, rej) => {
	browser.storage.sync.get("defaultOptions", (defaults) => {
		browser.storage.sync.get(defaults.defaultOptions, (options) => {
			// console.log(options);
			res(options);
		})
	})
})

const displayAlert = (options, place) => new Promise((res, rej) => {
	if (!options.displayAlert) { return res(false) }

	const replacer = (match, p1, offset, string) => {
		switch (p1) {
			case "place":
			case "which": // backwards compatibility
				return place === "window" ?
					"one window" : "total";
				break;

			case "maxPlace":
			case "maxWhich": // backwards compatibility
				return options[
					"max" + capitalizeFirstLetter(place)
				];
				break;

			default:
				return options[p1] || "?";
		}
	};

	const renderedMessage = options.alertMessage.replace(
		/{\s*(\S+)\s*}/g,
		replacer
	)
	alert(renderedMessage);
})

let tabCount = -1
let previousTabCount = -1
let amountOfTabsCreated = -1

// resolves amount of tabs created
const updateTabCount = () => new Promise(res => browser.tabs.query({}, tabs => {
	if (tabs.length == tabCount) {
		// console.log("amount of tabs didn't change")
		// if amount of tabs didn't change, don't update values
		return res(amountOfTabsCreated);
	}

	previousTabCount = tabCount
	tabCount = tabs.length
	amountOfTabsCreated =
		~previousTabCount ? tabCount - previousTabCount : 0
	// console.log(
	// 	"tabCount: ", tabCount,
	// 	" - previousTabCount: ", previousTabCount,
	// 	" - created: ", amountOfTabsCreated
	// )
	res(amountOfTabsCreated)
}))

let passes = 0;

const handleExceedTabs = (tab, options, place) => {
	console.log(place)
	if (options.exceedTabNewWindow && place === "window") {
		browser.windows.create({ tabId: tab.id, focused: true});
	} else {
		browser.tabs.remove(tab.id);
	}
}

const handleTabCreated = tab => options => {
	return Promise.race([
		detectTooManyTabsInWindow(options),
		detectTooManyTabsInTotal(options)
	])
	.then((place) => updateTabCount().then(amountOfTabsCreated => {
		// if this tab gets a pass, don't alert about it or remove it
		if (passes > 0) {
			console.log("passed with pass no. ", passes)
			passes--;
			return;
		}
		console.log("amountOfTabsCreated", amountOfTabsCreated)
		displayAlert(options, place) // alert about opening too many tabs
		if (amountOfTabsCreated === 1) {
			// if exactly one tab was created, remove this tab
			handleExceedTabs(tab, options, place);
			app.update()
		} else if (amountOfTabsCreated > 1) {
			// if more than one tab was created, don't remove the tab and let
			// the other created tabs pass, such that there is no alert for
			// them. More than one tab can be created at once through session
			// restore or by pressing ctrl+shift+t
			passes = amountOfTabsCreated - 1
		} else if (amountOfTabsCreated === -1) {
			// if the users spams ctrl+t to create multiple tabs and one was
			// just removed by this extension, remove the other tabs as well
			handleExceedTabs(tab, options, place);
			app.update()
		} else {
			// should never happen
			throw new Error("weird: multiple tabs closed after tab created")
		}
	}))
}

const app = {
	init: function() {
		browser.storage.sync.set({
			defaultOptions: {
				maxTotal: 50,
				maxWindow: 20,
				exceedTabNewWindow: false,
				displayAlert: true,
				countPinnedTabs: false,
				displayBadge: false,
				alertMessage: "You decided not to open more than {maxPlace} tabs in {place}"
			}
		});

		//
		// Event handlers
		//

		// only add this event listener after startup
		// to prevent restored tabs from being deleted
		browser.tabs.onCreated.addListener(tab =>
			getOptions().then(handleTabCreated(tab))
		)

		console.log("init", this)
		// Update Badge when…
		// …window focus changes
		browser.windows.onFocusChanged.addListener(app.update)
		// …a tab is created
		browser.tabs.onCreated.addListener(app.update)
		// …a tab is deleted
		browser.tabs.onRemoved.addListener(app.update)
		// …a tab is updated
		browser.tabs.onUpdated.addListener(app.update)
	},
	update: () => {
		updateTabCount();
		getOptions().then(updateBadge)
	}
};

app.init();
app.update();

function capitalizeFirstLetter(string) {
	return string[0].toUpperCase() + string.slice(1);
}
