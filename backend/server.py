from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import io
import csv
import random
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from bson import ObjectId
import pandas as pd

import auth as authlib
from ml_engine_v2 import run_analysis, risk_level, FEATURE_COLUMNS
from seed import generate_dataset, build_csv_template, generate_monthly_incidents
from pdf_report import generate_incident_report

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="CaughtIn4K API")
api = APIRouter(prefix="/api")
logger = logging.getLogger("insiderguard")
logging.basicConfig(level=logging.INFO)

DEFAULT_SETTINGS = {
    "_id": "global",
    "risk_thresholds": {"medium": 31, "high": 61, "critical": 81},
    "working_hours": {"start": 8, "end": 19},
    "departments": ["Finance", "Engineering", "HR", "Sales", "IT", "Legal", "Marketing", "Operations"],
    "session_timeout_minutes": 720,
    "password_policy": {"min_length": 8, "require_number": True, "require_symbol": True},
    "email_notifications": True,
    "alert_severity_enabled": {"Critical": True, "High": True, "Medium": True, "Low": False},
}


# ---------------- Models ----------------
class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "analyst"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    password: str


class UserCreateIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "analyst"


class UserUpdateIn(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None


class AlertUpdateIn(BaseModel):
    status: Optional[str] = None
    assigned_analyst: Optional[str] = None
    note: Optional[str] = None


class InvestigationCreateIn(BaseModel):
    employee_id: str
    analyst: Optional[str] = None
    priority: str = "Medium"


class InvestigationUpdateIn(BaseModel):
    status: Optional[str] = None
    note: Optional[str] = None
    false_positive: Optional[bool] = None
    evidence: Optional[str] = None


# ---------------- Auth dependency ----------------
async def current_user(request: Request):
    return await authlib.get_current_user(request, db)


async def require_admin(request: Request):
    user = await authlib.get_current_user(request, db)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Administrator access required")
    return user


def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=43200, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=604800, path="/")


async def log_audit(action: str, user_email: str, detail: str = ""):
    await db.system_logs.insert_one({
        "action": action, "user": user_email, "detail": detail,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


async def create_notification(ntype: str, message: str, severity: str = "info"):
    await db.notifications.insert_one({
        "type": ntype, "message": message, "severity": severity, "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


# ---------------- Analysis pipeline ----------------
async def perform_analysis(triggered_by: str = "system"):
    logs = await db.activity_logs.find({}, {"_id": 0}).to_list(500000)
    if not logs:
        return {"analyzed": 0}
    # ground-truth insider labels from seed (used for honest ML evaluation)
    gt_docs = await db.employees.find({}, {"_id": 0, "employee_id": 1, "_is_insider": 1}).to_list(100000)
    ground_truth = {d["employee_id"]: 1 if d.get("_is_insider") else 0 for d in gt_docs}
    results, evaluation, feat_records = run_analysis(logs, ground_truth=ground_truth)

    settings = await db.settings.find_one({"_id": "global"}) or DEFAULT_SETTINGS
    th = settings["risk_thresholds"]

    for r in results:
        await db.employees.update_one(
            {"employee_id": r["employee_id"]},
            {"$set": {
                "risk_score": r["risk_score"],
                "risk_level": r["risk_level"],
                "anomaly_score": r["anomaly_score"],
                "features": r["features"],
                "reasons": r["reasons"],
                "evidence": r["evidence"],
                "recommended_actions": r["recommended_actions"],
                "last_analyzed": datetime.now(timezone.utc).isoformat(),
            }},
        )

    # regenerate open alerts (keep those tied to investigations)
    await db.alerts.delete_many({"status": "Open"})
    await generate_alerts(results, th)

    if evaluation:
        evaluation["_id"] = "latest"
        evaluation["generated_at"] = datetime.now(timezone.utc).isoformat()
        await db.model_results.replace_one({"_id": "latest"}, evaluation, upsert=True)

    await create_notification("analysis", f"Analysis complete: {len(results)} employees scored", "info")
    await log_audit("run_analysis", triggered_by, f"{len(results)} employees analyzed")
    return {"analyzed": len(results)}


async def generate_alerts(results, thresholds):
    emp_map = {e["employee_id"]: e for e in await db.employees.find({}, {"_id": 0}).to_list(100000)}
    counter = await db.alerts.count_documents({})
    now = datetime.now(timezone.utc).isoformat()
    to_insert = []

    def mk(emp, severity, desc, reason, evidence):
        nonlocal counter
        counter += 1
        return {
            "alert_id": f"ALT-{5000 + counter}",
            "employee_id": emp["employee_id"],
            "employee_name": emp_map.get(emp["employee_id"], {}).get("name", emp["employee_id"]),
            "department": emp.get("department", "-"),
            "severity": severity,
            "time": now,
            "description": desc,
            "reason": reason,
            "evidence": evidence,
            "status": "Open",
            "assigned_analyst": None,
            "notes": [],
        }

    for r in results:
        f = r["features"]
        sev_for_score = r["risk_level"]
        if r["risk_score"] >= thresholds["critical"]:
            to_insert.append(mk(r, "Critical", "Critical insider-threat risk detected", r["reasons"], r["evidence"]))
            await create_notification("alert", f"CRITICAL: {emp_map.get(r['employee_id'],{}).get('name', r['employee_id'])} risk score {r['risk_score']}", "critical")
        elif r["risk_score"] >= thresholds["high"]:
            to_insert.append(mk(r, "High", "High insider-threat risk detected", r["reasons"], r["evidence"]))
        if f.get("max_downloads", 0) >= 300:
            to_insert.append(mk(r, "High", "Excessive file downloads detected", [f"Peak {int(f['max_downloads'])} downloads in one session"], r["evidence"]))
        if f.get("total_failed_logins", 0) >= 5:
            to_insert.append(mk(r, "Medium", "Multiple failed login attempts", [f"{int(f['total_failed_logins'])} failed logins"], []))
        if f.get("usb_usage_count", 0) >= 2:
            to_insert.append(mk(r, "Medium", "Unauthorised USB device usage", [f"{int(f['usb_usage_count'])} USB insertions"], []))
        if f.get("restricted_access_count", 0) >= 1 and r["risk_score"] >= thresholds["medium"]:
            to_insert.append(mk(r, "High", "Restricted folder access", [f"{int(f['restricted_access_count'])} restricted access events"], []))
        if f.get("external_email_ratio", 0) >= 0.45:
            to_insert.append(mk(r, "Medium", "Unusual external email activity", [f"{int(f['external_email_ratio']*100)}% external email ratio"], []))

    if to_insert:
        await db.alerts.insert_many(to_insert)


# ---------------- Startup ----------------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.login_attempts.create_index("identifier")
    await db.employees.create_index("employee_id", unique=True)
    await db.activity_logs.create_index("employee_id")

    # seed settings
    if not await db.settings.find_one({"_id": "global"}):
        await db.settings.insert_one(dict(DEFAULT_SETTINGS))

    # seed users
    for email_key, pw_key, name, role in [
        ("ADMIN_EMAIL", "ADMIN_PASSWORD", "Sarah Chen", "admin"),
        ("ANALYST_EMAIL", "ANALYST_PASSWORD", "Marcus Reid", "analyst"),
    ]:
        email = os.environ.get(email_key)
        pw = os.environ.get(pw_key)
        if not email:
            continue
        existing = await db.users.find_one({"email": email})
        if existing is None:
            await db.users.insert_one({
                "email": email, "password_hash": authlib.hash_password(pw),
                "name": name, "role": role, "status": "Active",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        elif not authlib.verify_password(pw, existing["password_hash"]):
            await db.users.update_one({"email": email}, {"$set": {"password_hash": authlib.hash_password(pw)}})

    # seed simulated dataset + analysis
    if await db.employees.count_documents({}) == 0:
        logger.info("Seeding simulated dataset...")
        employees, logs = generate_dataset()
        await db.employees.insert_many(employees)
        # chunk insert logs
        for i in range(0, len(logs), 2000):
            await db.activity_logs.insert_many(logs[i:i + 2000])
        await perform_analysis("seed")
        await create_notification("upload", f"Simulated dataset loaded: {len(employees)} employees, {len(logs)} activity logs", "info")
        logger.info("Seed complete.")

    # seed historical monthly incidents (escalating trend)
    if await db.security_incidents.count_documents({}) == 0:
        await db.security_incidents.insert_many(generate_monthly_incidents())


@app.on_event("shutdown")
async def shutdown():
    client.close()


# ================= AUTH =================
@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "email": email, "password_hash": authlib.hash_password(body.password),
        "name": body.name, "role": body.role if body.role in ("admin", "analyst") else "analyst",
        "status": "Active", "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.users.insert_one(doc)
    uid = str(res.inserted_id)
    set_auth_cookies(response, authlib.create_access_token(uid, email, doc["role"]), authlib.create_refresh_token(uid))
    return {"id": uid, "email": email, "name": doc["name"], "role": doc["role"]}


@api.post("/auth/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.lower()
    ip = request.client.host if request.client else "unknown"
    ident = f"{ip}:{email}"
    attempt = await db.login_attempts.find_one({"identifier": ident})
    if attempt and attempt.get("count", 0) >= 5:
        locked_until = attempt.get("locked_until")
        if locked_until and datetime.fromisoformat(locked_until) > datetime.now(timezone.utc):
            raise HTTPException(status_code=429, detail="Too many attempts. Try again in 15 minutes.")

    user = await db.users.find_one({"email": email})
    if not user or not authlib.verify_password(body.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": ident},
            {"$inc": {"count": 1}, "$set": {"locked_until": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")

    await db.login_attempts.delete_one({"identifier": ident})
    uid = str(user["_id"])
    set_auth_cookies(response, authlib.create_access_token(uid, email, user["role"]), authlib.create_refresh_token(uid))
    await log_audit("login", email, "successful login")
    return {"id": uid, "email": email, "name": user["name"], "role": user["role"]}


@api.post("/auth/logout")
async def logout(response: Response, user=Depends(current_user)):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out"}


@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return user


@api.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = authlib.decode_token(token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        access = authlib.create_access_token(str(user["_id"]), user["email"], user["role"])
        response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=43200, path="/")
        return {"message": "refreshed"}
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


@api.post("/auth/forgot-password")
async def forgot(body: ForgotIn):
    import secrets
    user = await db.users.find_one({"email": body.email.lower()})
    if user:
        token = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({
            "token": token, "email": body.email.lower(), "used": False,
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
        })
        logger.info(f"[PASSWORD RESET] Link: /reset-password?token={token}")
    return {"message": "If an account exists, a reset link has been generated (check server logs)."}


@api.post("/auth/reset-password")
async def reset(body: ResetIn):
    rec = await db.password_reset_tokens.find_one({"token": body.token})
    if not rec or rec.get("used"):
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    await db.users.update_one({"email": rec["email"]}, {"$set": {"password_hash": authlib.hash_password(body.password)}})
    await db.password_reset_tokens.update_one({"token": body.token}, {"$set": {"used": True}})
    return {"message": "Password reset successful"}


# ================= DASHBOARD =================
@api.get("/dashboard/stats")
async def dashboard_stats(user=Depends(current_user)):
    employees = await db.employees.find({}, {"_id": 0}).to_list(100000)
    total_logs = await db.activity_logs.count_documents({})
    scores = [e.get("risk_score", 0) for e in employees if "risk_score" in e]
    levels = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0}
    for e in employees:
        levels[e.get("risk_level", "Low")] = levels.get(e.get("risk_level", "Low"), 0) + 1
    critical_alerts = await db.alerts.count_documents({"severity": "Critical"})
    today = datetime.now(timezone.utc).date().isoformat()
    inv_today = await db.investigations.count_documents({"created_at": {"$regex": f"^{today}"}})
    active_inv = await db.investigations.count_documents({"status": {"$in": ["Open", "In Progress"]}})
    anomalies = sum(1 for e in employees if e.get("risk_level") in ("High", "Critical"))
    return {
        "total_employees": len(employees),
        "total_logs": total_logs,
        "critical_alerts": critical_alerts,
        "avg_risk_score": round(sum(scores) / len(scores), 1) if scores else 0,
        "investigations_today": inv_today,
        "anomalies_detected": anomalies,
        "high_risk": levels["Critical"] + levels["High"],
        "medium_risk": levels["Medium"],
        "low_risk": levels["Low"],
        "critical_risk": levels["Critical"],
        "active_investigations": active_inv,
        "risk_levels": levels,
    }


@api.get("/dashboard/charts")
async def dashboard_charts(user=Depends(current_user)):
    employees = await db.employees.find({}, {"_id": 0}).to_list(100000)
    logs = await db.activity_logs.find({}, {"_id": 0}).to_list(500000)

    # risk distribution buckets
    buckets = {"0-30 (Low)": 0, "31-60 (Medium)": 0, "61-80 (High)": 0, "81-100 (Critical)": 0}
    for e in employees:
        s = e.get("risk_score", 0)
        if s <= 30:
            buckets["0-30 (Low)"] += 1
        elif s <= 60:
            buckets["31-60 (Medium)"] += 1
        elif s <= 80:
            buckets["61-80 (High)"] += 1
        else:
            buckets["81-100 (Critical)"] += 1
    risk_distribution = [{"range": k, "count": v} for k, v in buckets.items()]

    # department risk
    dept = {}
    for e in employees:
        d = e.get("department", "Other")
        dept.setdefault(d, []).append(e.get("risk_score", 0))
    dept_risk = [{"department": k, "avg_risk": round(sum(v) / len(v), 1), "employees": len(v)} for k, v in dept.items()]
    dept_risk.sort(key=lambda x: x["avg_risk"], reverse=True)

    # login time analysis (hour histogram) + daily suspicious + usb/download/email
    hours = {h: 0 for h in range(24)}
    daily = {}
    usb_daily = {}
    download_daily = {}
    email_daily = {}
    for l in logs:
        try:
            dt = datetime.fromisoformat(str(l["login_time"]))
            hours[dt.hour] += 1
            day = dt.date().isoformat()
        except Exception:
            continue
        suspicious = int(l.get("restricted_access", 0)) + (1 if (dt.hour < 8 or dt.hour >= 19) else 0) + (1 if l.get("downloads", 0) > 300 else 0)
        daily[day] = daily.get(day, 0) + (1 if suspicious > 0 else 0)
        usb_daily[day] = usb_daily.get(day, 0) + int(l.get("usb_connected", 0))
        download_daily[day] = download_daily.get(day, 0) + int(l.get("downloads", 0))
        email_daily[day] = email_daily.get(day, 0) + int(l.get("external_emails", 0))

    login_time = [{"hour": f"{h:02d}:00", "logins": hours[h]} for h in range(24)]
    days_sorted = sorted(daily.keys())[-14:]
    daily_suspicious = [{"date": d[5:], "count": daily[d]} for d in days_sorted]
    usb_trend = [{"date": d[5:], "usb": usb_daily.get(d, 0)} for d in days_sorted]
    download_trend = [{"date": d[5:], "downloads": download_daily.get(d, 0)} for d in days_sorted]
    email_trend = [{"date": d[5:], "external": email_daily.get(d, 0)} for d in days_sorted]

    # monthly security incidents (historical + live current-month from employee risk tiers)
    monthly = await db.security_incidents.find({}, {"_id": 0}).sort("sort", 1).to_list(24)
    if monthly:
        live = {"Critical": 0, "High": 0, "Medium": 0}
        for e in employees:
            lvl = e.get("risk_level")
            if lvl in live:
                live[lvl] += 1
        last = monthly[-1]
        last["critical"] = max(last.get("critical", 0), live["Critical"])
        last["high"] = max(last.get("high", 0), live["High"])
        last["medium"] = max(last.get("medium", 0), live["Medium"])
        last["total"] = last["critical"] + last["high"] + last["medium"]
    monthly_incidents = [{"month": m["month"], "critical": m["critical"], "high": m["high"],
                          "medium": m["medium"], "total": m["total"]} for m in monthly]

    return {
        "risk_distribution": risk_distribution,
        "department_risk": dept_risk,
        "login_time": login_time,
        "daily_suspicious": daily_suspicious,
        "usb_trend": usb_trend,
        "download_trend": download_trend,
        "email_trend": email_trend,
        "monthly_incidents": monthly_incidents,
    }


# ================= EMPLOYEES =================
@api.get("/employees")
async def list_employees(user=Depends(current_user), search: str = "", department: str = "",
                         risk_level: str = "", status: str = ""):
    query = {}
    if department:
        query["department"] = department
    if risk_level:
        query["risk_level"] = risk_level
    if status:
        query["status"] = status
    if search:
        query["$or"] = [
            {"employee_id": {"$regex": search, "$options": "i"}},
            {"name": {"$regex": search, "$options": "i"}},
            {"department": {"$regex": search, "$options": "i"}},
        ]
    emps = await db.employees.find(query, {"_id": 0}).to_list(100000)
    # attach investigation status
    invs = {i["employee_id"]: i for i in await db.investigations.find({"status": {"$ne": "Closed"}}, {"_id": 0}).to_list(100000)}
    for e in emps:
        e.pop("_is_insider", None)
        inv = invs.get(e["employee_id"])
        e["current_investigation"] = inv["investigation_id"] if inv else None
        e["investigation_status"] = inv["status"] if inv else "None"
    emps.sort(key=lambda x: x.get("risk_score", 0), reverse=True)
    return emps


@api.get("/employees/{employee_id}")
async def get_employee(employee_id: str, user=Depends(current_user)):
    emp = await db.employees.find_one({"employee_id": employee_id}, {"_id": 0})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    emp.pop("_is_insider", None)
    logs = await db.activity_logs.find({"employee_id": employee_id}, {"_id": 0}).to_list(5000)
    logs.sort(key=lambda x: str(x.get("login_time", "")), reverse=True)

    # risk timeline / history from logs (per-day derived risk contribution)
    risk_history = []
    by_day = {}
    for l in logs:
        try:
            day = datetime.fromisoformat(str(l["login_time"])).date().isoformat()
        except Exception:
            continue
        hour = datetime.fromisoformat(str(l["login_time"])).hour
        contrib = min(100, int(l.get("downloads", 0) / 15) + (25 if (hour < 8 or hour >= 19) else 0)
                      + (20 if l.get("restricted_access") else 0) + (15 if l.get("usb_connected") else 0)
                      + int(l.get("failed_logins", 0)) * 3)
        by_day.setdefault(day, []).append(contrib)
    for day in sorted(by_day.keys()):
        risk_history.append({"date": day[5:], "score": min(100, int(sum(by_day[day]) / len(by_day[day])))})

    # device & usb & suspicious events
    devices = {}
    suspicious_events = []
    for l in logs:
        devices[l.get("device", "-")] = devices.get(l.get("device", "-"), 0) + 1
        try:
            hour = datetime.fromisoformat(str(l["login_time"])).hour
        except Exception:
            hour = 9
        if hour < 8 or hour >= 19:
            suspicious_events.append({"time": str(l["login_time"])[:19], "event": f"Off-hours login at {hour:02d}:00", "type": "login"})
        if l.get("downloads", 0) > 300:
            suspicious_events.append({"time": str(l["login_time"])[:19], "event": f"Downloaded {int(l['downloads'])} files", "type": "download"})
        if l.get("restricted_access"):
            suspicious_events.append({"time": str(l["login_time"])[:19], "event": "Accessed restricted folder", "type": "access"})
        if l.get("usb_connected"):
            suspicious_events.append({"time": str(l["login_time"])[:19], "event": "USB device connected", "type": "usb"})
    suspicious_events = suspicious_events[:25]

    alerts = await db.alerts.find({"employee_id": employee_id}, {"_id": 0}).to_list(100)
    inv = await db.investigations.find_one({"employee_id": employee_id, "status": {"$ne": "Closed"}}, {"_id": 0})

    return {
        "employee": emp,
        "recent_activities": logs[:20],
        "risk_history": risk_history,
        "device_history": [{"device": k, "count": v} for k, v in devices.items()],
        "suspicious_events": suspicious_events,
        "alerts": alerts,
        "investigation": inv,
    }


# ================= UPLOAD =================
@api.get("/upload/template")
async def csv_template(user=Depends(current_user)):
    content = build_csv_template()
    return StreamingResponse(io.BytesIO(content.encode()), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=caughtinfourk_template.csv"})


REQUIRED_COLS = ["employee_id", "department", "login_time", "logout_time", "downloads", "uploads",
                 "usb_connected", "external_emails", "internal_emails", "failed_logins",
                 "restricted_access", "vpn_usage"]


@api.post("/upload/logs")
async def upload_logs(file: UploadFile = File(...), user=Depends(current_user)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    raw = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(raw))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {e}")

    original_rows = len(df)
    missing_cols = [c for c in REQUIRED_COLS if c not in df.columns]
    if missing_cols:
        raise HTTPException(status_code=400, detail=f"Missing required columns: {', '.join(missing_cols)}")

    # ---- Data cleaning ----
    dupes = int(df.duplicated().sum())
    df = df.drop_duplicates()
    missing_before = int(df.isnull().sum().sum())
    numeric = ["downloads", "uploads", "usb_connected", "external_emails", "internal_emails",
               "failed_logins", "restricted_access", "vpn_usage"]
    for c in numeric:
        df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0)
        df[c] = df[c].clip(lower=0)  # remove impossible negatives
    for c in ["login_location", "device", "ip_address", "website_category"]:
        if c not in df.columns:
            df[c] = "Unknown"
        df[c] = df[c].fillna("Unknown")
    df = df.dropna(subset=["employee_id", "login_time"])
    invalid_ids = int((~df["employee_id"].astype(str).str.match(r".+")).sum())
    if "date" not in df.columns:
        df["date"] = df["login_time"]
    df["employee_id"] = df["employee_id"].astype(str)

    records = df.to_dict("records")
    cleaned_rows = len(records)

    # insert logs
    for i in range(0, len(records), 2000):
        await db.activity_logs.insert_many(records[i:i + 2000])

    # ensure employee docs exist
    from seed import AVATARS
    existing_ids = set(await db.employees.distinct("employee_id"))
    new_emps = []
    for eid in df["employee_id"].unique():
        if eid not in existing_ids:
            dept = str(df[df["employee_id"] == eid]["department"].iloc[0])
            new_emps.append({
                "employee_id": eid, "name": eid, "department": dept,
                "avatar": random.choice(AVATARS), "email": f"{eid.lower()}@insiderguard.io",
                "title": "Employee", "join_date": datetime.now(timezone.utc).isoformat(),
                "status": "Active", "last_login": str(df[df["employee_id"] == eid]["login_time"].iloc[-1]),
            })
    if new_emps:
        await db.employees.insert_many(new_emps)

    await create_notification("upload", f"{file.filename}: {cleaned_rows} logs processed by {user['name']}", "info")
    await log_audit("upload_logs", user["email"], f"{file.filename} ({cleaned_rows} rows)")

    result = await perform_analysis(user["email"])

    return {
        "filename": file.filename,
        "quality_report": {
            "original_rows": original_rows,
            "duplicates_removed": dupes,
            "missing_values_found": missing_before,
            "invalid_ids_found": invalid_ids,
            "cleaned_rows": cleaned_rows,
            "new_employees": len(new_emps),
        },
        "analyzed_employees": result.get("analyzed", 0),
    }


@api.post("/analysis/run")
async def run_analysis_endpoint(user=Depends(current_user)):
    return await perform_analysis(user["email"])


# ================= ALERTS =================
@api.get("/alerts")
async def list_alerts(user=Depends(current_user), severity: str = "", status: str = "", search: str = ""):
    query = {}
    if severity:
        query["severity"] = severity
    if status:
        query["status"] = status
    if search:
        query["$or"] = [
            {"alert_id": {"$regex": search, "$options": "i"}},
            {"employee_name": {"$regex": search, "$options": "i"}},
            {"employee_id": {"$regex": search, "$options": "i"}},
        ]
    alerts = await db.alerts.find(query, {"_id": 0}).to_list(2000)
    order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
    alerts.sort(key=lambda a: order.get(a.get("severity"), 4))
    return alerts


@api.get("/alerts/stream")
async def alert_stream(since: str = "", user=Depends(current_user)):
    """Return critical alert notifications created after `since` (ISO ts) for the live feed."""
    q = {"severity": "critical", "type": "alert"}
    if since:
        q["created_at"] = {"$gt": since}
    notes = await db.notifications.find(q, {"_id": 0}).sort("created_at", -1).to_list(20)
    now = datetime.now(timezone.utc).isoformat()
    return {"new_critical": notes, "server_time": now}


@api.patch("/alerts/{alert_id}")
async def update_alert(alert_id: str, body: AlertUpdateIn, user=Depends(current_user)):
    update = {}
    if body.status:
        update["status"] = body.status
    if body.assigned_analyst is not None:
        update["assigned_analyst"] = body.assigned_analyst
    ops = {"$set": update} if update else {}
    if body.note:
        note = {"text": body.note, "author": user["name"], "time": datetime.now(timezone.utc).isoformat()}
        ops["$push"] = {"notes": note}
    if not ops:
        raise HTTPException(status_code=400, detail="Nothing to update")
    res = await db.alerts.update_one({"alert_id": alert_id}, ops)
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    await log_audit("update_alert", user["email"], alert_id)
    return await db.alerts.find_one({"alert_id": alert_id}, {"_id": 0})


# ================= INVESTIGATIONS =================
@api.get("/investigations")
async def list_investigations(user=Depends(current_user), status: str = "", search: str = ""):
    query = {}
    if status:
        query["status"] = status
    if search:
        query["$or"] = [
            {"investigation_id": {"$regex": search, "$options": "i"}},
            {"employee_id": {"$regex": search, "$options": "i"}},
            {"employee_name": {"$regex": search, "$options": "i"}},
        ]
    invs = await db.investigations.find(query, {"_id": 0}).to_list(2000)
    invs.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return invs


@api.post("/investigations")
async def create_investigation(body: InvestigationCreateIn, user=Depends(current_user)):
    emp = await db.employees.find_one({"employee_id": body.employee_id}, {"_id": 0})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    existing = await db.investigations.find_one({"employee_id": body.employee_id, "status": {"$ne": "Closed"}})
    if existing:
        raise HTTPException(status_code=400, detail="An open investigation already exists for this employee")
    count = await db.investigations.count_documents({})
    now = datetime.now(timezone.utc).isoformat()
    analyst = body.analyst or user["name"]
    inv = {
        "investigation_id": f"INV-{3000 + count + 1}",
        "employee_id": body.employee_id,
        "employee_name": emp.get("name"),
        "department": emp.get("department"),
        "risk_score": emp.get("risk_score", 0),
        "analyst": analyst,
        "priority": body.priority,
        "status": "Open",
        "false_positive": False,
        "notes": [],
        "evidence": [],
        "history": [{"action": "Investigation opened", "by": user["name"], "time": now}],
        "created_at": now,
        "updated_at": now,
    }
    await db.investigations.insert_one(inv)
    await db.employees.update_one({"employee_id": body.employee_id}, {"$set": {"status": "Under Investigation"}})
    await create_notification("investigation", f"Investigation {inv['investigation_id']} assigned to {analyst}", "info")
    await log_audit("create_investigation", user["email"], inv["investigation_id"])
    inv.pop("_id", None)
    return inv


@api.patch("/investigations/{investigation_id}")
async def update_investigation(investigation_id: str, body: InvestigationUpdateIn, user=Depends(current_user)):
    inv = await db.investigations.find_one({"investigation_id": investigation_id})
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")
    now = datetime.now(timezone.utc).isoformat()
    ops = {"$set": {"updated_at": now}, "$push": {}}
    history = []
    if body.status:
        ops["$set"]["status"] = body.status
        history.append({"action": f"Status changed to {body.status}", "by": user["name"], "time": now})
        if body.status == "Closed":
            await db.employees.update_one({"employee_id": inv["employee_id"]}, {"$set": {"status": "Active"}})
    if body.false_positive is not None:
        ops["$set"]["false_positive"] = body.false_positive
        history.append({"action": f"Marked {'false positive' if body.false_positive else 'true positive'}", "by": user["name"], "time": now})
    if body.note:
        ops["$push"]["notes"] = {"text": body.note, "author": user["name"], "time": now}
    if body.evidence:
        ops["$push"]["evidence"] = {"detail": body.evidence, "author": user["name"], "time": now}
    if history:
        ops["$push"]["history"] = {"$each": history}
    if not ops["$push"]:
        del ops["$push"]
    await db.investigations.update_one({"investigation_id": investigation_id}, ops)
    await log_audit("update_investigation", user["email"], investigation_id)
    return await db.investigations.find_one({"investigation_id": investigation_id}, {"_id": 0})


# ================= REPORTS =================
@api.get("/reports")
async def list_reports(user=Depends(current_user)):
    reports = await db.reports.find({}, {"_id": 0}).to_list(1000)
    reports.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return reports


@api.post("/reports/generate/{employee_id}")
async def generate_report(employee_id: str, user=Depends(current_user)):
    emp = await db.employees.find_one({"employee_id": employee_id}, {"_id": 0})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    count = await db.reports.count_documents({})
    now = datetime.now(timezone.utc).isoformat()
    report = {
        "report_id": f"RPT-{7000 + count + 1}",
        "employee_id": employee_id,
        "employee_name": emp.get("name"),
        "department": emp.get("department"),
        "risk_score": emp.get("risk_score", 0),
        "risk_level": emp.get("risk_level", "Low"),
        "analyst": user["name"],
        "created_at": now,
    }
    await db.reports.insert_one(dict(report))
    await create_notification("report", f"Report {report['report_id']} generated for {emp.get('name')}", "info")
    await log_audit("generate_report", user["email"], report["report_id"])
    return report


@api.get("/reports/download/{employee_id}")
async def download_report(employee_id: str, user=Depends(current_user)):
    emp = await db.employees.find_one({"employee_id": employee_id}, {"_id": 0})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    analysis = {
        "risk_score": emp.get("risk_score", 0),
        "risk_level": emp.get("risk_level", "Low"),
        "reasons": emp.get("reasons", []),
        "evidence": emp.get("evidence", []),
        "recommended_actions": emp.get("recommended_actions", []),
    }
    alerts = await db.alerts.find({"employee_id": employee_id}, {"_id": 0}).to_list(100)
    inv = await db.investigations.find_one({"employee_id": employee_id}, {"_id": 0})
    pdf = generate_incident_report(emp, analysis, alerts, inv, user["name"])
    await log_audit("download_report", user["email"], employee_id)
    return StreamingResponse(pdf, media_type="application/pdf",
                             headers={"Content-Disposition": f"attachment; filename=incident_{employee_id}.pdf"})


# ================= ANALYTICS / ML =================
@api.get("/analytics/model")
async def model_results(user=Depends(current_user)):
    res = await db.model_results.find_one({"_id": "latest"}, {"_id": 0})
    return res or {}


@api.get("/analytics/overview")
async def analytics_overview(user=Depends(current_user)):
    employees = await db.employees.find({}, {"_id": 0}).to_list(100000)
    logs = await db.activity_logs.find({}, {"_id": 0}).to_list(500000)

    dept = {}
    for e in employees:
        d = e.get("department", "Other")
        dept.setdefault(d, []).append(e.get("risk_score", 0))
    top_depts = sorted([{"department": k, "avg_risk": round(sum(v) / len(v), 1)} for k, v in dept.items()],
                       key=lambda x: x["avg_risk"], reverse=True)

    # common threats from alerts
    alerts = await db.alerts.find({}, {"_id": 0}).to_list(5000)
    threat_counts = {}
    for a in alerts:
        threat_counts[a["description"]] = threat_counts.get(a["description"], 0) + 1
    common_threats = sorted([{"threat": k, "count": v} for k, v in threat_counts.items()],
                            key=lambda x: x["count"], reverse=True)[:8]

    # login heatmap (day of week x hour bucket)
    heat = {}
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    for l in logs:
        try:
            dt = datetime.fromisoformat(str(l["login_time"]))
            key = f"{days[dt.weekday()]}"
            heat.setdefault(key, [0] * 6)
            heat[key][min(5, dt.hour // 4)] += 1
        except Exception:
            continue
    heatmap = []
    for d in days:
        row = heat.get(d, [0] * 6)
        heatmap.append({"day": d, "b0": row[0], "b1": row[1], "b2": row[2], "b3": row[3], "b4": row[4], "b5": row[5]})

    total_downloads = sum(int(l.get("downloads", 0)) for l in logs)
    total_usb = sum(int(l.get("usb_connected", 0)) for l in logs)
    total_external = sum(int(l.get("external_emails", 0)) for l in logs)

    fp = await db.investigations.count_documents({"false_positive": True})
    total_inv = await db.investigations.count_documents({})
    fp_rate = round(fp / total_inv * 100, 1) if total_inv else 0

    return {
        "top_departments": top_depts,
        "common_threats": common_threats,
        "login_heatmap": heatmap,
        "usb_total": total_usb,
        "download_total": total_downloads,
        "external_email_total": total_external,
        "false_positive_rate": fp_rate,
        "total_investigations": total_inv,
    }


# ================= NOTIFICATIONS =================
@api.get("/notifications")
async def list_notifications(user=Depends(current_user)):
    notes = await db.notifications.find({}).sort("created_at", -1).to_list(100)

    for n in notes:
        n["id"] = str(n["_id"])
        n.pop("_id", None)

    unread = await db.notifications.count_documents({"read": False})

    return {
        "notifications": notes,
        "unread": unread
    }


@api.delete("/notifications/{notification_id}")
async def delete_notification(
    notification_id: str,
    user=Depends(current_user)
):
    try:
        oid = ObjectId(notification_id)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid notification ID"
        )

    result = await db.notifications.delete_one({"_id": oid})

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Notification not found"
        )

    return {"message": "Notification deleted"}

@api.post("/notifications/read-all")
async def read_all(user=Depends(current_user)):
    await db.notifications.update_many({"read": False}, {"$set": {"read": True}})
    return {"message": "All marked read"}


# ================= USER MANAGEMENT (admin) =================
@api.get("/users")
async def list_users(user=Depends(require_admin)):
    users = await db.users.find({}, {"password_hash": 0}).to_list(1000)
    for u in users:
        u["id"] = str(u["_id"])
        u.pop("_id", None)
    return users


@api.post("/users")
async def create_user(body: UserCreateIn, admin=Depends(require_admin)):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "email": email, "password_hash": authlib.hash_password(body.password),
        "name": body.name, "role": body.role if body.role in ("admin", "analyst") else "analyst",
        "status": "Active", "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.users.insert_one(doc)
    await log_audit("create_user", admin["email"], email)
    return {"id": str(res.inserted_id), "email": email, "name": doc["name"], "role": doc["role"], "status": "Active"}


def parse_oid(user_id: str) -> ObjectId:
    try:
        return ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user id")


@api.patch("/users/{user_id}")
async def update_user(user_id: str, body: UserUpdateIn, admin=Depends(require_admin)):
    oid = parse_oid(user_id)
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    res = await db.users.update_one({"_id": oid}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    await log_audit("update_user", admin["email"], user_id)
    u = await db.users.find_one({"_id": oid}, {"password_hash": 0})
    u["id"] = str(u["_id"]); u.pop("_id", None)
    return u


@api.delete("/users/{user_id}")
async def delete_user(user_id: str, admin=Depends(require_admin)):
    oid = parse_oid(user_id)
    if str(admin.get("id")) == user_id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    res = await db.users.delete_one({"_id": oid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    await log_audit("delete_user", admin["email"], user_id)
    return {"message": "User removed"}


# ================= SETTINGS =================
@api.get("/settings")
async def get_settings(user=Depends(current_user)):
    s = await db.settings.find_one({"_id": "global"})
    if s:
        s.pop("_id", None)
    return s or DEFAULT_SETTINGS


@api.put("/settings")
async def update_settings(body: dict, admin=Depends(require_admin)):
    body.pop("_id", None)
    await db.settings.update_one({"_id": "global"}, {"$set": body}, upsert=True)
    await log_audit("update_settings", admin["email"], "settings updated")
    s = await db.settings.find_one({"_id": "global"})
    s.pop("_id", None)
    return s


# ================= AUDIT LOGS =================
@api.get("/audit-logs")
async def audit_logs(admin=Depends(require_admin)):
    logs = await db.system_logs.find({}, {"_id": 0}).sort("timestamp", -1).to_list(200)
    return logs


# ================= GLOBAL SEARCH =================
@api.get("/search")
async def global_search(q: str, user=Depends(current_user)):
    q = q.strip()
    if not q:
        return {"employees": [], "alerts": [], "investigations": []}
    rx = {"$regex": q, "$options": "i"}
    employees = await db.employees.find(
        {"$or": [{"employee_id": rx}, {"name": rx}, {"department": rx}, {"risk_level": rx}]},
        {"_id": 0, "employee_id": 1, "name": 1, "department": 1, "risk_score": 1, "risk_level": 1},
    ).to_list(10)
    alerts = await db.alerts.find(
        {"$or": [{"alert_id": rx}, {"employee_name": rx}, {"severity": rx}]},
        {"_id": 0, "alert_id": 1, "employee_name": 1, "severity": 1, "description": 1},
    ).to_list(10)
    investigations = await db.investigations.find(
        {"$or": [{"investigation_id": rx}, {"employee_name": rx}]},
        {"_id": 0, "investigation_id": 1, "employee_name": 1, "status": 1},
    ).to_list(10)
    return {"employees": employees, "alerts": alerts, "investigations": investigations}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
