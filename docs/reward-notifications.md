# S32: XP and trophy notifications (#45)

Signed-in players receive a dismissible popup with newly earned XP and trophy names, linking to their achievement collection. Hidden achievements remain hidden until earned. XP and awards come from the existing private server endpoint; the browser cannot grant rewards.

The first successful response after sign-in establishes a silent baseline. While the tab is visible, the app checks every five seconds and when it regains focus. New XP earned between checks is combined, including repeat rewards; previously earned trophies are not announced again. Notifications persist across navigation, are cleared on account changes, and retain at most five recent notices until dismissed. Screen readers receive polite announcements without focus being moved.

Network failures preserve the last baseline and are retried on the next check. This is polling, not a WebSocket push; rewards earned before the first successful baseline or while signed out are not announced. Awards earned through future gameplay hooks will use the same server snapshot.

Try changing the saved theme, uploading your first avatar, or creating your first public table with a signed-in account. Wait up to five seconds and check the popup, then refresh or navigate to verify the trophy is not repeated.
