"""Sweep persisted deadlines independently of browser and WebSocket activity."""
import logging
from time import sleep

from django.core.management.base import BaseCommand
from django.db import close_old_connections
from django.utils import timezone

from tables.gameplay import GameConflict, process_expired_table
from tables.models import PokerHand

logger = logging.getLogger(__name__)


def sweep_expired_turns():
    due_tables = PokerHand.objects.filter(
        status=PokerHand.Status.ACTIVE, turn_deadline__lte=timezone.now(),
        turn_user__isnull=False,
    ).order_by("turn_deadline", "pk").values_list("table_id", flat=True)
    processed = 0
    for table_id in due_tables.iterator(chunk_size=100):
        try:
            processed += process_expired_table(table_id)
        except GameConflict:
            logger.exception("Could not advance expired turn at table %s", table_id)
    return processed


class Command(BaseCommand):
    help = "Advance expired poker turns and mark inactive players as sitting out."

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true", help="Process the current due turns and exit.")

    def handle(self, *args, **options):
        if options["once"]:
            self.stdout.write(f"Processed {sweep_expired_turns()} expired turn(s).")
            return
        self.stdout.write("Watching for expired poker turns.")
        while True:
            close_old_connections()
            sweep_expired_turns()
            sleep(1)
