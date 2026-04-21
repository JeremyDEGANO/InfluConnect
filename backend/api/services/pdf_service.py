"""
Branded PDF generation for InfluConnect — built entirely with ReportLab.

Design language: mirrors the InfluConnect landing page — dark hero gradient with
soft glows, generous whitespace, rounded cards, clean typography, subtle use of
the indigo/violet palette.  The body sections use white "cards" with thin gray
borders on a very light gray page background, producing a modern, editorial feel.
"""
from __future__ import annotations

import io
import logging
import os
from typing import Iterable

from django.utils import timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
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
    """Full-bleed dark hero — editorial layout.

    Left column: brand, display name (very large), full name, tagline.
    Right column: circular avatar with gradient ring.
    Bottom: KPI stat tiles on a frosted strip.
    """

    HEIGHT = 110 * mm
    AVATAR_R = 28 * mm

    def __init__(self, *, name: str, full_name: str, tagline: str,
                 avatar_path: str | None, kpis: list[tuple[str, str]]):
        super().__init__()
        self.name = name
        self.full_name = full_name
        self.tagline = tagline
        self.avatar_path = avatar_path
        self.kpis = kpis
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

        # ── Gradient background (vertical: bottom=slate-950, top=indigo-950) ──
        steps = 100
        for i in range(steps):
            t = i / (steps - 1)  # 0 = bottom, 1 = top
            r = SLATE_950.red  + (INDIGO_950.red  - SLATE_950.red)  * t
            g = SLATE_950.green + (INDIGO_950.green - SLATE_950.green) * t
            b = SLATE_950.blue + (INDIGO_950.blue - SLATE_950.blue) * t
            c.setFillColorRGB(r, g, b)
            c.rect(0, i * h / steps, w, h / steps + 0.5, fill=1, stroke=0)

        # ── Decorative glows ──
        c.setFillColor(VIOLET_500)
        c.setFillAlpha(0.12)
        c.circle(w - 30 * mm, h - 15 * mm, 60 * mm, fill=1, stroke=0)
        c.setFillColor(BLUE_500)
        c.setFillAlpha(0.07)
        c.circle(30 * mm, 15 * mm, 50 * mm, fill=1, stroke=0)
        c.setFillColor(INDIGO_400)
        c.setFillAlpha(0.05)
        c.circle(w * 0.5, h * 0.5, 80 * mm, fill=1, stroke=0)
        c.setFillAlpha(1)

        # ── Thin accent line (top) — gradient indigo→violet ──
        accent_h = 3
        for i in range(80):
            frac = i / 79
            cr = INDIGO_500.red  + (VIOLET_500.red  - INDIGO_500.red)  * frac
            cg = INDIGO_500.green + (VIOLET_500.green - INDIGO_500.green) * frac
            cb = INDIGO_500.blue + (VIOLET_500.blue - INDIGO_500.blue) * frac
            c.setFillColorRGB(cr, cg, cb)
            c.rect(i * w / 80, h - accent_h, w / 80 + 0.5, accent_h, fill=1, stroke=0)

        # ── Brand pill (top-left) ──
        pill_y = h - 18 * mm
        # pill background
        pill_text = "InfluConnect"
        pill_w = stringWidth(pill_text, "Helvetica-Bold", 10) + 20
        c.setFillColor(colors.white)
        c.setFillAlpha(0.08)
        c.roundRect(margin_l - 6, pill_y - 4, pill_w + 65, 18, 9, fill=1, stroke=0)
        c.setFillAlpha(1)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(margin_l, pill_y, pill_text)
        c.setFillColor(VIOLET_400)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(margin_l + stringWidth(pill_text, "Helvetica-Bold", 10) + 8, pill_y + 1,
                     "MEDIA KIT")

        # ── LEFT: Display name (big & bold) + details ──
        text_area_w = w * 0.58 - margin_l
        name_y = h - 42 * mm
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 32)
        display_text = self._truncate(self.name, "Helvetica-Bold", 32, text_area_w)
        c.drawString(margin_l, name_y, display_text)

        # Real name below
        if self.full_name and self.full_name.lower() != self.name.lower():
            c.setFillColor(SLATE_300)
            c.setFont("Helvetica", 12)
            c.drawString(margin_l, name_y - 8 * mm, self.full_name)

        # Tagline
        if self.tagline:
            tag_y = name_y - (16 * mm if self.full_name and self.full_name.lower() != self.name.lower() else 10 * mm)
            c.setFillColor(GRAY_400)
            c.setFont("Helvetica-Oblique", 10)
            tag = self._truncate(self.tagline, "Helvetica-Oblique", 10, text_area_w)
            c.drawString(margin_l, tag_y, tag)

        # ── RIGHT: Avatar ──
        avatar_cx = w - margin_r - self.AVATAR_R - 5 * mm
        avatar_cy = h - 22 * mm - self.AVATAR_R
        # gradient ring behind avatar
        ring_r = self.AVATAR_R + 4
        c.setStrokeColor(INDIGO_500)
        c.setLineWidth(3)
        c.setStrokeAlpha(0.5)
        c.circle(avatar_cx, avatar_cy, ring_r, fill=0, stroke=1)
        c.setStrokeColor(VIOLET_500)
        c.setStrokeAlpha(0.4)
        c.setLineWidth(2)
        c.circle(avatar_cx, avatar_cy, ring_r + 3, fill=0, stroke=1)
        c.setStrokeAlpha(1)

        if self.avatar_path and os.path.exists(self.avatar_path):
            c.saveState()
            p = c.beginPath()
            p.circle(avatar_cx, avatar_cy, self.AVATAR_R)
            c.clipPath(p, stroke=0, fill=0)
            try:
                img = ImageReader(self.avatar_path)
                iw, ih = img.getSize()
                scale = max((2 * self.AVATAR_R) / iw, (2 * self.AVATAR_R) / ih)
                dw, dh = iw * scale, ih * scale
                c.drawImage(img, avatar_cx - dw / 2, avatar_cy - dh / 2,
                            width=dw, height=dh, mask='auto')
            except Exception as exc:  # noqa: BLE001
                logger.warning("avatar render failed: %s", exc)
            c.restoreState()
        else:
            # Initials fallback
            c.setFillColor(INDIGO_600)
            c.circle(avatar_cx, avatar_cy, self.AVATAR_R, fill=1, stroke=0)
            c.setFillColor(colors.white)
            c.setFont("Helvetica-Bold", 30)
            initials = "".join(p[0] for p in self.full_name.split()[:2] if p).upper() or "?"
            c.drawCentredString(avatar_cx, avatar_cy - 11, initials)
        # white inner ring
        c.setStrokeColor(colors.white)
        c.setStrokeAlpha(0.7)
        c.setLineWidth(2.5)
        c.circle(avatar_cx, avatar_cy, self.AVATAR_R, fill=0, stroke=1)
        c.setStrokeAlpha(1)

        # ── BOTTOM: KPI tiles ──
        if self.kpis:
            n_kpis = len(self.kpis)
            tile_h = 22 * mm
            tiles_y = 6 * mm
            gap = 5 * mm
            available = w - margin_l - margin_r - gap * (n_kpis - 1)
            tile_w = available / n_kpis
            for i, (label, value) in enumerate(self.kpis):
                x = margin_l + i * (tile_w + gap)
                # frosted tile
                c.setFillColor(colors.white)
                c.setFillAlpha(0.07)
                c.roundRect(x, tiles_y, tile_w, tile_h, 8, fill=1, stroke=0)
                c.setStrokeColor(colors.white)
                c.setStrokeAlpha(0.15)
                c.setLineWidth(0.5)
                c.roundRect(x, tiles_y, tile_w, tile_h, 8, fill=0, stroke=1)
                c.setFillAlpha(1)
                c.setStrokeAlpha(1)
                # value
                c.setFillColor(colors.white)
                c.setFont("Helvetica-Bold", 22)
                c.drawCentredString(x + tile_w / 2, tiles_y + tile_h - 12 * mm, value)
                # label
                c.setFillColor(SLATE_300)
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


def _gallery_cell(image_path: str, caption: str, cell_w_mm: float, cell_h_mm: float):
    from PIL import Image as PILImage, ImageOps
    try:
        with PILImage.open(image_path) as im:
            im = ImageOps.exif_transpose(im).convert("RGB")
            target_ratio = cell_w_mm / cell_h_mm
            iw, ih = im.size
            cur_ratio = iw / ih
            if cur_ratio > target_ratio:
                new_w = int(ih * target_ratio)
                left = (iw - new_w) // 2
                im = im.crop((left, 0, left + new_w, ih))
            else:
                new_h = int(iw / target_ratio)
                top = (ih - new_h) // 2
                im = im.crop((0, top, iw, top + new_h))
            buf = io.BytesIO()
            im.save(buf, format="JPEG", quality=88)
            buf.seek(0)
            img = Image(buf, width=cell_w_mm * mm, height=cell_h_mm * mm)
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
    public_url = f"https://influconnect.local/influencers/{profile.id}"

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
    ))
    story.append(Spacer(1, 10 * mm))

    # ── ABOUT CARD ──────────────────────────────────────────────────────────
    about_items: list = [
        Paragraph("À PROPOS", s["eyebrow"]),
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
            Paragraph("PORTFOLIO", s["eyebrow"]),
            Paragraph("Galerie", s["h2"]),
        ]
        gal = _gallery_row(gallery)
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
        Paragraph("Grille tarifaire", s["h2"]),
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
        proposal.contract_signed_at.strftime("%d/%m/%Y %H:%M")
        if getattr(proposal, "contract_signed_brand", False) and proposal.contract_signed_at
        else "— en attente —"
    )
    influ_signed = (
        proposal.contract_signed_at.strftime("%d/%m/%Y %H:%M")
        if getattr(proposal, "contract_signed_influencer", False) and proposal.contract_signed_at
        else "— en attente —"
    )
    story.append(_kv_table([
        ("Marque (signé le)", brand_signed),
        ("Influenceur (signé le)", influ_signed),
    ]))

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
