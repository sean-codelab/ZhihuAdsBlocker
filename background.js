var disabled = false;
var blockCount = {};

var removeBadgeText = function() {
	chrome.browserAction.setBadgeText({text: ""});
}

var setBadgeText = function(count) {
	if(count > 0) {
		chrome.browserAction.setBadgeText({text: count.toString()});
	}
	else {
		removeBadgeText();
	}
}

var disabledBadgeText = function() {
	chrome.browserAction.setBadgeText({text: "OFF"});
}

// Message handlers
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	var tabId = sender.tab.id;
	var responsePayload = {};
	if(request.getAdBlockerDisabled !== undefined) {
		responsePayload["AdBlockerDisabled"] = disabled;
		responsePayload["removedXPaths"] = removedXPaths;
		responsePayload["hiddenXPaths"] = customizedHiddenXPaths;
	}
	if(!disabled && request.numOfBlockers != undefined) {
		if(!blockCount.hasOwnProperty(tabId)) {
			blockCount[tabId] = 0;
		}
		blockCount[tabId] += request.numOfBlockers;
		chrome.tabs.query({active: true, currentWindow: true}, function(tabs) { 
			if(tabs.length != 1) {
				return;
			}
			var current_tab = tabs[0];
			if(current_tab.id === tabId) {
				setBadgeText(blockCount[tabId]);
			}
		});
	}
	if(Object.keys(responsePayload).length > 0) {
		sendResponse(responsePayload);
	}
});

// When clicking on the icon, plugin will be enabled/disabled
chrome.browserAction.onClicked.addListener(function() {
	if(disabled) {
		removeBadgeText();
		disabled = false;
		forceUpdateAllTabs();
		updateCountForCurrentTab();
	}
	else {
		disabledBadgeText();
		disabled = true;
		forceUpdateAllTabs();
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
		blockUserID(userId, 3);
	}
};

// Given a user ID, block this user
var blockUserID = function(userId, retry) {
	if(retry <= 0) {
		console.log("ERROR: Running out of retry attempts.");
		chrome.tabs.query({active: true, currentWindow: true}, function(tabs) { 
			chrome.tabs.sendMessage(tabs[0].id, {failToBlock: true, blockUserId: userId}, function(response) {});
		});
		return;
	}

	processBlackList(userId, function() {
		var blockRequest = new XMLHttpRequest();
		blockRequest.onreadystatechange = function(result) {
			if(blockRequest.readyState == XMLHttpRequest.DONE) {
				if(blockRequest.status == 204) {
					console.log("Blocking succeeded.");
					chrome.tabs.query({active: true, currentWindow: true}, function(tabs) { 
						if(typeof(tabs) !== 'undefined' && tabs[0] !== undefined && tabs[0].id !== undefined) {
							chrome.tabs.sendMessage(tabs[0].id, {blockUserId: userId}, function(response) {});
						}
					});
				}
				else {
					console.log("ERROR: Blocking failed!\nRetry " + (retry - 1) + " more times.");
					blockUserID(userId, retry - 1);
				}
			}
		};
		blockRequest.open("POST", "https://www.zhihu.com/api/v4/members/" + userId + "/actions/block", true);
		blockRequest.send(null);
	});
}

// When upvote count is not available, we need to fetch 20 voters every time until it runs out of results
// Guarantee the sequential execution of voter fetch
var fetchMoreVoters = true;
// When results are running out, fetch is over
var fetchIsOver = false;

// Add this answer to my collection for tracking
var addToFavList = function(answerId, isAnswer) {
	var url_add_to_favList = "https://www.zhihu.com/api/v4/favlists/" + collectionId + "/items";
	var addRequest = new XMLHttpRequest();
	addRequest.onreadystatechange = function(result) {
		if(addRequest.readyState === XMLHttpRequest.DONE) {
			if(addRequest.status === 200) {
				// Pass
			}
			else {
				console.log("Error: fail to add to favList.");
				console.log(result);
			}
		}
	};
	addRequest.open("POST", url_add_to_favList, true);
	addRequest.send(JSON.stringify({
		"content_id": answerId,
		"content_type": isAnswer ? "answer" : "article"
	}));
}

// Collect user IDs that has voted for the given answer ID
// The GET response has a limit of 20 user IDs
var getAndBlockVoters = function(offset, answerId, isAnswer) {
	console.log("Current offset is " + offset);

	fetchMoreVoters = false;
	var url = "https://www.zhihu.com/api/v4/answers/" + answerId + "/voters?limit=20&offset=" + offset;
	var url_article = "https://www.zhihu.com/api/v4/articles/" + answerId + "/likers?limit=20&offset=" + offset;

	var blockRequest = new XMLHttpRequest();
	blockRequest.onreadystatechange = function(result) {
		if(blockRequest.readyState === XMLHttpRequest.DONE) {
			var voters = JSON.parse(blockRequest.responseText);
			voters = voters.data;
			if(voters.length < 20) {
				console.log("Stop fetching more voters.");
				fetchIsOver = true;
			}
			for(let voter of voters) {
				var peopleId = voter.url_token;
				// Skip anonymous users
				if(peopleId.length > 0) {
					console.log("Block this user: " + peopleId);
					blockUserID(peopleId, 3);
				}
			}
			fetchMoreVoters = true;
		}
	};
	blockRequest.open("GET", isAnswer? url : url_article, true);
	blockRequest.send(null);
}

// Inefficient way to fetch voters for scenarios when vote count is missing
var loopExecute = function(funcCall) {
	var intervalId = setInterval(function() {
		if(fetchIsOver === true) {
			clearInterval(intervalId);
			fetchIsOver = false;
		}
		else if(fetchMoreVoters === true) {
			funcCall();
		}
	}, 100);
}

// Block the voters of a given answer
var blockVoters = function(info) {
	if(disabled) {
		return;
	}

	// Selection text should not contain link
	// If there's valid linkUrl, it is likely that user was right clicking a link, which brings up two menu items
	// In this case, if user clicks "Block these voters", he's more likely to block a user, not a group of voters
	// Therefore, it redirects to blockUser()
	if(info.linkUrl !== undefined) {
		console.log(info.linkUrl);
		blockUser(info);
		return;
	}

	selection = info.selectionText;
	// Let current active tab to look for answer ID
	chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
		chrome.tabs.sendMessage(tabs[0].id, {selectionText: selection}, function(response) {
			if(response.answerId === undefined) {
				console.log("Frontend failed to give back answer ID or upvote count.");
			}
			else {
				addToFavList(response.answerId, response.isAnswer);
				if(response.upvoteCount === undefined) {
					console.log("AnswerId: " + response.answerId);
					offset = 0;
					loopExecute(function() {
						getAndBlockVoters(offset, response.answerId, response.isAnswer);
						offset += 20;
					});
				}
				else {
					console.log("AnswerId: " + response.answerId + "; UpvoteCount: " + response.upvoteCount);
					offset = 0;
					while(offset < response.upvoteCount) {
						getAndBlockVoters(offset, response.answerId, response.isAnswer);
						offset += 20;
					}
				}
			}
		});
	});
}

// Add "Block User" menu item to right click menu when there's not one
// Remove "Block User" menu item when locating to other pages
// Right clicking user name will trigger both "Block user" and "Block voters" context menus, and the later one will not be functional
var blockUserMenuItemID = undefined;
var blockVotersMenuItemID = undefined;

var removeMenuItems = function() {
	if(blockUserMenuItemID) {
		chrome.contextMenus.remove(blockUserMenuItemID);
		blockUserMenuItemID = undefined;
	}
	if(blockVotersMenuItemID) {
		chrome.contextMenus.remove(blockVotersMenuItemID);
		blockVotersMenuItemID = undefined;
	}
}

var customizedHiddenXPaths = hiddenXPaths.concat(orgPostsXPaths);

chrome.contextMenus.create({
	type: "checkbox",
	checked: true,
	title: "Block posts from certified org accounts",
	contexts: ["browser_action"],
	onclick: function(info, tab) {
		var isChecked = info.checked;
		// Block org posts
		if(isChecked) {
			customizedHiddenXPaths = hiddenXPaths.concat(orgPostsXPaths);
		}
		else {
			customizedHiddenXPaths = hiddenXPaths;
		}
		forceUpdateAllTabs();
	}
});

var isValidZhihuUrl = function(url) {
	if(url !== undefined && url.startsWith("https://")) {
		url = url.substring(8);
		urlSplit = url.split('.');
		if(urlSplit.length >= 3 && (urlSplit[1] === "zhihu" && urlSplit[2].startsWith("com/"))) {
			return true;
		}
	}
	return false;
}

// Force all zhihu.com tabs to query background.js
var forceUpdateAllTabs = function() {
	chrome.tabs.query({}, function(tabs) {
		for(let tab of tabs) {
			if(isValidZhihuUrl(tab.url)) {
				chrome.tabs.sendMessage(tab.id, {forceUpdate: true}, function(response) {});
			}
		}
	});
}

var clearBlackList = function() {
	chrome.storage.local.clear(function() {
		console.log("Offline blacklist has been cleared.");
	});
}

var processBlackList = function(userId, callback) {
	chrome.storage.local.get(userId, function(items) {
		// userId is not found
		if(Object.keys(items).length === 0) {
			console.log(userId + " is going to be pushed to offline blacklist.");
			pushToBlackList(userId, callback);
		}
		else {
			console.log(userId + " is already in offline blacklist.");
		}
	});
}

var pushToBlackList = function(userId, callback) {
	var pair = {}
	pair[userId] = true;
	chrome.storage.local.set(pair, function() {
		callback();
	});
}

// Display number of blocks for the given tab
// Enable/disable right click menu items
var uponRevisit = function(tab) {
	if(isValidZhihuUrl(tab.url)) {
		if(!disabled) {
			setBadgeText(blockCount[tab.id]);
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
			disabledBadgeText();
			removeMenuItems();
		}
	}
	else {
		removeBadgeText();
		removeMenuItems();
	}
}

var updateCountForCurrentTab = function() {
	chrome.tabs.query({active: true, currentWindow: true}, function(tabs) { 
		if(tabs.length != 1) {
			return;
		}
		var tab = tabs[0];
		uponRevisit(tab);
	});
}

chrome.tabs.onActivated.addListener(function(activeInfo) {
	updateCountForCurrentTab();
});

// Remove binding block counts
chrome.tabs.onRemoved.addListener(function(tabId) {
	delete blockCount[tabId];
});

// URL change / Refresh detected. Flush the blocking count.
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
	// Block count is cleared when loading
	if(changeInfo.status !== undefined && changeInfo.status === "loading") {
		chrome.tabs.query({active: true, currentWindow: true}, function(tabs) { 
			if(tabs.length != 1) {
				return;
			}
			blockCount[tab.id] = 0;
			var current_tab = tabs[0];
			if(current_tab.id === tabId) {
				uponRevisit(tab);
			}
		});
	}
});
