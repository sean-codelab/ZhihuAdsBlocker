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
				console.log("Removed nodes because of " + xpath + ": \n")
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
	var markedXPath = "//div[@class='Card TopstoryItem' and @ishiddenbyplugin='true']";
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

// Periodically loop over all hidden nodes and delete their child nodes
var intervalID = setInterval(function(){
	deleteChildren();
}, 500);


var blockFunc = function(refresh=false) {
	chrome.runtime.sendMessage({getAdBlockerDisabled: true, refreshCount: refresh}, function(response){
		if(response == null) {
			console.log("Extension plugin error: response not received from background.js");
			return;
		}
		if(!response.AdBlockerDisabled){
			if(patternsToBeRemoved != undefined && patternsToBeRemoved != null && patternsToBeRemoved.length > 0) {
				removeMatchingPatterns(patternsToBeRemoved);
			}
			if(patternsToBeHidden != undefined && patternsToBeHidden != null && patternsToBeHidden.length > 0) {
				hideMatchingPatterns(patternsToBeHidden);
			}
		}
	}); 
};

window.addEventListener("load", blockFunc(true));
window.addEventListener("scroll", blockFunc);

