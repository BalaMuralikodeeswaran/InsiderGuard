"""PDF incident report generation using ReportLab."""
import io
from datetime import datetime, timezone
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
)

RISK_COLORS = {
    "Critical": colors.HexColor("#ef4444"),
    "High": colors.HexColor("#f59e0b"),
    "Medium": colors.HexColor("#eab308"),
    "Low": colors.HexColor("#22c55e"),
}


def generate_incident_report(employee, analysis, alerts, investigation, analyst_name):
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=18 * mm, bottomMargin=18 * mm,
                            leftMargin=18 * mm, rightMargin=18 * mm)
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle("H1", fontName="Helvetica-Bold", fontSize=20, textColor=colors.HexColor("#0f172a"), spaceAfter=4))
    styles.add(ParagraphStyle("Sub", fontName="Helvetica", fontSize=9, textColor=colors.HexColor("#64748b"), spaceAfter=10))
    styles.add(ParagraphStyle("Sec", fontName="Helvetica-Bold", fontSize=12, textColor=colors.HexColor("#1e293b"), spaceBefore=12, spaceAfter=6))
    styles.add(ParagraphStyle("Body2", fontName="Helvetica", fontSize=9.5, textColor=colors.HexColor("#334155"), leading=14))
    el = []

    el.append(Paragraph("CaughtIn4K — Incident Report", styles["H1"]))
    el.append(Paragraph("AI-Based Insider Threat Detection &amp; Employee Risk Monitoring", styles["Sub"]))
    el.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e2e8f0")))

    score = analysis.get("risk_score", 0)
    level = analysis.get("risk_level", "Low")

    # Summary table
    el.append(Paragraph("Employee Information", styles["Sec"]))
    info = [
        ["Employee ID", employee.get("employee_id", "-"), "Name", employee.get("name", "-")],
        ["Department", employee.get("department", "-"), "Title", employee.get("title", "-")],
        ["Status", employee.get("status", "-"), "Last Login", str(employee.get("last_login", "-"))[:19]],
    ]
    t = Table(info, colWidths=[70, 130, 70, 130])
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#64748b")),
        ("TEXTCOLOR", (2, 0), (2, -1), colors.HexColor("#64748b")),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica-Bold"),
        ("FONTNAME", (3, 0), (3, -1), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, colors.HexColor("#f1f5f9")),
    ]))
    el.append(t)

    # Risk score banner
    el.append(Paragraph("Incident Summary", styles["Sec"]))
    rk = Table([[f"RISK SCORE: {score}/100", f"LEVEL: {level.upper()}"]], colWidths=[200, 200])
    rk.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 12),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.white),
        ("BACKGROUND", (0, 0), (-1, -1), RISK_COLORS.get(level, colors.grey)),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
    ]))
    el.append(rk)
    el.append(Spacer(1, 8))

    # AI Explanation
    el.append(Paragraph("Detected Anomalies &amp; AI Explanation", styles["Sec"]))
    for r in analysis.get("reasons", []):
        el.append(Paragraph(f"• {r}", styles["Body2"]))

    # Evidence
    if analysis.get("evidence"):
        el.append(Paragraph("Evidence", styles["Sec"]))
        for e in analysis.get("evidence", []):
            el.append(Paragraph(f"• [{e.get('type','').upper()}] {e.get('detail','')}", styles["Body2"]))

    # Related alerts
    if alerts:
        el.append(Paragraph("Related Alerts", styles["Sec"]))
        data = [["Alert ID", "Severity", "Description", "Status"]]
        for a in alerts[:12]:
            data.append([a.get("alert_id", ""), a.get("severity", ""), a.get("description", "")[:48], a.get("status", "")])
        at = Table(data, colWidths=[90, 60, 220, 60])
        at.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#e2e8f0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        el.append(at)

    # Investigation notes
    if investigation:
        el.append(Paragraph("Investigation Notes", styles["Sec"]))
        el.append(Paragraph(f"Status: <b>{investigation.get('status','-')}</b> &nbsp;|&nbsp; Analyst: <b>{investigation.get('analyst','-')}</b>", styles["Body2"]))
        for n in investigation.get("notes", []):
            txt = n.get("text", n) if isinstance(n, dict) else n
            el.append(Paragraph(f"• {txt}", styles["Body2"]))

    # Recommended actions
    el.append(Paragraph("Recommended Actions", styles["Sec"]))
    for a in analysis.get("recommended_actions", []):
        el.append(Paragraph(f"• {a}", styles["Body2"]))

    el.append(Spacer(1, 16))
    el.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e2e8f0")))
    gen = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    el.append(Paragraph(f"Generated by: <b>{analyst_name}</b> &nbsp;|&nbsp; Date: {gen}", styles["Sub"]))
    el.append(Paragraph("CONFIDENTIAL — For authorised security personnel only. Prototype system; no real employees are monitored.", styles["Sub"]))

    doc.build(el)
    buf.seek(0)
    return buf
