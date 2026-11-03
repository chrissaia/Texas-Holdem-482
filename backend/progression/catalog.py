"""Private catalogue. Never serialize locked names or requirements to clients."""
ACHIEVEMENTS = {
    "welcome": ("Welcome to the Table", "Complete your first dealt hand."),
    "picture": ("Picture Perfect", "Save your first profile picture."),
    "host": ("House Rules", "Create your first game."),
    "friend": ("Poker Pal", "Add your first accepted friend."),
    "message": ("Say Hello", "Send your first direct message."),
    "hands_10": ("Getting Comfortable", "Complete 10 dealt hands."),
    "hands_100": ("Regular Player", "Complete 100 dealt hands."),
    "hands_1000": ("Table Veteran", "Complete 1,000 dealt hands."),
    "first_win": ("First Pot", "Win your first hand outright."),
    "streak": ("On a Roll", "Win three consecutive dealt hands outright."),
}
ACHIEVEMENT_XP = 50
