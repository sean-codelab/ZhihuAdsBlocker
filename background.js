var count = 0;
var disabled = false;

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	var responsePayload = {};
	if(request.getAdBlockerDisabled != null) {
		responsePayload["AdBlockerDisabled"] = disabled;
	}
	if(request.refreshCount != null && request.refreshCount === true) {
		console.log("Refresh detected.");
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

// Block a specific user
var blockUser = function(info) {
	if(disabled) {
		return;
	}

	url = info.linkUrl;
	httpsHeader = "https://www.zhihu.com";
	userId = undefined;

	// User link must follow this pattern: */people/{username} or */org/{username}
	if(url.startsWith(httpsHeader)) {
		urlSplit = url.split('/');
		if(urlSplit.length >= 2 && (urlSplit[urlSplit.length - 2] === "people" || urlSplit[urlSplit.length - 2] === "org")) {
			userId = urlSplit[urlSplit.length - 1];
		}
	}

	if(userId) {
		blockUserID(userId);
	}
};

// Given a user ID, block this user
var blockUserID = function(userId) {
	var blockRequest = new XMLHttpRequest();
	blockRequest.onreadystatechange = function(result) {
		if (blockRequest.readyState == XMLHttpRequest.DONE) {
			if(blockRequest.status == 204) {
				console.log("Blocking succeeded.");
			}
			else {
				console.log("ERROR: Blocking failed!");
			}
		}
	};
	blockRequest.open("POST", "https://www.zhihu.com/api/v4/members/" + userId + "/actions/block", true);
	blockRequest.send(null);
}

// Collect user IDs that has voted for the given answer ID
// The GET response has a limit of 20 user IDs
var getVoters = function(offset, answerId) {
	url = "https://www.zhihu.com/api/v4/answers/" + answerId + "/voters?limit=20&offset=" + offset
	var blockRequest = new XMLHttpRequest();
	blockRequest.onreadystatechange = function(result) {
		if (blockRequest.readyState == XMLHttpRequest.DONE) {
			var voters = JSON.parse(blockRequest.responseText);
			voters = voters.data;
			for(let voter of voters) {
				var peopleId = voter.url_token;
				// Skip anonymous users
				if(peopleId.length > 0) {
					console.log("Block this user: " + peopleId);
					blockUserID(peopleId);
				}
			}
		}
	};
	blockRequest.open("GET", url, true);
	blockRequest.send(null);
}

// Block the voters of a given answer
var blockVoters = function(info) {
	if(disabled) {
		return;
	}

	selection = info.selectionText;
	// Let current active tab to look for answer ID
	chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
		chrome.tabs.sendMessage(tabs[0].id, {selectionText: selection}, function(response) {
			if(typeof response.answerId === undefined || typeof response.upvoteCount === undefined) {
				console.log("Frontend failed to give back answer ID or upvote count.");
			}
			console.log("AnswerId: " + response.answerId + "; UpvoteCount: " + response.upvoteCount);
			offset = 0;
			while(offset < response.upvoteCount) {
				getVoters(offset, response.answerId);
				offset += 20;
			}
		});
	});
}

// Add "Block User" menu item to right click menu when there's not one
// Remove "Block User" menu item when locating to other pages
// Right clicking user name will trigger both "Block user" and "Block voters" context menus, and the later one will not be functional
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
