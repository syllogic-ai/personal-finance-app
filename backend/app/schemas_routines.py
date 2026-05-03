"""Routine output and request payload schemas."""
from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator


class EvidenceItem(BaseModel):
    source: str
    url: str
    quote: str
    relevance: str


class HouseholdPerson(BaseModel):
    person_id: str = Field(alias="personId")
    name: str
    cash: float
    investments: float
    properties: float
    vehicles: float
    total: float

    class Config:
        populate_by_name = True


class HouseholdSection(BaseModel):
    people: list[HouseholdPerson]


class PositionRow(BaseModel):
    label: str
    current: float
    target: Optional[float] = None
    delta_pct: Optional[float] = Field(default=None, alias="deltaPct")
    note: Optional[str] = None

    class Config:
        populate_by_name = True


class NewsItem(BaseModel):
    title: str
    source: str
    url: str
    date_iso: str = Field(alias="dateIso")
    summary: str

    class Config:
        populate_by_name = True


class Recommendation(BaseModel):
    severity: Literal["info", "monitor", "act_now"]
    title: str
    rationale: str
    proposed_change: Optional[str] = Field(default=None, alias="proposedChange")

    class Config:
        populate_by_name = True


class RoutineOutput(BaseModel):
    status: Literal["GREEN", "AMBER", "RED"]
    confidence: Literal["low", "medium", "high"]
    headline: str
    summary: str
    evidence: list[EvidenceItem] = Field(default_factory=list)
    household: HouseholdSection
    positions: list[PositionRow] = Field(default_factory=list)
    news: list[NewsItem] = Field(default_factory=list)
    recommendations: list[Recommendation] = Field(default_factory=list)
    flags: dict[str, bool] = Field(default_factory=dict)


class ParseScheduleRequest(BaseModel):
    text: str


class ParseScheduleResponse(BaseModel):
    cron: str
    timezone: str
    human_readable: str = Field(alias="humanReadable")

    class Config:
        populate_by_name = True
