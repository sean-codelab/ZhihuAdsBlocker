# ZhihuAdsBlocker
<br/>
Functions:<br/>
A personalized ads blocker of zhihu.com that improves the quality of timeline posts.<br/>
Hide unwanted ads and promotions.<br/>
Block posts made by certified org accounts, which are likely to post ads. This option could be toggled by right-clicking icon.<br/>
Filter out LIVE recommendations and notifications.<br/>
Filter out EBook recommendations.<br/>
Remove right column ads.<br/>
One-click user blocker.<br/>
One-click voters blocker.<br/>
One-click topic blocker.<br/>
Pop-up banner for the result of blocking user/voters/topic.<br/>
<br/>
<br/>
Instructions:<br/>
Comment/remove XPath patterns in zhihuFilter.js to stop blocking corresponding web elements.<br/>
Blocked web elements are logged in web console.<br/>
Number of blocked web elements are displayed on top of the plugin icon.<br/>
Toggle the plugin icon to enable/disable plugin.<br/>
To block a user, right click on the user's avatar and click "Block this user" item.<br/>
To block voters of an answer, select a couple of letters/characters in a paragraph w/o any format change or line break, then right click on the user's avatar and click "Block these voters".<br/>
If right click on a user link, both menu items will pop up. In order to disambiguate such behavior, no matter user clicks on "Block this user" or "Block these voters", it will only block the user.<br/>
To block a topic, right click on the topic's link. Both menu items will block questions having this topic from showing up on the timeline.<br/>
User could create their own collection and put the ID in zhihuFilter.js to keep track of all their blocked answers/articles.<br/>
Blocked users will be stored in local storage, reducing redundant block requests in the future.<br/>
