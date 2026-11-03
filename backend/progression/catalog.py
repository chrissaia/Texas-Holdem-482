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

ACHIEVEMENTS.update({
    "pocket_aces": ("Pocket Rockets", "Be dealt pocket aces."),
    "seven_two": ("Against the Odds", "Win a hand outright with 7–2 offsuit."),
    "preflop_all_in": ("All or Nothing", "Go all-in before the flop and win outright."),
    "straight": ("Straight Shooter", "Win at showdown with a straight."),
    "flush": ("Flush with Success", "Win at showdown with a flush."),
    "full_house": ("Full House", "Win at showdown with a full house."),
    "four_of_a_kind": ("Four of a Kind", "Win at showdown with four of a kind."),
    "royal_flush": ("Royal Treatment", "Win at showdown with a royal flush."),
    "tournament_debut": ("Tournament Debut", "Complete your first tournament."),
    "tournament_champion": ("Champion", "Win your first tournament."),
})
