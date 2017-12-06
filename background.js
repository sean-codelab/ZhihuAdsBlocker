var count = 0
var disabled = false;

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	console.log("Request from frontend:");
	console.log(request);
	var responsePayload = {};
	if(request.getAdBlockerDisabled != null) {
		responsePayload["AdBlockerDisabled"] = disabled;
	}
	if(request.refreshCount != null && request.refreshCount === true) {
		if(!disabled) {
			chrome.browserAction.setBadgeText({text: ""});
		}
		count = 0;
	}
	if(!disabled && request.numOfBlockers != null) {
		count += request.numOfBlockers;
		if(count > 0) {
			chrome.browserAction.setBadgeText({text: count.toString()});
		}
	}
	if(Object.keys(responsePayload).length > 0) {
		console.log("Payload to frontend:");
		console.log(responsePayload);
		sendResponse(responsePayload);
	}
});

// When clicking on the icon, plugin will be enabled/disabled
chrome.browserAction.onClicked.addListener(function() {
	if(disabled) {
		chrome.browserAction.setBadgeText({text: ""});
		count = 0;
		disabled = false;
	}
	else {
		chrome.browserAction.setBadgeText({text: "OFF"});
		disabled = true;
	}
});

blockUser = function(info) {
	if(disabled) {
		return;
	}

	url = info.linkUrl;
	httpsHeader = "https://www.zhihu.com"
	userName = undefined;

	// User link must follow this pattern: */people/{username} or */org/{username}
	if(url.startsWith(httpsHeader)) {
		urlSplit = url.split('/');
		if(urlSplit.length >= 2 && (urlSplit[urlSplit.length - 2] === "people" || urlSplit[urlSplit.length - 2] === "org")) {
			userName = urlSplit[urlSplit.length - 1];
		}
	}

	if(userName) {
		var blockRequest = new XMLHttpRequest();
		blockRequest.onreadystatechange = function(result) {
			console.log(result);
		};
		blockRequest.open("POST", "https://www.zhihu.com/api/v4/members/" + userName + "/actions/block", true);
		blockRequest.send(null);
	}
};

var blockVoters = function(info) {

}

// Add "Block User" menu item to right click menu when there's not one
// Remove "Block User" menu item when locating to other pages
var blockUserMenuItemID = undefined;
var blockVotersMenuItemID = undefined;

chrome.tabs.onActivated.addListener(function(activeInfo) {
	chrome.tabs.getSelected(activeInfo.windowId, function(tab) { 
		if(!disabled && (tab.url.startsWith("https://www.zhihu.com/"))) {
			if(!blockUserMenuItemID) {
				blockUserMenuItemID = chrome.contextMenus.create({
					title: "Block this user",
					contexts: ["link"],
					onclick: blockUser
				});
			}
			if(!blockVotersMenuItemID) {
				blockVotersMenuItemID = chrome.contextMenus.create({
					title: "Block these voters",
					contexts: ["selection"],
					onclick: blockVoters
				});
			}
		}
		else {
			if(blockUserMenuItemID) {
				chrome.contextMenus.remove(blockUserMenuItemID);
				blockUserMenuItemID = undefined;
			}
			if(blockVotersMenuItemID) {
				chrome.contextMenus.remove(blockVotersMenuItemID);
				blockVotersMenuItemID = undefined;
			}
		}
	})
});
