// Delete matching nodes
var removeMatchingPatterns = function(xpaths) {
	var numOfResults = 0;
	for(let xpath of xpaths) {
		var removedNodeList = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
		if(removedNodeList != null) {
			var results = []; 
			for(let i = 0, length = removedNodeList.snapshotLength; i < length; ++i) {
				var removedNodeItem = removedNodeList.snapshotItem(i);
				if(removedNodeItem != null){
					results.push(removedNodeList.snapshotItem(i));
				}   
			}   
			if(results.length > 0) {
				numOfResults += results.length;
				console.log("Remove " + results.length + " node" + (results.length > 1 ? "s" : "") + " because of " + xpath + ": \n")
				for(let removedNode of results) {
					removedNode.parentNode.removeChild(removedNode);
				}   
			}   
		}   
	}   
	return numOfResults;
}

// Hide matching nodes
// This handler is for Zhihu timeline posts only
// Removing these nodes will cause unexpected indefinite loading new contents upon scrolling, so they have to be handled in a different way
var hideMatchingPatterns = function(xpaths) {
	var numOfResults = 0;
	for(let xpath of xpaths) {
		var hiddenNodeList = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
		if(hiddenNodeList != null) {
			var results = []; 
			for(let i = 0, length = hiddenNodeList.snapshotLength; i < length; ++i) {
				var hiddenNodeItem = hiddenNodeList.snapshotItem(i);
				if(hiddenNodeItem != null){
					results.push(hiddenNodeList.snapshotItem(i));
				}   
			}   
			if(results.length > 0) {
				numOfResults += results.length;
				console.log("Hide " + results.length + " node" + (results.length > 1 ? "s" : "") + " because of " + xpath + ": \n")
				for(let hiddenNode of results) {
					hiddenNode.style.visibility = "hidden";
					hiddenNode.style.margin = 0;
					hiddenNode.style.padding = 0;
					hiddenNode.setAttribute("ishiddenbyplugin", "true");
				}
			}
		}
	}
	deleteChildren();
	return numOfResults;
}

// Delete all children of hidden nodes
var deleteChildren = function() {
	var markedXPath = "//div[(@class='Card TopstoryItem' or @class='List-item') and @ishiddenbyplugin='true']";
	var allHiddenNodeList = document.evaluate(markedXPath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
	if(allHiddenNodeList != null) {
		for(let i = 0, length = allHiddenNodeList.snapshotLength; i < length; ++i) {
			var hiddenNode = allHiddenNodeList.snapshotItem(i);
			// Remove all chidren of hidden nodes
			if(hiddenNode != null && hiddenNode.children.length > 0) {
				for(let removedChild of hiddenNode.children) {
					hiddenNode.removeChild(removedChild);
				}
			}
		}
	}
}

// Returns answer id based on selection text
// Refresh filtering criterias if forceUpdate is true
// Get blocked user id
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	var responsePayload = {}; 
	if(request.selectionText != null) {
		var xpath_answer = "//text()[contains(., '" + request.selectionText + "')]/ancestor::div[@class='ContentItem AnswerItem']";
		var xpath_upvote_count = "//text()[contains(., '" + request.selectionText + "')]/ancestor::div[@class='ContentItem AnswerItem']//meta[@itemprop='upvoteCount']";
		var answerList = document.evaluate(xpath_answer, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
		if(answerList != null && answerList.snapshotLength === 1) {
			var answerItem = answerList.snapshotItem(0).getAttribute('name');
			responsePayload['answerId'] = answerItem;
			var upvoteCount = document.evaluate(xpath_upvote_count, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null).snapshotItem(0).getAttribute('content');
			responsePayload['upvoteCount'] = upvoteCount;
			responsePayload['isAnswer'] = true;
		} 
		else {
			var xpath_article = "//text()[contains(., '" + request.selectionText + "')]/ancestor::div[contains(@class, 'ArticleItem')]";
			var articleList = document.evaluate(xpath_article, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
			if(articleList != null && articleList.snapshotLength === 1) {
				var articleItem = JSON.parse(articleList.snapshotItem(0).getAttribute('data-za-extra-module'));
				var articleVoteCount = articleItem.card.content.upvote_num;
				var articleId = articleItem.card.content.token;
				responsePayload['answerId'] = articleId;
				responsePayload['upvoteCount'] = articleVoteCount;
				responsePayload['isAnswer'] = false;
			}
			else {
				var xpath_column = "//text()[contains(., '" + request.selectionText + "')]/ancestor::div[contains(@class, 'Layout-main')]/div[@data-zop]";
				var columnList = document.evaluate(xpath_column, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
				if(columnList != null && columnList.snapshotLength === 1) {
					var articleItem = JSON.parse(columnList.snapshotItem(0).getAttribute('data-zop'));
					var articleId = articleItem.itemId;
					responsePayload['answerId'] = articleId;
					responsePayload['isAnswer'] = false;
				}
				else {
					console.log("ERROR: More than one answer or no answer is found.");
				}
			}
		}
	}
	if(request.forceUpdate !== undefined && request.forceUpdate === true) {
		updateFilter();
	}
	if(request.blockUserId !== undefined) {
		if(request.failToBlock !== undefined) {
			displayErrorBannerForBlockUser(request.blockUserId);
		}
		else {
			displayBannerForBlockUser(request.blockUserId);
		}
	}
	sendResponse(responsePayload);
});

// Periodically loop over all hidden nodes and delete their child nodes
// Periodically delete all matching nodes
// Periodically animate banner when prompted
var intervalID = null;
var animationIntervalID = null;

// Update filtering criteria and start/stop running ads blocker
var updateFilter = function() {
	chrome.runtime.sendMessage({getAdBlockerDisabled: true}, function(response){
		if(response == null) {
			console.log("Extension plugin error: response not received from background.js");
			return;
		}
		var removedXPaths = response.removedXPaths;
		var hiddenXPaths = response.hiddenXPaths;
		if(!response.AdBlockerDisabled) {
			if(intervalID !== null) {
				clearInterval(intervalID);
			}
			intervalID = setInterval(function() {
				var numOfResults = removeMatchingPatterns(removedXPaths);
				numOfResults += hideMatchingPatterns(hiddenXPaths);
				if(numOfResults > 0) {
					chrome.runtime.sendMessage({numOfBlockers: numOfResults}, function(){});
				}
			}, 100);
		}
		else {
			if(intervalID !== null) {
				clearInterval(intervalID);
				intervalID = null;
			}
		}
	}); 
}

// Start running ads blocker
updateFilter();

// Create banner web element
var createBanner = function(text) {
	banner = document.createElement('div');
	banner.className += "blockNotificationBanner";
	banner.setAttribute("position", "0");
	banner.appendChild(document.createTextNode(text));
	document.body.prepend(banner);
	banner.addEventListener('click', function() {
		if(withdrawTimeoutID !== null) {
			clearTimeout(withdrawTimeoutID);
			withdrawTimeoutID = null;
		}
		waitAndExecute(function() {
			withdrawBanner(function() {});
		});
	});
}

var banner = null;
var isBannerDeployed = false;
var withdrawTimeoutID = null;

var updateBanner = function(text) {
	if(isBannerDeployed && banner !== null) {
		banner.innerText = text;
	}
}

var removeBanner = function() {
	banner.remove();
}

// Display/Update banner text, then execute callback
var displayBanner = function(text, callback) {
	waitAndExecute(function() {
		if(isBannerDeployed) {
			updateBanner(text);
			callback();
			return;
		}
		
		createBanner(text);
		animationIntervalID = setInterval(function() {
			var pos = Number(banner.getAttribute("position"));
			if(pos >= 50) {
				clearInterval(animationIntervalID);
				animationIntervalID = null;
				isBannerDeployed = true;
				callback();
			} else {
				pos += 0.5; 
				banner.setAttribute("position", pos);
				banner.style.top = pos + 'px'; 
			}
		}, 5);
	});
}

// Remove banner, then execute callback
var withdrawBanner = function(callback) {
	waitAndExecute(function() {
		if(!isBannerDeployed) {
			callback();
			return;
		}

		animationIntervalID = setInterval(function() {
			var pos = Number(banner.getAttribute("position"));
			if(pos <= 0) {
				clearInterval(animationIntervalID);
				animationIntervalID = null;
				isBannerDeployed = false;
				removeBanner();
				callback();
			} else {
				pos -= 0.5; 
				banner.setAttribute("position", pos);
				banner.style.top = pos + 'px'; 
			}
		}, 5);
	});
}

// Wait until banner is no longer moving before execute
var waitAndExecute = function(callback) {
	var intervalId = setInterval(function() {
		if(animationIntervalID === null) {
			clearInterval(intervalId);
			callback();
		}
	}, 100);
}

var displayErrorBannerForBlockUser = function(blockUserId) {
	displayBanner("Error: block request has failed for user " + blockUserId, function() {
		if(withdrawTimeoutID !== null) {
			clearTimeout(withdrawTimeoutID);
			withdrawTimeoutID = null;
		}
		withdrawTimeoutID = setTimeout(function() {
			withdrawTimeoutID = null;
			withdrawBanner(function() {});
		}, 4000);
	});
}

var displayBannerForBlockUser = function(blockUserId) {
	displayBanner("User has been successfully blocked: " + blockUserId, function() {
		if(withdrawTimeoutID !== null) {
			clearTimeout(withdrawTimeoutID);
			withdrawTimeoutID = null;
		}
		withdrawTimeoutID = setTimeout(function() {
			withdrawTimeoutID = null;
			withdrawBanner(function() {});
		}, 4000);
	});
}
