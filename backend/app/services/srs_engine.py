# app/services/srs_engine.py
from datetime import datetime, timedelta, timezone

def calculate_next_review(grade: str, current_interval: int) -> tuple[int, datetime.date]:
    """
    Calculates the new interval and next review date based on the user's grade.
    Returns: (new_interval_days, next_review_date)
    """
    if grade == "Again":
        new_interval = 0
    elif grade == "Hard":
        new_interval = max(1, current_interval * 1) # Minimum 1 day
    elif grade == "Good":
        new_interval = max(3, current_interval * 2) # Min 3 days, doubles thereafter
    elif grade == "Easy":
        new_interval = max(7, current_interval * 3) # Min 7 days, triples thereafter
    else:
        new_interval = 0 # Fallback

    # Calculate the exact date the card is due next
    today = datetime.now(timezone.utc).date()
    next_date = today + timedelta(days=new_interval)

    return new_interval, next_date
