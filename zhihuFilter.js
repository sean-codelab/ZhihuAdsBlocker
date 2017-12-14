var patternsToBeRemoved = [
	// Delete LIVE ads in the right column
	"//div[contains(@class, 'RelatedLives-title')]/parent::div",
	"//div[contains(@data-za-detail-view-path-module_name, '私家课 · Live 推荐')]",
	// Delete right column ads
	"//div[@data-za-module='ExternalAdItem']",
	"//div[@data-za-detail-view-path-module='ExternalAdItem']"
];
// All patterns, in this category, should be matching div[@class='Card TopstoryItem']
var patternsToBeHidden = [
	// Hide Ads cards
	"//button[contains(@class, 'TopstoryItem-advertButton')]/ancestor::div[@class='Card TopstoryItem']",
	// Hide LIVE participation posts
	"//span[contains(text(), '参与了 Live')]/ancestor::div[@class='Card TopstoryItem']",
	// Hide LIVE promotion posts
	"//span[contains(text(), '对 Live 感兴趣')]/ancestor::div[@class='Card TopstoryItem']",
	// Hide posts from certified org accounts
	"//a[contains(@data-tooltip, '已认证的官方帐号')]/ancestor::div[@class='Card TopstoryItem']",
	"//a[contains(@data-tooltip, '已认证的官方帐号')]/ancestor::div[@class='List-item']",
	// Hide LIVE transaction posts
	"//span[contains(text(), '赞助了 Live')]/ancestor::div[@class='Card TopstoryItem']",
	// Hide EBook Ads cards
	"//div[contains(@class, 'EBookItem')]/ancestor::div[@class='Card TopstoryItem']",
	// Hide Column notices
	"//div[@data-za-module='ColumnItem']/ancestor::div[@class='Card TopstoryItem']"
];
