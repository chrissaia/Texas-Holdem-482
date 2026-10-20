from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class TablePagination(PageNumberPagination):
    page_size = 8
    page_size_query_param = "page_size"
    max_page_size = 50

    def get_paginated_response(self, data):
        return Response({
            "count": self.page.paginator.count,
            "next": self.get_next_link(),
            "previous": self.get_previous_link(),
            "page": self.page.number,
            "page_size": self.get_page_size(self.request),
            "total_pages": self.page.paginator.num_pages,
            "total_tables": self.view.lobby_totals["total_tables"],
            "total_players": self.view.lobby_totals["total_players"],
            "results": data,
        })

    def paginate_queryset(self, queryset, request, view=None):
        self.view = view
        return super().paginate_queryset(queryset, request, view)
