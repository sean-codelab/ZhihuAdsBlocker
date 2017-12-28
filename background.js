var disabled = false;
var blockCount = {};
var debuggingMode = false;

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
		removeMenuItems();
		disabled = true;
		forceUpdateAllTabs();
	}
});

var sendBannerMessage = function(message) {
	chrome.tabs.query({active: true, currentWindow: true}, function(tabs) { 
		if(typeof(tabs) !== 'undefined' && tabs[0] !== undefined && tabs[0].id !== undefined && isValidZhihuUrl(tabs[0].url)) {
			chrome.tabs.sendMessage(tabs[0].id, {showMessage: message}, function(response) {});
		}
	});
}

var blockTid = function(tid, topicName, currentUrl) {
	// Get xsrf token from cookie
	chrome.cookies.get({url: currentUrl, name: '_xsrf'}, function(cookie) {
		var blockRequest = new XMLHttpRequest();
		blockRequest.onreadystatechange = function(result) {
			if(blockRequest.readyState === XMLHttpRequest.DONE) {
				if(blockRequest.status === 200) {
					console.log("Topic has been successfully blocked.");
					sendBannerMessage("Topic " + topicName + " has been successfully blocked.");
				}
				else {
					sendBannerMessage("Error: blocking request of topic " + topicName + " has failed.");
				}
			}
		}
		blockRequest.open("POST", "https://www.zhihu.com/topic/ignore", true);
		blockRequest.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8');
		blockRequest.send("tid=" + tid + "&method=add&_xsrf=" + cookie.value);
	});
}

// To block a topic, we need 2 steps:
// 1. Get tid of a given topicId. This is handled by an autocomplete GET request.
// 2. Block this tid. This is handled by a POST request that needs authentication.
var blockTopic = function(topicName, topicId, currentUrl) {
	if(topicName === undefined || topicId === undefined) {
		sendBannerMessage("Error: topicName/topicId cannot be found.");
		return;
	}

	console.log("Block this topic: " + topicName + "; ID: " + topicId);
	var getTidRequest = new XMLHttpRequest();
	getTidRequest.onreadystatechange = function(result) {
		if(getTidRequest.readyState === XMLHttpRequest.DONE) {
			if(getTidRequest.status === 200) {
				var autoCompleteResult = JSON.parse(getTidRequest.responseText);
				autoCompleteResult = autoCompleteResult[0];
				var found = false;
				for(let res of autoCompleteResult) {
					if(Array.isArray(res) && res.indexOf(topicId) !== -1) {
						var tid = res[4];
						if(tid !== undefined && Number.isInteger(tid)) {
							blockTid(tid, topicName, currentUrl);
							found = true;
						}
						else {
							sendBannerMessage("Error: tid does not exist in the entry of given topic ID.");
						}
					}
				}
				if(!found) {
					sendBannerMessage("Error: cannot find tid from topic name and ID.");
				}
			}
			else {

			}
		}
	}
	getTidRequest.open("GET", "https://www.zhihu.com/topic/autocomplete?token=" + topicName + "&max_matches=10&use_similar=0", true);
	getTidRequest.send(null);
}

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
		// Otherwise, if it is a topic link, block this topic
		else if(urlSplit.length >= 2 && (urlSplit[urlSplit.length - 2] === "topic")) {
			blockTopic(info.selectionText, urlSplit[urlSplit.length - 1], url);
			return;
		}
	}

	if(userId) {
		blockUserID(userId, 3);
	}
};

// Given a user ID, block this user
var blockUserID = function(userId, retry) {
	if(retry <= 0) {
		sendBannerMessage("Error: block request has failed for user " + userId);
		return;
	}

	processBlackList(userId, function() {
		if(debuggingMode) {
			return;
		}
		var blockRequest = new XMLHttpRequest();
		blockRequest.onreadystatechange = function(result) {
			if(blockRequest.readyState === XMLHttpRequest.DONE) {
				if(blockRequest.status === 204) {
					sendBannerMessage("User has been successfully blocked: " + userId);
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
var fetchMoreVoters = {};
// When results are running out, fetch is over
var fetchIsOver = {};

// Add this answer to my collection for tracking
var addToFavList = function(answerId, isAnswer) {
	if(debuggingMode || collectionId === undefined) {
		return;
	}
	var url_add_to_favList = "https://www.zhihu.com/api/v4/favlists/" + collectionId + "/items";
	var addRequest = new XMLHttpRequest();
	addRequest.onreadystatechange = function(result) {
		if(addRequest.readyState === XMLHttpRequest.DONE) {
			if(addRequest.status === 200) {
				sendBannerMessage("Answer/article has been added to the FavList for tracking purpose.");
			}
			else {
				sendBannerMessage("Error: fail to add to favList.");
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

	fetchMoreVoters[answerId] = false;
	var url = "https://www.zhihu.com/api/v4/answers/" + answerId + "/voters?limit=20&offset=" + offset;
	var url_article = "https://www.zhihu.com/api/v4/articles/" + answerId + "/likers?limit=20&offset=" + offset;

	var blockRequest = new XMLHttpRequest();
	blockRequest.onreadystatechange = function(result) {
		if(blockRequest.readyState === XMLHttpRequest.DONE) {
			var voters = JSON.parse(blockRequest.responseText);
			voters = voters.data;
			if(voters.length < 20) {
				console.log("Stop fetching more voters.");
				fetchIsOver[answerId] = true;
			}
			for(let voter of voters) {
				var peopleId = voter.url_token;
				// Skip anonymous users
				if(peopleId.length > 0) {
					console.log("Block this user: " + peopleId);
					blockUserID(peopleId, 3);
				}
			}
			fetchMoreVoters[answerId] = true;
		}
	};
	blockRequest.open("GET", isAnswer? url : url_article, true);
	blockRequest.send(null);
}

// Inefficient way to fetch voters for scenarios when vote count is missing
var loopExecute = function(funcCall, answerId) {
	var intervalId = setInterval(function() {
		if(fetchIsOver[answerId] === true) {
			clearInterval(intervalId);
			delete fetchMoreVoters[answerId];
			delete fetchIsOver[answerId];
		}
		else if(fetchMoreVoters[answerId] === true) {
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
		blockUser(info);
		return;
	}

	selection = info.selectionText;
	if(selection.length < 6) {
		sendBannerMessage("To reduce the risk of blocking another irrelevant answer, please select more than 6 characters.");
		return;
	}
	// Let current active tab to look for answer ID
	chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
		chrome.tabs.sendMessage(tabs[0].id, {selectionText: selection}, function(response) {
			if(typeof(response) === "undefined" || response.answerId === undefined) {
				sendBannerMessage("Error: cannot locate target answer. Reselect another text area and try again.");
			}
			else {
				addToFavList(response.answerId, response.isAnswer);
				// When upvoteCount is too large, blocking request needs to be sent at a slower rate
				if(response.upvoteCount === undefined || response.upvoteCount > 1000) {
					console.log("AnswerId: " + response.answerId);
					offset = 0;
					fetchMoreVoters[response.answerId] = true;
					fetchIsOver[response.answerId] = false;
					loopExecute(function() {
						getAndBlockVoters(offset, response.answerId, response.isAnswer);
						offset += 20;
					}, response.answerId);
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
	if(debuggingMode) {
		callback();
		return;
	}
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

var removeFromLocal = function(userId) {
	chrome.storage.local.remove(userId, function() {});
}

var addToLocal = function(userId) {
	var pair = {}
	pair[userId] = true;
	chrome.storage.local.set(pair, function() {});
}

chrome.webRequest.onCompleted.addListener(function(details) {
	console.log(details);
	var url = details.url;
	// Remove header 'https://www.zhihu.com/api/v4/members/'
	url = url.substring(37);
	var userId = url.split('/')[0]
	if(details.method === 'DELETE') {
		sendBannerMessage("Remove " + userId + " from local blacklist.");
		removeFromLocal(userId);
	}
	else if(details.method === 'POST') {
		sendBannerMessage("Add " + userId + " to local blacklist.");
		addToLocal(userId);
	}
}, {urls: ["https://www.zhihu.com/api/v4/members/*/actions/block"]});
