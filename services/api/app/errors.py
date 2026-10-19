"""Structured errors shared by HTTP application services."""


class ApiProblem(Exception):
    def __init__(self, status: int, code: str, message: str, details: dict | None = None):
        super().__init__(message)
        self.status, self.code, self.details = status, code, details or {}
