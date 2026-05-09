"""
Branded PDF generation for InfluConnect — built entirely with ReportLab.

Design language: mirrors the InfluConnect landing page — dark hero gradient with
soft glows, generous whitespace, rounded cards, clean typography, subtle use of
the indigo/violet palette.  The body sections use white "cards" with thin gray
borders on a very light gray page background, producing a modern, editorial feel.
"""
from __future__ import annotations

import base64
import io
import logging
import os
from typing import Iterable

from django.conf import settings
from django.utils import timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas as pdf_canvas
from reportlab.platypus import (
    Flowable, KeepTogether, Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

import qrcode

from ..constants import CONTENT_THEMES, CONTENT_TYPES, SOCIAL_PLATFORMS

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Palette (Tailwind tokens)
# ---------------------------------------------------------------------------
SLATE_950  = colors.HexColor("#020617")
SLATE_900  = colors.HexColor("#0f172a")
INDIGO_950 = colors.HexColor("#1e1b4b")
INDIGO_700 = colors.HexColor("#4338ca")
INDIGO_600 = colors.HexColor("#4f46e5")
INDIGO_500 = colors.HexColor("#6366f1")
INDIGO_400 = colors.HexColor("#818cf8")
INDIGO_100 = colors.HexColor("#e0e7ff")
INDIGO_50  = colors.HexColor("#eef2ff")
VIOLET_600 = colors.HexColor("#7c3aed")
VIOLET_500 = colors.HexColor("#8b5cf6")
VIOLET_400 = colors.HexColor("#a78bfa")
VIOLET_100 = colors.HexColor("#ede9fe")
PINK_500   = colors.HexColor("#ec4899")
PINK_100   = colors.HexColor("#fce7f3")
EMERALD_500 = colors.HexColor("#10b981")
BLUE_500   = colors.HexColor("#3b82f6")
GRAY_900   = colors.HexColor("#111827")
GRAY_700   = colors.HexColor("#374151")
GRAY_600   = colors.HexColor("#4b5563")
GRAY_500   = colors.HexColor("#6b7280")
GRAY_400   = colors.HexColor("#9ca3af")
GRAY_300   = colors.HexColor("#d1d5db")
GRAY_200   = colors.HexColor("#e5e7eb")
GRAY_100   = colors.HexColor("#f3f4f6")
GRAY_50    = colors.HexColor("#f9fafb")
SLATE_300  = colors.HexColor("#cbd5e1")

PAGE_W, PAGE_H = A4
CONTENT_W = PAGE_W - 2 * 18 * mm  # usable width between margins


# ---------------------------------------------------------------------------
# Paragraph styles
# ---------------------------------------------------------------------------
def _styles():
    base = getSampleStyleSheet()
    return {
        "h2": ParagraphStyle(
            "H2", parent=base["Heading2"], fontName="Helvetica-Bold",
            fontSize=16, textColor=GRAY_900, spaceBefore=0, spaceAfter=4, leading=20,
        ),
        "eyebrow": ParagraphStyle(
            "Eye", parent=base["BodyText"], fontName="Helvetica-Bold",
            fontSize=9, textColor=INDIGO_600, leading=11, spaceAfter=2,
            tracking=0.8,
        ),
        "body": ParagraphStyle(
            "Body", parent=base["BodyText"], fontName="Helvetica",
            fontSize=10, textColor=GRAY_700, leading=15, spaceAfter=2,
        ),
        "body_lg": ParagraphStyle(
            "BodyLg", parent=base["BodyText"], fontName="Helvetica",
            fontSize=11, textColor=GRAY_600, leading=16, spaceAfter=2,
        ),
        "muted": ParagraphStyle(
            "Muted", parent=base["BodyText"], fontName="Helvetica",
            fontSize=8.5, textColor=GRAY_400, leading=11,
        ),
        "muted_center": ParagraphStyle(
            "MutedC", parent=base["BodyText"], fontName="Helvetica",
            fontSize=8, textColor=GRAY_400, leading=11, alignment=1,
        ),
    }


def _label_map(items: Iterable[dict]) -> dict[str, str]:
    return {it["code"]: it["label"] for it in items}

THEME_LABELS    = _label_map(CONTENT_THEMES)
TYPE_LABELS     = _label_map(CONTENT_TYPES)
PLATFORM_LABELS = _label_map(SOCIAL_PLATFORMS)


def _format_count(n: float | int) -> str:
    n = int(n or 0)
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}M".replace(".0M", "M")
    if n >= 1_000:
        return f"{n / 1_000:.1f}k".replace(".0k", "k")
    return str(n)


def _format_eur(v: float | int) -> str:
    return f"{int(v or 0):,} €".replace(",", " ")


# ══════════════════════════════════════════════════════════════════════════════
# CUSTOM FLOWABLES
# ══════════════════════════════════════════════════════════════════════════════

# Page background color — visible off-white
PAGE_BG = colors.HexColor("#f0f0f5")  # light cool gray, clearly not white


class HeroBanner(Flowable):
    """Full-bleed asymmetric hero focused on creation.

    Left column: brand, display name, full name, positioning and CTA.
    Right column: stacked visual card with a strong creative image and compact
    stats, closer to an editorial / landing-page hero than a simple profile
    banner.
    """

    HEIGHT = 110 * mm
    AVATAR_R = 28 * mm

    def __init__(self, *, name: str, full_name: str, tagline: str,
                 avatar_path: str | None, kpis: list[tuple[str, str]],
                 gallery_paths: list[str | None] | None = None):
        super().__init__()
        self.name = name
        self.full_name = full_name
        self.tagline = tagline
        self.avatar_path = avatar_path
        self.kpis = kpis
        self.gallery_paths = [p for p in (gallery_paths or []) if p]
        self.width = PAGE_W
        self.height = self.HEIGHT

    def wrap(self, _aw, _ah):
        return self.width, self.height

    def draw(self):
        c = self.canv
        w, h = self.width, self.height
        margin_l = 22 * mm
        margin_r = 22 * mm

        # Clip to hero rect
        c.saveState()
        clip = c.beginPath()
        clip.rect(0, 0, w, h)
        c.clipPath(clip, stroke=0, fill=0)

        # ── Dark asymmetrical background ──
        steps = 100
        for i in range(steps):
            t = i / (steps - 1)
            r = SLATE_950.red + (INDIGO_950.red - SLATE_950.red) * t
            g = SLATE_950.green + (INDIGO_950.green - SLATE_950.green) * t
            b = SLATE_950.blue + (INDIGO_950.blue - SLATE_950.blue) * t
            c.setFillColorRGB(r, g, b)
            c.rect(0, i * h / steps, w, h / steps + 0.5, fill=1, stroke=0)

        c.setFillColor(INDIGO_600)
        c.setFillAlpha(0.18)
        c.circle(w - 28 * mm, h - 16 * mm, 50 * mm, fill=1, stroke=0)
        c.setFillColor(VIOLET_600)
        c.setFillAlpha(0.12)
        c.circle(w * 0.72, h * 0.52, 62 * mm, fill=1, stroke=0)
        c.setFillColor(PINK_500)
        c.setFillAlpha(0.08)
        c.circle(24 * mm, 18 * mm, 40 * mm, fill=1, stroke=0)
        c.setFillAlpha(1)

        accent_h = 3
        for i in range(80):
            frac = i / 79
            cr = INDIGO_500.red + (VIOLET_500.red - INDIGO_500.red) * frac
            cg = INDIGO_500.green + (VIOLET_500.green - INDIGO_500.green) * frac
            cb = INDIGO_500.blue + (VIOLET_500.blue - INDIGO_500.blue) * frac
            c.setFillColorRGB(cr, cg, cb)
            c.rect(i * w / 80, h - accent_h, w / 80 + 0.5, accent_h, fill=1, stroke=0)

        pill_y = h - 18 * mm
        pill_text = "InfluConnect"
        pill_w = stringWidth(pill_text, "Helvetica-Bold", 10) + 20
        c.setFillColor(colors.white)
        c.setFillAlpha(0.12)
        c.roundRect(margin_l - 6, pill_y - 4, pill_w + 82, 18, 9, fill=1, stroke=0)
        c.setFillAlpha(1)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(margin_l, pill_y, pill_text)
        c.setFillColor(INDIGO_400)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(margin_l + stringWidth(pill_text, "Helvetica-Bold", 10) + 8, pill_y + 1, "MEDIA KIT")

        text_area_w = w * 0.56 - margin_l
        title_y = h - 45 * mm
        c.setFillColor(colors.white)
        c.setFont("Times-Bold", 30)
        display_text = self._truncate(self.name, "Times-Bold", 30, text_area_w)
        c.drawString(margin_l, title_y, display_text)

        if self.full_name and self.full_name.lower() != self.name.lower():
            c.setFillColor(GRAY_300)
            c.setFont("Helvetica", 12)
            c.drawString(margin_l, title_y - 7 * mm, self.full_name)

        tag_y = title_y - 15 * mm
        if self.tagline:
            c.setFillColor(GRAY_400)
            c.setFont("Helvetica-Oblique", 10.5)
            tag = self._truncate(self.tagline, "Helvetica-Oblique", 10.5, text_area_w)
            c.drawString(margin_l, tag_y, tag)

        c.setFillColor(INDIGO_400)
        c.setFont("Helvetica-Bold", 8.2)
        c.drawString(margin_l, tag_y - 7 * mm, "CRÉATION · UNIVERS VISUEL · AUDIENCE · TARIFS")

        chip_y = tag_y - 18 * mm
        for idx, (chip_label, chip_fill) in enumerate([
            ("Découvrir le profil", INDIGO_600),
            ("Voir les contenus", VIOLET_600),
        ]):
            chip_x = margin_l + idx * 48 * mm
            c.setFillColor(chip_fill)
            c.setFillAlpha(0.95)
            c.roundRect(chip_x, chip_y, 42 * mm, 9 * mm, 4.5, fill=1, stroke=0)
            c.setFillAlpha(1)
            c.setFillColor(colors.white)
            c.setFont("Helvetica-Bold", 8.2)
            c.drawCentredString(chip_x + 21 * mm, chip_y + 2.9 * mm, chip_label)

        feature_paths = [p for p in self.gallery_paths if os.path.exists(p)]
        primary_path = feature_paths[0] if feature_paths else (
            self.avatar_path if self.avatar_path and os.path.exists(self.avatar_path) else None
        )
        secondary_path = feature_paths[1] if len(feature_paths) > 1 else None

        panel_x = w - margin_r - 64 * mm
        panel_y = h - 72 * mm
        panel_w = 60 * mm
        panel_h = 58 * mm

        c.setFillColor(colors.black)
        c.setFillAlpha(0.24)
        c.roundRect(panel_x + 1.8 * mm, panel_y - 1.8 * mm, panel_w, panel_h, 12, fill=1, stroke=0)
        c.setFillAlpha(1)
        c.setFillColor(colors.HexColor("#111827"))
        c.roundRect(panel_x, panel_y, panel_w, panel_h, 12, fill=1, stroke=0)
        c.setStrokeColor(colors.white)
        c.setStrokeAlpha(0.08)
        c.setLineWidth(0.7)
        c.roundRect(panel_x, panel_y, panel_w, panel_h, 12, fill=0, stroke=1)

        if primary_path:
            try:
                img = ImageReader(_cropped_image_buffer(primary_path, 1.05))
                c.saveState()
                clip = c.beginPath()
                clip.roundRect(panel_x + 1.2 * mm, panel_y + 15 * mm, panel_w - 2.4 * mm, panel_h - 16 * mm, 10)
                c.clipPath(clip, stroke=0, fill=0)
                c.drawImage(img, panel_x + 1.2 * mm, panel_y + 15 * mm,
                            width=panel_w - 2.4 * mm, height=panel_h - 16 * mm, mask='auto')
                c.restoreState()
            except Exception as exc:  # noqa: BLE001
                logger.warning("hero media panel image render failed: %s", exc)

        c.setFillColor(colors.white)
        c.setFillAlpha(0.94)
        c.roundRect(panel_x + 4 * mm, panel_y + panel_h - 10 * mm, 30 * mm, 7 * mm, 3.5, fill=1, stroke=0)
        c.setFillAlpha(1)
        c.setFillColor(INDIGO_700)
        c.setFont("Helvetica-Bold", 7.2)
        c.drawString(panel_x + 5.5 * mm, panel_y + panel_h - 7.7 * mm, "CRÉATION")

        inset_x = panel_x - 14 * mm
        inset_y = panel_y - 10 * mm
        inset_w = 28 * mm
        inset_h = 18 * mm
        c.setFillColor(colors.white)
        c.setFillAlpha(0.1)
        c.roundRect(inset_x, inset_y, inset_w, inset_h, 6, fill=1, stroke=0)
        c.setFillAlpha(1)
        c.setStrokeColor(colors.white)
        c.setStrokeAlpha(0.12)
        c.setLineWidth(0.6)
        c.roundRect(inset_x, inset_y, inset_w, inset_h, 6, fill=0, stroke=1)
        if secondary_path:
            try:
                img = ImageReader(_cropped_image_buffer(secondary_path, inset_w / inset_h))
                c.saveState()
                clip = c.beginPath()
                clip.roundRect(inset_x + 0.5 * mm, inset_y + 0.5 * mm, inset_w - 1 * mm, inset_h - 1 * mm, 5)
                c.clipPath(clip, stroke=0, fill=0)
                c.drawImage(img, inset_x + 0.5 * mm, inset_y + 0.5 * mm,
                            width=inset_w - 1 * mm, height=inset_h - 1 * mm, mask='auto')
                c.restoreState()
            except Exception as exc:  # noqa: BLE001
                logger.warning("hero inset image render failed: %s", exc)
        else:
            c.setFillColor(colors.white)
            c.setFont("Helvetica-Bold", 8)
            c.drawString(inset_x + 2.2 * mm, inset_y + 10.5 * mm, "Créateurs")
            c.setFont("Helvetica", 7)
            c.setFillColor(GRAY_300)
            c.drawString(inset_x + 2.2 * mm, inset_y + 6.8 * mm, f"{len(self.kpis)} indicateurs")

        if self.kpis:
            n_kpis = len(self.kpis)
            tile_h = 21 * mm
            tiles_y = 6 * mm
            gap = 4 * mm
            available = w - margin_l - margin_r - gap * (n_kpis - 1)
            tile_w = available / n_kpis
            for i, (label, value) in enumerate(self.kpis):
                x = margin_l + i * (tile_w + gap)
                c.setFillColor(colors.white)
                c.setFillAlpha(0.09)
                c.roundRect(x, tiles_y, tile_w, tile_h, 8, fill=1, stroke=0)
                c.setStrokeColor(colors.white)
                c.setStrokeAlpha(0.12)
                c.setLineWidth(0.6)
                c.roundRect(x, tiles_y, tile_w, tile_h, 8, fill=0, stroke=1)
                c.setFillAlpha(1)
                c.setFillColor(colors.white)
                c.setFont("Helvetica-Bold", 20)
                c.drawCentredString(x + tile_w / 2, tiles_y + tile_h - 12 * mm, value)
                c.setFillColor(GRAY_400)
                c.setFont("Helvetica", 7)
                c.drawCentredString(x + tile_w / 2, tiles_y + 4 * mm, label.upper())

        c.restoreState()

    @staticmethod
    def _truncate(text: str, font: str, size: int, max_width: float) -> str:
        if stringWidth(text, font, size) <= max_width:
            return text
        lo, hi = 0, len(text)
        while lo < hi:
            mid = (lo + hi) // 2
            if stringWidth(text[:mid] + "…", font, size) <= max_width:
                lo = mid + 1
            else:
                hi = mid
        return text[:max(0, lo - 1)] + "…"


class SectionCard(Flowable):
    """A white rounded-rect card with thin gray border that wraps inner flowables.
    Produces the same feel as the landing page feature cards."""

    RADIUS = 10
    BORDER = 0.5
    PAD = 14

    def __init__(self, inner_flowables: list, available_width: float):
        super().__init__()
        self._inner = inner_flowables
        self._aw = available_width

    def wrap(self, aw, ah):
        self._aw = aw
        inner_w = aw - 2 * self.PAD
        total_h = 0
        for f in self._inner:
            fw, fh = f.wrap(inner_w, ah - total_h)
            total_h += fh
        self._total_h = total_h + 2 * self.PAD
        return aw, self._total_h

    def draw(self):
        c = self.canv
        w = self._aw
        h = self._total_h
        # white card background
        c.setFillColor(colors.white)
        c.roundRect(0, 0, w, h, self.RADIUS, fill=1, stroke=0)
        # thin border
        c.setStrokeColor(GRAY_200)
        c.setLineWidth(self.BORDER)
        c.roundRect(0, 0, w, h, self.RADIUS, fill=0, stroke=1)
        # draw inner content top-down
        y = h - self.PAD
        inner_w = w - 2 * self.PAD
        for f in self._inner:
            fw, fh = f.wrap(inner_w, y)
            y -= fh
            f.drawOn(c, self.PAD, y)

    def split(self, aw, ah):
        return []


class _DividerLine(Flowable):
    """Thin horizontal rule inside a section."""
    def __init__(self, width, color=GRAY_100, thickness=0.8):
        super().__init__()
        self._w = width
        self._color = color
        self._thickness = thickness

    def wrap(self, aw, ah):
        return aw, self._thickness + 6
    def draw(self):
        self.canv.setStrokeColor(self._color)
        self.canv.setLineWidth(self._thickness)
        self.canv.line(0, 3, self._w, 3)


# ══════════════════════════════════════════════════════════════════════════════
# Building blocks
# ══════════════════════════════════════════════════════════════════════════════

def _chip(text: str, bg, fg=colors.white) -> Table:
    t = Table([[text]], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND",     (0,0), (-1,-1), bg),
        ("TEXTCOLOR",      (0,0), (-1,-1), fg),
        ("FONTNAME",       (0,0), (-1,-1), "Helvetica-Bold"),
        ("FONTSIZE",       (0,0), (-1,-1), 8.5),
        ("LEFTPADDING",    (0,0), (-1,-1), 12),
        ("RIGHTPADDING",   (0,0), (-1,-1), 12),
        ("TOPPADDING",     (0,0), (-1,-1), 5),
        ("BOTTOMPADDING",  (0,0), (-1,-1), 5),
        ("ALIGN",          (0,0), (-1,-1), "CENTER"),
        ("VALIGN",         (0,0), (-1,-1), "MIDDLE"),
        ("ROUNDEDCORNERS", [8, 8, 8, 8]),
    ]))
    return t

# Alternating chip colors like the landing page feature icons
_CHIP_COLORS = [
    (INDIGO_600, colors.white),
    (VIOLET_600, colors.white),
    (colors.HexColor("#0891b2"), colors.white),   # cyan-600
    (PINK_500, colors.white),
    (EMERALD_500, colors.white),
    (BLUE_500, colors.white),
]


def _chip_grid(items: list[str], per_row: int = 4, single_color=None):
    if not items:
        return Paragraph("<i>—</i>", _styles()["muted"])
    chips = []
    for i, t in enumerate(items):
        if single_color:
            bg, fg = single_color, colors.white
        else:
            bg, fg = _CHIP_COLORS[i % len(_CHIP_COLORS)]
        chips.append(_chip(t, bg, fg))
    rows = []
    for i in range(0, len(chips), per_row):
        chunk = chips[i:i + per_row]
        chunk = list(chunk) + [""] * (per_row - len(chunk))
        rows.append(chunk)
    parent = Table(rows, hAlign="LEFT")
    parent.setStyle(TableStyle([
        ("LEFTPADDING",   (0,0), (-1,-1), 0),
        ("RIGHTPADDING",  (0,0), (-1,-1), 5),
        ("TOPPADDING",    (0,0), (-1,-1), 3),
        ("BOTTOMPADDING", (0,0), (-1,-1), 3),
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
    ]))
    return parent


def _data_table(header: list[str], rows: list[list[str]], col_widths=None) -> Table:
    data = [header] + (rows or [["—"] * len(header)])
    t = Table(data, colWidths=col_widths, hAlign="LEFT", repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,0), GRAY_900),
        ("TEXTCOLOR",     (0,0), (-1,0), colors.white),
        ("FONTNAME",      (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTNAME",      (0,1), (-1,-1), "Helvetica"),
        ("FONTSIZE",      (0,0), (-1,-1), 9.5),
        ("ROWBACKGROUNDS",(0,1), (-1,-1), [colors.white, GRAY_50]),
        ("LINEBELOW",     (0,0), (-1,-1), 0.3, GRAY_200),
        ("BOX",           (0,0), (-1,-1), 0.3, GRAY_200),
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ("LEFTPADDING",   (0,0), (-1,-1), 10),
        ("RIGHTPADDING",  (0,0), (-1,-1), 10),
        ("TOPPADDING",    (0,0), (-1,-1), 8),
        ("BOTTOMPADDING", (0,0), (-1,-1), 8),
        ("ROUNDEDCORNERS", [6, 6, 6, 6]),
    ]))
    return t


def _kv_table(rows: list[tuple[str, str]], col_widths=None) -> Table:
    if col_widths is None:
        col_widths = (42 * mm, CONTENT_W - 42 * mm - 28)
    t = Table([[k, v] for k, v in rows], colWidths=col_widths, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND",  (0,0), (0,-1), GRAY_50),
        ("TEXTCOLOR",   (0,0), (0,-1), GRAY_600),
        ("FONTNAME",    (0,0), (0,-1), "Helvetica-Bold"),
        ("FONTNAME",    (1,0), (1,-1), "Helvetica"),
        ("FONTSIZE",    (0,0), (-1,-1), 9.5),
        ("BOX",         (0,0), (-1,-1), 0.3, GRAY_200),
        ("INNERGRID",   (0,0), (-1,-1), 0.3, GRAY_200),
        ("VALIGN",      (0,0), (-1,-1), "MIDDLE"),
        ("LEFTPADDING", (0,0), (-1,-1), 10),
        ("RIGHTPADDING",(0,0), (-1,-1), 10),
        ("TOPPADDING",  (0,0), (-1,-1), 7),
        ("BOTTOMPADDING",(0,0),(-1,-1), 7),
    ]))
    return t


def _qr_image(url: str, size_mm: float = 30) -> Image:
    img = qrcode.make(url)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return Image(buf, width=size_mm * mm, height=size_mm * mm)


def _cropped_image_buffer(image_path: str, target_ratio: float) -> io.BytesIO:
    from PIL import Image as PILImage, ImageOps
    with PILImage.open(image_path) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        iw, ih = im.size
        cur_ratio = iw / ih
        if cur_ratio > target_ratio:
            new_w = int(ih * target_ratio)
            left = max(0, (iw - new_w) // 2)
            im = im.crop((left, 0, left + new_w, ih))
        else:
            new_h = int(iw / target_ratio)
            top = max(0, (ih - new_h) // 2)
            im = im.crop((0, top, iw, top + new_h))
        buf = io.BytesIO()
        im.save(buf, format="JPEG", quality=88)
        buf.seek(0)
        return buf


def _signature_label(mode: str, value: str, fallback_label: str, when_text: str, styles):
    label = value or fallback_label or "—"
    mode_label = "Signature manuscrite" if mode == "draw" else "Signature électronique"
    return Paragraph(f"<b>{label}</b><br/><font color='#6b7280'>{mode_label} — {when_text}</font>", styles["body"])


def _signature_image(data: str):
    if not data:
        return None
    try:
        encoded = data.split(",", 1)[1] if "," in data else data
        raw = base64.b64decode(encoded)
        return Image(io.BytesIO(raw), width=38 * mm, height=16 * mm)
    except Exception as exc:
        logger.warning("signature image render failed: %s", exc)
        return None


def _gallery_cell(image_path: str, caption: str, cell_w_mm: float, cell_h_mm: float):
    try:
        img = Image(_cropped_image_buffer(image_path, cell_w_mm / cell_h_mm), width=cell_w_mm * mm, height=cell_h_mm * mm)
    except Exception as exc:  # noqa: BLE001
        logger.warning("gallery image render failed (%s): %s", image_path, exc)
        return Paragraph("<i>Image indisponible</i>", _styles()["muted"])
    if caption:
        cap = Paragraph(f"<font color='#6b7280' size='8'>{caption}</font>", _styles()["muted_center"])
        cell = Table([[img], [cap]], colWidths=[cell_w_mm * mm])
        cell.setStyle(TableStyle([
            ("LEFTPADDING",  (0,0), (-1,-1), 0),
            ("RIGHTPADDING", (0,0), (-1,-1), 0),
            ("TOPPADDING",   (0,0), (-1,-1), 0),
            ("BOTTOMPADDING",(0,0), (0,0), 4),
            ("BOTTOMPADDING",(0,1), (0,1), 0),
        ]))
        return cell
    return img


def _gallery_row(images: list, available_w_mm: float = 144):
    if not images:
        return None
    n = min(len(images), 3)
    images = images[:n]
    gap_mm = 4
    cell_w = (available_w_mm - gap_mm * (n - 1)) / n
    cell_h = cell_w * 0.75
    cells = []
    for img in images:
        path = None
        try:
            if img.image and hasattr(img.image, "path"):
                path = img.image.path
        except Exception:  # noqa: BLE001
            path = None
        if not path or not os.path.exists(path):
            cells.append(Paragraph("<i>—</i>", _styles()["muted"]))
        else:
            cells.append(_gallery_cell(path, img.caption or "", cell_w, cell_h))
    row, col_widths = [], []
    for i, cl in enumerate(cells):
        if i > 0:
            row.append("")
            col_widths.append(gap_mm * mm)
        row.append(cl)
        col_widths.append(cell_w * mm)
    t = Table([row], colWidths=col_widths, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("LEFTPADDING",  (0,0), (-1,-1), 0),
        ("RIGHTPADDING", (0,0), (-1,-1), 0),
        ("TOPPADDING",   (0,0), (-1,-1), 0),
        ("BOTTOMPADDING",(0,0), (-1,-1), 0),
        ("VALIGN",       (0,0), (-1,-1), "TOP"),
    ]))
    return t


def _moodboard_mosaic(images: list):
    if not images:
        return None

    paths: list[tuple[str, str]] = []
    for img in images[:3]:
        try:
            path = img.image.path if img.image and hasattr(img.image, "path") else None
        except Exception:  # noqa: BLE001
            path = None
        if path and os.path.exists(path):
            paths.append((path, img.caption or ""))

    if not paths:
        return None
    if len(paths) < 3:
        return _gallery_row(images, available_w_mm=144)

    big = _gallery_cell(paths[0][0], paths[0][1], 88, 58)
    top = _gallery_cell(paths[1][0], paths[1][1], 52, 28)
    bottom = _gallery_cell(paths[2][0], paths[2][1], 52, 28)

    panel = Table(
        [[big, top], ["", bottom]],
        colWidths=[88 * mm, 52 * mm],
        rowHeights=[58 * mm, 28 * mm],
        hAlign="LEFT",
    )
    panel.setStyle(TableStyle([
        ("SPAN", (0, 0), (0, 1)),
        ("LEFTPADDING",  (0,0), (-1,-1), 0),
        ("RIGHTPADDING", (0,0), (-1,-1), 0),
        ("TOPPADDING",   (0,0), (-1,-1), 0),
        ("BOTTOMPADDING",(0,0), (-1,-1), 0),
        ("VALIGN",       (0,0), (-1,-1), "TOP"),
    ]))
    return panel


# ══════════════════════════════════════════════════════════════════════════════
# Page background & footer
# ══════════════════════════════════════════════════════════════════════════════

def _draw_footer(canvas, doc):
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(GRAY_400)
    canvas.drawString(18 * mm, 9 * mm,
                      f"InfluConnect  ·  Généré le {timezone.now():%d/%m/%Y %H:%M}")
    canvas.drawRightString(PAGE_W - 18 * mm, 9 * mm, f"Page {doc.page}")


def _page_bg(canvas, doc):
    """Later pages: full gray background."""
    canvas.saveState()
    canvas.setFillColor(PAGE_BG)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    _draw_footer(canvas, doc)
    canvas.restoreState()


def _first_page(canvas, doc):
    """First page: gray only below the hero band."""
    canvas.saveState()
    canvas.setFillColor(PAGE_BG)
    canvas.rect(0, 0, PAGE_W, PAGE_H - HeroBanner.HEIGHT, fill=1, stroke=0)
    _draw_footer(canvas, doc)
    canvas.restoreState()


def _build_doc(buf: io.BytesIO, *, top_margin=18) -> SimpleDocTemplate:
    return SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=top_margin * mm, bottomMargin=18 * mm,
        title="InfluConnect", author="InfluConnect",
    )


# ══════════════════════════════════════════════════════════════════════════════
# MEDIA KIT GENERATOR
# ══════════════════════════════════════════════════════════════════════════════

def generate_media_kit_pdf(*, profile) -> bytes:
    s = _styles()
    user = profile.user
    networks = list(profile.social_networks.all())
    public_url = f"https://influconnect.fr/influencers/{profile.id}"

    avatar_path = None
    try:
        if user.avatar and hasattr(user.avatar, "path"):
            avatar_path = user.avatar.path
    except Exception:  # noqa: BLE001
        avatar_path = None

    total_followers = sum((n.followers_count or 0) for n in networks)
    avg_engagement = (
        sum((n.engagement_rate or 0) for n in networks) / len(networks) if networks else 0
    )
    kpis = [
        ("Followers cumulés", _format_count(total_followers)),
        ("Engagement moyen", f"{avg_engagement:.1f} %"),
        ("Plateformes", str(len(networks))),
    ]

    full_name = " ".join(filter(None, [user.first_name, user.last_name])).strip()
    display = profile.display_name or full_name or user.username
    tagline = (profile.bio or "").split("\n")[0][:140]

    story: list = []

    # ── HERO ────────────────────────────────────────────────────────────────
    story.append(HeroBanner(
        name=display, full_name=full_name, tagline=tagline,
        avatar_path=avatar_path, kpis=kpis,
        gallery_paths=[getattr(img.image, "path", None) for img in profile.media_kit_images.all()[:3]],
    ))
    story.append(Spacer(1, 10 * mm))

    # ── ABOUT CARD ──────────────────────────────────────────────────────────
    about_items: list = [
        Paragraph("QUI JE SUIS", s["eyebrow"]),
        Paragraph("Présentation", s["h2"]),
    ]
    if profile.bio:
        about_items.append(Paragraph(profile.bio.replace("\n", "<br/>"), s["body_lg"]))
    else:
        about_items.append(Paragraph("<i>Aucune présentation renseignée.</i>", s["muted"]))

    identity_rows: list[tuple[str, str]] = []
    if user.location:
        identity_rows.append(("Ville", user.location))
    if profile.languages:
        identity_rows.append(("Langues", ", ".join(profile.languages).upper()))
    if identity_rows:
        about_items.append(Spacer(1, 6))
        about_items.append(_kv_table(identity_rows))

    story.append(SectionCard(about_items, CONTENT_W))
    story.append(Spacer(1, 6 * mm))

    # ── PORTFOLIO CARD (optional) ───────────────────────────────────────────
    gallery = list(profile.media_kit_images.all()[:3])
    if gallery:
        gal_items: list = [
            Paragraph("UNIVERS VISUEL", s["eyebrow"]),
            Paragraph("Moodboard", s["h2"]),
        ]
        gal = _moodboard_mosaic(gallery)
        if gal is not None:
            gal_items.append(gal)
        story.append(SectionCard(gal_items, CONTENT_W))
        story.append(Spacer(1, 6 * mm))

    # ── AUDIENCE CARD ───────────────────────────────────────────────────────
    audience_items: list = [
        Paragraph("AUDIENCE", s["eyebrow"]),
        Paragraph("Réseaux sociaux", s["h2"]),
    ]
    if networks:
        rows = [
            [
                PLATFORM_LABELS.get(n.platform, n.platform.title()),
                _format_count(n.followers_count),
                _format_count(n.avg_views),
                f"{(n.engagement_rate or 0):.1f} %",
            ]
            for n in networks
        ]
        audience_items.append(_data_table(
            ["Plateforme", "Followers", "Vues moy.", "Engagement"],
            rows,
            col_widths=(42 * mm, 30 * mm, 30 * mm, 30 * mm),
        ))
    else:
        audience_items.append(Paragraph("<i>Aucun réseau renseigné.</i>", s["muted"]))

    story.append(SectionCard(audience_items, CONTENT_W))
    story.append(Spacer(1, 6 * mm))

    # ── POSITIONING CARD ────────────────────────────────────────────────────
    if profile.content_themes or profile.content_types_offered:
        pos_items: list = [
            Paragraph("POSITIONNEMENT", s["eyebrow"]),
        ]
        if profile.content_themes:
            pos_items.append(Paragraph("Thématiques", s["h2"]))
            labels = [THEME_LABELS.get(c, c) for c in profile.content_themes]
            pos_items.append(_chip_grid(labels))

        if profile.content_types_offered:
            if profile.content_themes:
                pos_items.append(Spacer(1, 6))
                pos_items.append(_DividerLine(CONTENT_W - 28))
                pos_items.append(Spacer(1, 4))
            pos_items.append(Paragraph("Types de contenu", s["h2"]))
            labels = [TYPE_LABELS.get(c, c) for c in profile.content_types_offered]
            pos_items.append(_chip_grid(labels, single_color=VIOLET_600))

        story.append(SectionCard(pos_items, CONTENT_W))
        story.append(Spacer(1, 6 * mm))

    # ── PRICING CARD ────────────────────────────────────────────────────────
    pricing = profile.pricing or {}
    price_items: list = [
        Paragraph("COLLABORATION", s["eyebrow"]),
        Paragraph("Tarifs & formats", s["h2"]),
    ]
    if pricing:
        rows = [[TYPE_LABELS.get(k, k), _format_eur(v)] for k, v in pricing.items()]
        price_items.append(_data_table(
            ["Type de contenu", "Tarif HT"], rows,
            col_widths=(100 * mm, 42 * mm),
        ))
    else:
        price_items.append(Paragraph("<i>Sur devis — me contacter via la plateforme.</i>", s["muted"]))

    story.append(SectionCard(price_items, CONTENT_W))
    story.append(Spacer(1, 8 * mm))

    # ── QR + CTA CARD ──────────────────────────────────────────────────────
    qr = _qr_image(public_url, size_mm=28)
    cta_text = Paragraph(
        f"<font color='#4f46e5' size='9'><b>PROFIL PUBLIC</b></font><br/>"
        f"<font size='13' color='#111827'><b>Découvrez ma fiche en ligne</b></font><br/><br/>"
        f"<font color='#6b7280' size='9.5'>Scannez le QR code pour accéder à mes statistiques "
        f"en temps réel et me proposer une collaboration.</font><br/><br/>"
        f"<font color='#4f46e5' size='8.5'>{public_url}</font>",
        s["body"],
    )
    qr_table = Table([[qr, cta_text]], colWidths=(34 * mm, CONTENT_W - 34 * mm - 28))
    qr_table.setStyle(TableStyle([
        ("VALIGN",       (0,0), (-1,-1), "MIDDLE"),
        ("LEFTPADDING",  (0,0), (-1,-1), 0),
        ("RIGHTPADDING", (0,0), (-1,-1), 0),
        ("TOPPADDING",   (0,0), (-1,-1), 0),
        ("BOTTOMPADDING",(0,0), (-1,-1), 0),
    ]))
    cta_card = SectionCard([qr_table], CONTENT_W)
    story.append(KeepTogether(cta_card))

    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "Kit Média généré automatiquement par InfluConnect",
        s["muted_center"],
    ))

    buf = io.BytesIO()
    doc = _build_doc(buf, top_margin=0)
    doc.build(story, onFirstPage=_first_page, onLaterPages=_page_bg)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# MEDIA KIT GENERATOR — 5-page professional model
# ---------------------------------------------------------------------------
def _media_gallery_paths(profile, avatar_path: str | None = None) -> list[str]:
    paths: list[str] = []
    for img in profile.media_kit_images.all()[:3]:
        try:
            path = img.image.path if img.image and hasattr(img.image, "path") else None
        except Exception:  # noqa: BLE001
            path = None
        if path and os.path.exists(path):
            paths.append(path)
    if avatar_path and os.path.exists(avatar_path):
        paths.append(avatar_path)
    return paths


def _media_draw_rect_gradient(c, x: float, y: float, w: float, h: float, top_color, bottom_color):
    steps = 120
    for i in range(steps):
        t = i / (steps - 1)
        r = bottom_color.red + (top_color.red - bottom_color.red) * t
        g = bottom_color.green + (top_color.green - bottom_color.green) * t
        b = bottom_color.blue + (top_color.blue - bottom_color.blue) * t
        c.setFillColorRGB(r, g, b)
        c.rect(x, y + i * h / steps, w, h / steps + 0.5, fill=1, stroke=0)


def _media_draw_gradient(c, top_color, bottom_color):
    _media_draw_rect_gradient(c, 0, 0, PAGE_W, PAGE_H, top_color, bottom_color)


def _media_draw_image_cover(c, image_path: str | None, x: float, y: float, w: float, h: float):
    if not image_path or not os.path.exists(image_path):
        _media_draw_rect_gradient(c, x, y, w, h, INDIGO_950, SLATE_950)
        return False
    try:
        img = ImageReader(_cropped_image_buffer(image_path, w / h))
        c.saveState()
        clip = c.beginPath()
        clip.rect(x, y, w, h)
        c.clipPath(clip, stroke=0, fill=0)
        c.drawImage(img, x, y, width=w, height=h, mask="auto")
        c.restoreState()
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("media kit image render failed (%s): %s", image_path, exc)
        _media_draw_rect_gradient(c, x, y, w, h, INDIGO_950, SLATE_950)
        return False


def _media_text_lines(text: str, font_name: str, font_size: float, max_width: float) -> list[str]:
    lines: list[str] = []
    for paragraph in (text or "").replace("\r", "").split("\n"):
        words = paragraph.strip().split()
        if not words:
            if lines and lines[-1] != "":
                lines.append("")
            continue
        current = ""
        for word in words:
            candidate = f"{current} {word}".strip()
            if stringWidth(candidate, font_name, font_size) <= max_width:
                current = candidate
            else:
                if current:
                    lines.append(current)
                current = word
        if current:
            lines.append(current)
    return lines


def _media_normalize_paragraph_text(text: str) -> str:
    """Keep paragraph breaks, but remove forced line breaks within paragraphs."""
    normalized = (text or "").replace("\r\n", "\n").replace("\r", "\n")
    out_paragraphs: list[str] = []
    for para in normalized.split("\n\n"):
        merged = " ".join(part.strip() for part in para.split("\n") if part.strip())
        if merged:
            out_paragraphs.append(merged)
    return "\n\n".join(out_paragraphs)


def _media_draw_wrapped_text(
    c,
    text: str,
    x: float,
    y: float,
    max_width: float,
    *,
    font_name: str = "Helvetica",
    font_size: float = 10,
    leading: float = 14,
    color=GRAY_700,
    max_lines: int | None = None,
) -> float:
    lines = _media_text_lines(text, font_name, font_size, max_width)
    if max_lines is not None and len(lines) > max_lines:
        lines = lines[:max_lines]
        if lines:
            while stringWidth(lines[-1] + "…", font_name, font_size) > max_width and len(lines[-1]) > 4:
                lines[-1] = lines[-1][:-1]
            lines[-1] += "…"
    c.setFillColor(color)
    c.setFont(font_name, font_size)
    cursor = y
    for line in lines:
        if line:
            c.drawString(x, cursor, line)
        cursor -= leading
    return cursor


def _media_draw_fit_text(
    c,
    text: str,
    x: float,
    y: float,
    max_width: float,
    *,
    font_name: str = "Helvetica-Bold",
    font_size: float = 14,
    min_size: float = 8,
    color=GRAY_900,
):
    size = font_size
    while size > min_size and stringWidth(text, font_name, size) > max_width:
        size -= 0.5
    c.setFillColor(color)
    c.setFont(font_name, size)
    c.drawString(x, y, text)


def _media_draw_wrapped_text_fit_columns(
    c,
    text: str,
    x: float,
    y: float,
    max_width: float,
    max_height: float,
    *,
    columns: int = 2,
    gap: float = 6 * mm,
    font_name: str = "Helvetica",
    font_size: float = 10.2,
    min_font_size: float = 4.4,
    leading_ratio: float = 1.28,
    color=GRAY_700,
):
    columns = max(1, columns)
    col_width = (max_width - gap * (columns - 1)) / columns
    size = font_size
    lines: list[str] = []
    lines_per_col = 1

    while size >= min_font_size:
        leading = max(size * leading_ratio, size + 1.0)
        lines_per_col = max(1, int(max_height / leading))
        lines = _media_text_lines(text, font_name, size, col_width)
        if len(lines) <= lines_per_col * columns:
            break
        size -= 0.35

    leading = max(size * leading_ratio, size + 0.8)
    lines_per_col = max(1, int(max_height / leading))
    lines = _media_text_lines(text, font_name, size, col_width)
    c.setFillColor(color)
    c.setFont(font_name, size)
    for idx, line in enumerate(lines):
        col = idx // lines_per_col
        if col >= columns:
            # Extremely long text: keep the PDF readable and point to the public profile for the full version.
            break
        row = idx % lines_per_col
        line_x = x + col * (col_width + gap)
        line_y = y - row * leading
        if line:
            c.drawString(line_x, line_y, line)


def _media_draw_network_card(c, network, x: float, y: float, w: float, h: float):
    c.setFillColor(colors.white)
    c.roundRect(x, y, w, h, 9, fill=1, stroke=0)
    c.setStrokeColor(GRAY_200)
    c.setLineWidth(0.6)
    c.roundRect(x, y, w, h, 9, fill=0, stroke=1)
    c.setFillColor(INDIGO_600)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(x + 5 * mm, y + h - 8 * mm, _media_platform_name(network.platform))
    c.setFillColor(GRAY_900)
    c.setFont("Times-Bold", 16)
    c.drawString(x + 5 * mm, y + h - 17 * mm, _format_count(network.followers_count))
    c.setFillColor(GRAY_500)
    c.setFont("Helvetica", 7)
    c.drawString(x + 5 * mm, y + 5 * mm, f"{(network.engagement_rate or 0):.1f}% engagement")


def _media_draw_footer(c, page_num: int, display: str):
    c.setFont("Helvetica", 7.5)
    c.setFillColor(GRAY_400)
    c.drawString(16 * mm, 10 * mm, f"InfluConnect · Kit média · {display}")
    c.drawRightString(PAGE_W - 16 * mm, 10 * mm, f"{page_num}/5")


def _media_draw_kicker(c, text: str, x: float, y: float, color=INDIGO_600):
    c.setFillColor(color)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(x, y, text.upper())


def _media_draw_pill(c, label: str, x: float, y: float, *, fill=INDIGO_50, text_color=INDIGO_700, width: float | None = None):
    pill_w = width or (stringWidth(label, "Helvetica-Bold", 8.5) + 10 * mm)
    c.setFillColor(fill)
    c.roundRect(x, y, pill_w, 8 * mm, 4 * mm, fill=1, stroke=0)
    c.setFillColor(text_color)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawCentredString(x + pill_w / 2, y + 2.6 * mm, label)
    return pill_w


def _media_draw_stat_card(c, x: float, y: float, w: float, h: float, value: str, label: str, accent=INDIGO_600):
    c.setFillColor(colors.white)
    c.roundRect(x, y, w, h, 8, fill=1, stroke=0)
    c.setStrokeColor(GRAY_200)
    c.setLineWidth(0.7)
    c.roundRect(x, y, w, h, 8, fill=0, stroke=1)
    c.setFillColor(accent)
    c.setFont("Times-Bold", 24)
    c.drawString(x + 6 * mm, y + h - 13 * mm, value)
    c.setFillColor(GRAY_500)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(x + 6 * mm, y + 6 * mm, label.upper())


def _media_platform_name(platform: str) -> str:
    return PLATFORM_LABELS.get(platform, (platform or "Plateforme").title())


def generate_media_kit_pdf(*, profile) -> bytes:  # noqa: F811 - overrides legacy layout above
    user = profile.user
    networks = list(profile.social_networks.all())
    full_name = " ".join(filter(None, [user.first_name, user.last_name])).strip()
    display = profile.display_name or full_name or user.username
    display_clean = display.strip() or "Créateur"
    year = timezone.now().year

    frontend_url = getattr(settings, "FRONTEND_URL", "https://influconnect.fr").rstrip("/")
    public_url = f"{frontend_url}/marketplace/{profile.id}"

    avatar_path = None
    try:
        if user.avatar and hasattr(user.avatar, "path"):
            avatar_path = user.avatar.path
    except Exception:  # noqa: BLE001
        avatar_path = None

    gallery_paths = _media_gallery_paths(profile, avatar_path)
    cover_img = gallery_paths[0] if gallery_paths else None
    description_img = gallery_paths[1] if len(gallery_paths) > 1 else cover_img
    universe_img = gallery_paths[2] if len(gallery_paths) > 2 else description_img

    bio = (profile.bio or "").strip() or "Créateur de contenu, disponible pour des collaborations authentiques et soignées."
    bio = _media_normalize_paragraph_text(bio)
    collaboration_pitch = (profile.collaboration_pitch or "").strip()
    if len(collaboration_pitch) < 20:
        raise ValueError("La page 5 doit utiliser le texte 'Pourquoi collaborer avec vous ?' rempli par l'influenceur dans son profil.")

    theme_labels = [THEME_LABELS.get(c, c) for c in (profile.content_themes or [])]
    type_labels = [TYPE_LABELS.get(c, c) for c in (profile.content_types_offered or [])]
    languages = ", ".join((profile.languages or [])).upper() or "—"
    total_followers = sum((n.followers_count or 0) for n in networks)
    total_views = sum((n.avg_views or 0) for n in networks)
    avg_engagement = sum((n.engagement_rate or 0) for n in networks) / len(networks) if networks else 0

    buf = io.BytesIO()
    c = pdf_canvas.Canvas(buf, pagesize=A4)

    # Page 1 — Cover: background photo + title + year + pseudo
    _media_draw_image_cover(c, cover_img, 0, 0, PAGE_W, PAGE_H)
    c.setFillColor(colors.black)
    c.setFillAlpha(0.45)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillAlpha(1)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(16 * mm, PAGE_H - 18 * mm, "InfluConnect")
    c.setFont("Helvetica", 10)
    c.drawRightString(PAGE_W - 16 * mm, PAGE_H - 18 * mm, str(year))
    c.setFont("Helvetica-Bold", 11)
    c.drawString(18 * mm, 72 * mm, "KIT")
    c.setFont("Times-Bold", 58)
    c.drawString(18 * mm, 48 * mm, "MEDIA")
    c.setFont("Helvetica-Bold", 15)
    c.drawString(19 * mm, 35 * mm, display_clean)
    if user.location:
        c.setFont("Helvetica", 9)
        c.setFillColor(GRAY_200)
        c.drawString(19 * mm, 28 * mm, user.location)
    c.showPage()

    # Page 2 — Présentation + réseaux
    c.setFillColor(colors.HexColor("#f6f1ea"))
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    card_x = 14 * mm
    card_y = 17 * mm
    card_w = PAGE_W - 28 * mm
    card_h = PAGE_H - 34 * mm
    c.setFillColor(colors.white)
    c.roundRect(card_x, card_y, card_w, card_h, 18, fill=1, stroke=0)
    x = 22 * mm
    top = PAGE_H - 36 * mm
    content_w = PAGE_W - 44 * mm
    image_w = 42 * mm
    image_h = 54 * mm
    image_x = PAGE_W - 22 * mm - image_w
    image_y = PAGE_H - 92 * mm

    _media_draw_kicker(c, "02 · Présentation + réseaux", x, top)
    c.setFillColor(GRAY_900)
    c.setFont("Times-Bold", 38)
    c.drawString(x, top - 18 * mm, "Présentation")
    _media_draw_fit_text(c, display_clean, x, top - 31 * mm, image_x - x - 8 * mm, font_name="Helvetica-Bold", font_size=13, color=INDIGO_600)
    _media_draw_image_cover(c, description_img, image_x, image_y, image_w, image_h)
    c.setFillColor(colors.white)
    c.setFillAlpha(0.20)
    c.rect(image_x, image_y, image_w, image_h, fill=1, stroke=0)
    c.setFillAlpha(1)

    meta_x = x
    if user.location:
        meta_x += _media_draw_pill(c, user.location, meta_x, top - 45 * mm, fill=INDIGO_50, text_color=INDIGO_700) + 4 * mm
    if languages != "—":
        _media_draw_pill(c, f"Langues : {languages}", meta_x, top - 45 * mm, fill=GRAY_50, text_color=GRAY_700)

    bio_top = PAGE_H - 102 * mm
    social_title_y = 78 * mm
    _media_draw_wrapped_text_fit_columns(
        c,
        bio,
        x,
        bio_top,
        content_w,
        bio_top - (social_title_y + 14 * mm),
        columns=2,
        font_size=10.2,
        min_font_size=4.0,
        color=GRAY_700,
    )

    c.setFillColor(GRAY_900)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(x, social_title_y, "Réseaux principaux")
    card_gap = 4 * mm
    network_card_w = (content_w - 2 * card_gap) / 3
    network_card_y = 44 * mm
    if networks:
        for idx, network in enumerate(networks[:3]):
            _media_draw_network_card(c, network, x + idx * (network_card_w + card_gap), network_card_y, network_card_w, 25 * mm)
    else:
        _media_draw_wrapped_text(c, "Les réseaux sociaux seront affichés ici dès qu'ils seront renseignés.", x, network_card_y + 12 * mm, content_w, font_size=9.5, leading=12, color=GRAY_500, max_lines=2)
    _media_draw_footer(c, 2, display_clean)
    c.showPage()

    # Page 3 — Statistics / platform
    c.setFillColor(GRAY_50)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    x = 16 * mm
    top = PAGE_H - 34 * mm
    _media_draw_kicker(c, "03 · Statistiques / Plateforme", x, top)
    c.setFillColor(GRAY_900)
    c.setFont("Times-Bold", 34)
    c.drawString(x, top - 17 * mm, "Audience & performances")
    card_w = (PAGE_W - 2 * x - 9 * mm) / 2
    card_h = 33 * mm
    _media_draw_stat_card(c, x, top - 62 * mm, card_w, card_h, _format_count(total_followers), "Followers cumulés")
    _media_draw_stat_card(c, x + card_w + 9 * mm, top - 62 * mm, card_w, card_h, f"{avg_engagement:.1f}%", "Engagement moyen", VIOLET_600)
    _media_draw_stat_card(c, x, top - 101 * mm, card_w, card_h, _format_count(total_views), "Vues moyennes cumulées", PINK_500)
    _media_draw_stat_card(c, x + card_w + 9 * mm, top - 101 * mm, card_w, card_h, str(len(networks)), "Plateformes actives", EMERALD_500)

    row_y = top - 131 * mm
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(GRAY_500)
    c.drawString(x, row_y, "PLATEFORME")
    c.drawString(x + 58 * mm, row_y, "FOLLOWERS")
    c.drawString(x + 96 * mm, row_y, "VUES")
    c.drawString(x + 128 * mm, row_y, "ENGAGEMENT")
    row_y -= 9 * mm
    if networks:
        for n in networks[:6]:
            c.setFillColor(colors.white)
            c.roundRect(x, row_y - 5 * mm, PAGE_W - 2 * x, 12 * mm, 6, fill=1, stroke=0)
            c.setFillColor(GRAY_900)
            c.setFont("Helvetica-Bold", 10)
            c.drawString(x + 5 * mm, row_y, _media_platform_name(n.platform))
            c.setFont("Helvetica", 9)
            c.setFillColor(GRAY_600)
            c.drawString(x + 58 * mm, row_y, _format_count(n.followers_count))
            c.drawString(x + 96 * mm, row_y, _format_count(n.avg_views))
            c.drawString(x + 128 * mm, row_y, f"{(n.engagement_rate or 0):.1f}%")
            row_y -= 15 * mm
    else:
        _media_draw_wrapped_text(c, "Aucune plateforme renseignée pour le moment.", x, row_y, PAGE_W - 2 * x, color=GRAY_500)
    _media_draw_footer(c, 3, display_clean)
    c.showPage()

    # Page 4 — Univers & contenus
    c.setFillColor(colors.HexColor("#f8f1e8"))
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    x = 16 * mm
    top = PAGE_H - 38 * mm
    content_w = PAGE_W - 32 * mm

    _media_draw_kicker(c, "04 · Univers & contenus", x, top)
    c.setFillColor(GRAY_900)
    c.setFont("Times-Bold", 38)
    c.drawString(x, top - 19 * mm, "Univers")
    _media_draw_fit_text(c, "& lignes éditoriales", x, top - 36 * mm, 120 * mm, font_name="Times-Bold", font_size=34, min_size=24, color=GRAY_900)
    _media_draw_wrapped_text(
        c,
        "Les thématiques, formats et codes visuels qui structurent les collaborations.",
        x,
        top - 50 * mm,
        content_w,
        font_size=9.6,
        leading=12,
        color=GRAY_600,
        max_lines=2,
    )

    card_gap = 8 * mm
    card_w = (content_w - card_gap) / 2
    card_y = 110 * mm
    card_h = 96 * mm
    for card_idx, card_title in enumerate(["Mon univers", "Formats proposés"]):
        card_x = x + card_idx * (card_w + card_gap)
        c.setFillColor(colors.white)
        c.roundRect(card_x, card_y, card_w, card_h, 16, fill=1, stroke=0)
        c.setFillColor(INDIGO_50 if card_idx == 0 else colors.HexColor("#fdf2f8"))
        c.roundRect(card_x + 6 * mm, card_y + card_h - 18 * mm, 12 * mm, 12 * mm, 6 * mm, fill=1, stroke=0)
        c.setFillColor(INDIGO_600 if card_idx == 0 else PINK_500)
        c.setFont("Helvetica-Bold", 14)
        c.drawCentredString(card_x + 12 * mm, card_y + card_h - 14 * mm, "#" if card_idx == 0 else ">")
        c.setFillColor(GRAY_900)
        c.setFont("Helvetica-Bold", 12)
        c.drawString(card_x + 23 * mm, card_y + card_h - 14 * mm, card_title)

    chip_x = x + 8 * mm
    chip_y = card_y + card_h - 36 * mm
    theme_source = theme_labels or ["Lifestyle", "Création", "Influence"]
    for label in theme_source[:10]:
        pill_w = min(stringWidth(label, "Helvetica-Bold", 8.5) + 10 * mm, card_w - 16 * mm)
        if chip_x + pill_w > x + card_w - 8 * mm:
            chip_x = x + 8 * mm
            chip_y -= 11 * mm
        _media_draw_pill(c, label, chip_x, chip_y, fill=INDIGO_50, text_color=INDIGO_700, width=pill_w)
        chip_x += pill_w + 3.5 * mm

    format_x = x + card_w + card_gap + 8 * mm
    format_y = card_y + card_h - 36 * mm
    for idx, label in enumerate((type_labels or ["Posts", "Stories", "Reels"])[:7], start=1):
        c.setFillColor(GRAY_50)
        c.roundRect(format_x, format_y - 2.5 * mm, card_w - 16 * mm, 9 * mm, 5, fill=1, stroke=0)
        c.setFillColor(PINK_500)
        c.setFont("Helvetica-Bold", 8.5)
        c.drawString(format_x + 4 * mm, format_y, f"{idx:02d}")
        c.setFillColor(GRAY_700)
        c.setFont("Helvetica", 8.5)
        _media_draw_wrapped_text(c, label, format_x + 15 * mm, format_y, card_w - 34 * mm, font_size=8.5, leading=9, color=GRAY_700, max_lines=1)
        format_y -= 11 * mm

    image_y = 28 * mm
    image_h = 70 * mm
    _media_draw_image_cover(c, universe_img, x, image_y, content_w, image_h)
    c.setFillColor(colors.black)
    c.setFillAlpha(0.28)
    c.rect(x, image_y, content_w, image_h, fill=1, stroke=0)
    c.setFillAlpha(1)
    c.setFillColor(colors.white)
    c.setFont("Times-Bold", 25)
    c.drawString(x + 10 * mm, image_y + 39 * mm, "Un univers prêt")
    c.drawString(x + 10 * mm, image_y + 28 * mm, "à être activé")
    c.setFont("Helvetica", 8.8)
    c.setFillColor(GRAY_200)
    _media_draw_wrapped_text(
        c,
        "Chaque collaboration peut être adaptée au brief de marque tout en conservant une identité authentique et identifiable.",
        x + 10 * mm,
        image_y + 17 * mm,
        92 * mm,
        font_size=8.8,
        leading=11,
        color=GRAY_200,
        max_lines=3,
    )
    _media_draw_footer(c, 4, display_clean)
    c.showPage()

    # Page 5 — Collaboration + QR
    _media_draw_gradient(c, INDIGO_950, SLATE_950)
    c.setFillColor(INDIGO_600)
    c.setFillAlpha(0.18)
    c.circle(PAGE_W - 32 * mm, PAGE_H - 38 * mm, 58 * mm, fill=1, stroke=0)
    c.setFillColor(VIOLET_600)
    c.setFillAlpha(0.12)
    c.circle(26 * mm, 34 * mm, 48 * mm, fill=1, stroke=0)
    c.setFillAlpha(1)
    x = 18 * mm
    _media_draw_kicker(c, "05 · Collaboration", x, PAGE_H - 46 * mm, color=INDIGO_400)
    c.setFillColor(colors.white)
    c.setFont("Times-Bold", 38)
    c.drawString(x, PAGE_H - 68 * mm, "Pourquoi collaborer")
    _media_draw_fit_text(c, f"avec {display_clean} ?", x, PAGE_H - 84 * mm, 118 * mm, font_name="Times-Bold", font_size=38, min_size=23, color=colors.white)
    _media_draw_wrapped_text(c, collaboration_pitch, x, PAGE_H - 108 * mm, 96 * mm, font_size=11, leading=16, color=GRAY_200, max_lines=13)

    qr_card_x = PAGE_W - 76 * mm
    qr_card_y = 66 * mm
    qr_card_w = 56 * mm
    qr_card_h = 76 * mm
    c.setFillColor(colors.white)
    c.roundRect(qr_card_x, qr_card_y, qr_card_w, qr_card_h, 12, fill=1, stroke=0)
    qr = _qr_image(public_url, size_mm=36)
    qr.drawOn(c, qr_card_x + 10 * mm, qr_card_y + 29 * mm)
    c.setFillColor(GRAY_900)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(qr_card_x + qr_card_w / 2, qr_card_y + 19 * mm, "Profil plateforme")
    c.setFillColor(GRAY_500)
    c.setFont("Helvetica", 7.4)
    c.drawCentredString(qr_card_x + qr_card_w / 2, qr_card_y + 12 * mm, "Scannez pour consulter")
    c.drawCentredString(qr_card_x + qr_card_w / 2, qr_card_y + 8 * mm, "les informations à jour")

    c.setFillColor(GRAY_400)
    c.setFont("Helvetica", 7.5)
    c.drawString(16 * mm, 10 * mm, f"InfluConnect · Kit média · {display_clean}")
    c.drawRightString(PAGE_W - 16 * mm, 10 * mm, "5/5")
    c.save()
    return buf.getvalue()


# ---------------------------------------------------------------------------
# CONTRACT
# ---------------------------------------------------------------------------
def _contract_header(canvas, doc):
    canvas.saveState()
    band_h = 6 * mm
    canvas.setFillColor(INDIGO_600)
    canvas.rect(0, PAGE_H - band_h, PAGE_W, band_h, fill=1, stroke=0)
    canvas.setFillColor(VIOLET_600)
    canvas.rect(0, PAGE_H - band_h, PAGE_W * 0.4, band_h, fill=1, stroke=0)
    canvas.setFillColor(INDIGO_700)
    canvas.setFont("Helvetica-Bold", 10)
    canvas.drawString(18 * mm, PAGE_H - 14 * mm, "InfluConnect")
    canvas.setFillColor(GRAY_500)
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(PAGE_W - 18 * mm, PAGE_H - 14 * mm, "CONTRAT DE COLLABORATION")
    # footer
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(GRAY_400)
    canvas.drawString(18 * mm, 9 * mm,
                      f"InfluConnect  ·  Généré le {timezone.now():%d/%m/%Y %H:%M}")
    canvas.drawRightString(PAGE_W - 18 * mm, 9 * mm, f"Page {doc.page}")
    canvas.restoreState()


def generate_contract_pdf(*, proposal) -> bytes:
    s = _styles()
    campaign = proposal.campaign
    brand = campaign.brand
    influencer = proposal.influencer
    rights = (campaign.target_filters or {}).get("rights", "Réseaux sociaux uniquement, durée 12 mois.")

    story: list = []
    # Title block
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("CONTRAT", s["eyebrow"]))
    story.append(Paragraph("Collaboration commerciale", ParagraphStyle(
        "TitleBig", parent=s["h2"], fontSize=22, textColor=GRAY_900,
        spaceBefore=0, spaceAfter=2, leading=26,
    )))
    story.append(Paragraph(
        f"Référence <b>PROP-{proposal.id}</b> &nbsp;·&nbsp; "
        f"Généré le {timezone.now():%d/%m/%Y %H:%M}",
        s["muted"],
    ))

    story.append(Paragraph("1. Parties", s["h2"]))
    story.append(_kv_table([
        ("Marque", brand.company_name or "—"),
        ("Influenceur", influencer.display_name or influencer.user.username),
    ]))

    story.append(Paragraph("2. Objet de la prestation", s["h2"]))
    brief = (campaign.brief_text or campaign.description or "—")[:2500]
    story.append(Paragraph(brief.replace("\n", "<br/>"), s["body"]))
    story.append(Spacer(1, 6))
    story.append(_kv_table([
        ("Réseaux ciblés", ", ".join(campaign.target_networks or []) or "—"),
        ("Format", campaign.content_format or "—"),
        ("Délai de livraison",
         campaign.deadline.strftime("%d/%m/%Y") if campaign.deadline else "—"),
    ]))

    story.append(Paragraph("3. Rémunération", s["h2"]))
    amount = proposal.escrow_amount or proposal.proposed_price or 0
    story.append(_kv_table([
        ("Montant", _format_eur(amount)),
        ("Commission plateforme", "15 %"),
        ("Modalité", "Escrow Stripe — libéré après validation du contenu"),
    ]))

    story.append(Paragraph("4. Droits d'utilisation", s["h2"]))
    story.append(Paragraph(rights, s["body"]))

    story.append(Paragraph("5. Confidentialité", s["h2"]))
    story.append(Paragraph(
        "Les Parties s'engagent à préserver la confidentialité des informations échangées "
        "dans le cadre de cette collaboration.",
        s["body"],
    ))

    story.append(Paragraph("6. Résiliation et litige", s["h2"]))
    story.append(Paragraph(
        "En cas de désaccord, l'arbitrage est confié à l'équipe InfluConnect sous un délai "
        "de 48 h ouvrées. La marque dispose de 5 jours ouvrés pour valider le contenu après "
        "soumission de la preuve.",
        s["body"],
    ))

    story.append(Paragraph("7. Mécanisme d'escrow", s["h2"]))
    story.append(Paragraph(
        "Les fonds versés par la marque sont séquestrés sur le compte plateforme Stripe Connect. "
        "Ils sont libérés vers l'influenceur après validation du contenu, déduction faite de la "
        "commission InfluConnect.",
        s["body"],
    ))

    story.append(Paragraph("8. Signatures", s["h2"]))
    brand_signed = (
        _signature_label(
            getattr(proposal, "brand_signature_mode", ""),
            getattr(proposal, "brand_signature_value", ""),
            getattr(proposal.campaign.brand, "company_name", "Marque"),
            proposal.brand_signed_at.strftime("Signé le %d/%m/%Y à %H:%M") if proposal.brand_signed_at else "— en attente —",
            s,
        )
        if getattr(proposal, "contract_signed_brand", False) and proposal.brand_signed_at
        else "— en attente —"
    )
    influ_signed = (
        _signature_label(
            getattr(proposal, "influencer_signature_mode", ""),
            getattr(proposal, "influencer_signature_value", ""),
            getattr(proposal.influencer, "display_name", "Influenceur"),
            proposal.influencer_signed_at.strftime("Signé le %d/%m/%Y à %H:%M") if proposal.influencer_signed_at else "— en attente —",
            s,
        )
        if getattr(proposal, "contract_signed_influencer", False) and proposal.influencer_signed_at
        else "— en attente —"
    )
    story.append(_kv_table([
        ("Marque (signé le)", brand_signed),
        ("Influenceur (signé le)", influ_signed),
    ]))

    brand_signature_image = _signature_image(getattr(proposal, "brand_signature_data", ""))
    if brand_signature_image is not None:
        story.append(Spacer(1, 8))
        story.append(Paragraph("Aperçu signature marque", s["body_bold"]))
        story.append(brand_signature_image)

    influencer_signature_image = _signature_image(getattr(proposal, "influencer_signature_data", ""))
    if influencer_signature_image is not None:
        story.append(Spacer(1, 8))
        story.append(Paragraph("Aperçu signature influenceur", s["body_bold"]))
        story.append(influencer_signature_image)

    story.append(Spacer(1, 14))
    story.append(Paragraph(
        "Document généré automatiquement par InfluConnect — fait foi entre les Parties.",
        s["muted_center"],
    ))

    buf = io.BytesIO()
    doc = _build_doc(buf, top_margin=22)
    doc.build(story, onFirstPage=_contract_header, onLaterPages=_contract_header)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Backward-compat shim
# ---------------------------------------------------------------------------
def render_html_to_pdf(html: str, base_url: str | None = None) -> bytes:  # noqa: ARG001
    """Deprecated — kept for legacy import paths."""
    import re
    html_no_style = re.sub(r"<style[^>]*>.*?</style>", "", html, flags=re.S | re.I)
    text = re.sub(r"<[^>]+>", " ", html_no_style)
    text = re.sub(r"\s+", " ", text).strip()
    s = _styles()
    buf = io.BytesIO()
    doc = _build_doc(buf)
    doc.build([Paragraph(text, s["body"])], onFirstPage=_page_bg, onLaterPages=_page_bg)
    return buf.getvalue()
