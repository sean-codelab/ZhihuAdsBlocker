// Delete matching nodes
var removeMatchingPatterns = function(xpaths) {
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
				chrome.runtime.sendMessage({numOfBlockers: results.length}, function(){});
				console.log("Remove nodes because of " + xpath + ": \n")
				for(let removedNode of results) {
					removedNode.parentNode.removeChild(removedNode);
				}   
			}   
		}   
	}   
}

// Hide matching nodes
// This handler is for Zhihu timeline posts only
// Removing these nodes will cause unexpected indefinite loading new contents upon scrolling, so they have to be handled in a different way
var hideMatchingPatterns = function(xpaths) {
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
				chrome.runtime.sendMessage({numOfBlockers: results.length}, function(){});
				console.log("Hide nodes because of " + xpath + ": \n")
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
				console.log("Chidren of this node will be removed:");
				console.log(hiddenNode);
				for(let removedChild of hiddenNode.children) {
					hiddenNode.removeChild(removedChild);
				}
			}
		}
	}
}

// Returns answer id based on selection text
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	var responsePayload = {}; 
	if(request.selectionText != null) {
		var xpath_answer = "//text()[contains(., '" + request.selectionText + "')]/ancestor::div[contains(@class, 'AnswerItem')]";
		var xpath_upvote_count = "//text()[contains(., '" + request.selectionText + "')]/ancestor::div[contains(@class, 'AnswerItem')]//meta[@itemprop='upvoteCount']";
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
				console.log("ERROR: More than one answer or no answer is found.");
			}
		}
	}
	sendResponse(responsePayload);
});

// Periodically loop over all hidden nodes and delete their child nodes
// Periodically delete all matching nodes
var intervalID = setInterval(function() {
	removeMatchingPatterns(patternsToBeRemoved);
	hideMatchingPatterns(patternsToBeHidden);
	deleteChildren();
}, 100);

var blockFunc = function() {
	chrome.runtime.sendMessage({getAdBlockerDisabled: true}, function(response){
		if(response == null) {
			console.log("Extension plugin error: response not received from background.js");
			return;
		}
		if(!response.AdBlockerDisabled) {
			if(intervalID === null) {
				intervalID = setInterval(function() {
					removeMatchingPatterns(patternsToBeRemoved);
					hideMatchingPatterns(patternsToBeHidden);
					deleteChildren();
				}, 100);
			}
		}
		else {
			if(intervalID !== null) {
				clearInterval(intervalID);
				intervalID = null;
			}
		}
	}); 
};
