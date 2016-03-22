var app = {

	handleTabCreated: function(tab) {
		chrome.storage.sync.get("defaultOptions", function(defaults) {
			chrome.storage.sync.get(defaults.defaultOptions, function(options) {

				var windowTabs = new Promise(function(resolve, reject) {
					chrome.tabs.query({
						currentWindow: true,
						pinned: false
					}, function(tabs) {
						if (tabs.length >= options.maxWindow)
							resolve("window");
					});
				});

				var totalTabs = new Promise(function(resolve, reject) {
					chrome.tabs.query({
						pinned: false
					}, function(tabs) {
						if (tabs.length >= Math.max(options.maxTotal, 1))
						// Minimum of 1 allowed tab to prevent breaking chrome
							resolve("total");
					});
				});

				Promise.race([windowTabs, totalTabs]).then(function(which) {
					if (options.displayAlert) {
						var renderedMessage = options.alertMessage.replace(
							/{\s*(\S+)\s*}/g,
							function(match, p1, offset, string) {

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
							}
						);
						alert(renderedMessage);
					}

					chrome.tabs.remove(tab.id);
				});
			});

		});

	},

	init: function() {
		chrome.storage.sync.set({
			defaultOptions: {
				maxTotal: 50,
				maxWindow: 20,
				displayAlert: false,
				alertMessage: "You decided not to open more than { maxWhich } tabs in { which }"
			}
		});

		chrome.tabs.onCreated.addListener(app.handleTabCreated);
	}
};

app.init();


function capitalizeFirstLetter(string) {
	return string[0].toUpperCase() + string.slice(1);
}
