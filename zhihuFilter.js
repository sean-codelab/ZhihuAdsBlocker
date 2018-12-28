// All patterns in this category will be removed from the page
var removedXPaths = [
	// Delete LIVE ads in the right column
	"//div[contains(@class, 'RelatedLives-title')]/parent::div",
	"//div[contains(@data-za-detail-view-path-module_name, '私家课 · Live 推荐')]",
	// Delete right column ads on timeline
	"//div[@data-za-module='ExternalAdItem']",
	"//div[@data-za-detail-view-path-module='ExternalAdItem']",
	// Delete right column ads on explore page
	"//div[@class='shameimaru-section']",
	// Delete bottom QRCode promotion banner
	"//div[@class='HitQrcode']/parent::span",
	// Delete right column promotions
	"//div[@data-za-detail-view-path-module_name='相关推荐']",
	// Delete Kanshan ads. Poor Zhihu FE wrote a typo here
	"//div[@class='KanshanDiversion']",
	// Delete Questioning ads
	"//div[@class='Lottie Kok']",
	// Delete Adblock banner
	"//div[@class='AdblockBanner']",
	// Delete Reward button
	"//div[@class='Reward']",
	// Delete right column LIVE ads
	"//div[@class='Card-header RelatedCommodities-title']/parent::div",
	// Delete right column card ads
	"//img[@alt='广告']/ancestor::div[@class='Card Banner']",
	// Delete AdSense Ads
	"//iframe[@class='Banner-adsense']/ancestor::div[@class='Card Banner']",
	// Delete sidebar ads
	"//a[@rel='noopener noreferrer']/parent::div[contains(@class, 'Pc-card')]"
];
// All patterns, in this category, should be referring to div[contains(@class, 'Card TopstoryItem')] web elements
var hiddenXPaths = [
	// Hide Ads cards
	"//button[contains(@class, 'TopstoryItem-advertButton')]/ancestor::div[contains(@class, 'Card TopstoryItem')]",
	"//div[contains(@class, 'TopstoryItem--advertCard') and @ishiddenbyplugin != 'true']",
	// Hide ALL LIVE related ads & posts
	"//span[contains(text(), '参与了 Live')]/ancestor::div[contains(@class, 'Card TopstoryItem')]",
	"//span[contains(text(), '对 Live 感兴趣')]/ancestor::div[contains(@class, 'Card TopstoryItem')]",
	"//span[contains(text(), '赞助了 Live')]/ancestor::div[contains(@class, 'Card TopstoryItem')]",
	"//div[@class='LiveItem']/ancestor::div[contains(@class, 'Card TopstoryItem')]",
	// Hide EBook Ads cards
	"//div[contains(@class, 'EBookItem')]/ancestor::div[contains(@class, 'Card TopstoryItem')]",
	// Hide Column notices
	"//div[@data-za-module='ColumnItem']/ancestor::div[contains(@class, 'Card TopstoryItem')]",
	// Hide Events
	"//div[@data-za-detail-view-path-module='EventItem']/ancestor::div[contains(@class, 'Card TopstoryItem')]",
	// Hide Google Ads
	"//div[@class='Advert-adsense']/ancestor::div[contains(@class, 'Card TopstoryItem')]"
];
// This category stores patterns that could be either hidden or exposed
var orgPostsXPaths = [
	// Hide posts from certified org accounts
	"//a[contains(@data-tooltip, '已认证的官方帐号')]/ancestor::div[contains(@class, 'Card TopstoryItem')]",
	"//a[contains(@data-tooltip, '已认证的官方帐号')]/ancestor::div[@class='List-item']"
];
// Collection of blocked answers/articles. THIS IS PERSONAL.
var collectionId = 207389298;
