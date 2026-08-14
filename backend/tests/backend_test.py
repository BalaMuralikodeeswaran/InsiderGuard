"""InsiderGuard backend regression tests.

Covers: auth (login/me/logout, forgot-pw, brute-force), dashboard, employees,
CSV upload/template, analysis re-run, alerts, investigations, reports (JSON + PDF),
analytics (ML metrics), notifications, user management (admin-only), settings
(admin-only), global search, RBAC 403 for analyst.
"""
import io
import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@insiderguard.io"
ADMIN_PASSWORD = "Admin@123"
ANALYST_EMAIL = "analyst@insiderguard.io"
ANALYST_PASSWORD = "Analyst@123"


# ---------------- fixtures ----------------
def _login(email, password):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return s, r.json()


@pytest.fixture(scope="module")
def admin_session():
    s, user = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    assert user["role"] == "admin"
    yield s
    try:
        s.post(f"{API}/auth/logout", timeout=10)
    except Exception:
        pass


@pytest.fixture(scope="module")
def analyst_session():
    s, user = _login(ANALYST_EMAIL, ANALYST_PASSWORD)
    assert user["role"] == "analyst"
    yield s
    try:
        s.post(f"{API}/auth/logout", timeout=10)
    except Exception:
        pass


# ---------------- Auth ----------------
class TestAuth:
    def test_login_admin_sets_httponly_cookies(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"
        # jar contains access + refresh cookies
        names = {c.name for c in s.cookies}
        assert "access_token" in names
        assert "refresh_token" in names

    def test_login_analyst(self):
        s, data = _login(ANALYST_EMAIL, ANALYST_PASSWORD)
        assert data["role"] == "analyst"

    def test_login_bad_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=10)
        assert r.status_code == 401

    def test_me_returns_user(self, admin_session):
        r = admin_session.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 200
        u = r.json()
        assert u["email"] == ADMIN_EMAIL
        assert "password_hash" not in u

    def test_me_unauthenticated(self):
        r = requests.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 401

    def test_logout_clears_session(self):
        s, _ = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
        r = s.post(f"{API}/auth/logout", timeout=10)
        assert r.status_code == 200
        # after logout, cookies are cleared; me should 401
        r2 = s.get(f"{API}/auth/me", timeout=10)
        assert r2.status_code == 401

    def test_forgot_password_returns_generic_msg(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": ADMIN_EMAIL}, timeout=10)
        assert r.status_code == 200
        assert "message" in r.json()


# ---------------- Dashboard ----------------
class TestDashboard:
    def test_stats(self, admin_session):
        r = admin_session.get(f"{API}/dashboard/stats", timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ("total_employees", "total_logs", "critical_alerts", "avg_risk_score",
                  "investigations_today", "anomalies_detected", "risk_levels"):
            assert k in d, f"missing {k}"
        assert d["total_employees"] >= 40
        assert d["total_logs"] >= 500
        assert d["avg_risk_score"] > 0
        # risk_levels populated
        rl = d["risk_levels"]
        assert isinstance(rl, dict)
        assert (rl.get("Critical", 0) + rl.get("High", 0) + rl.get("Medium", 0) + rl.get("Low", 0)) == d["total_employees"]

    def test_charts(self, admin_session):
        r = admin_session.get(f"{API}/dashboard/charts", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert len(d["risk_distribution"]) == 4
        assert len(d["department_risk"]) > 0
        assert len(d["login_time"]) == 24


# ---------------- Employees ----------------
class TestEmployees:
    def test_list_sorted_desc(self, admin_session):
        r = admin_session.get(f"{API}/employees", timeout=30)
        assert r.status_code == 200
        emps = r.json()
        assert len(emps) >= 40
        scores = [e["risk_score"] for e in emps]
        assert scores == sorted(scores, reverse=True), "employees not sorted by risk_score desc"
        # all core keys
        assert all("employee_id" in e and "risk_level" in e for e in emps)

    def test_list_filter_risk_level(self, admin_session):
        r = admin_session.get(f"{API}/employees", params={"risk_level": "Critical"}, timeout=30)
        assert r.status_code == 200
        for e in r.json():
            assert e["risk_level"] == "Critical"

    def test_list_search(self, admin_session):
        r = admin_session.get(f"{API}/employees", params={"search": "EMP-1"}, timeout=30)
        assert r.status_code == 200
        assert all("EMP-1" in e["employee_id"] for e in r.json())

    def test_details_explainable(self, admin_session):
        emps = admin_session.get(f"{API}/employees", timeout=30).json()
        eid = emps[0]["employee_id"]
        r = admin_session.get(f"{API}/employees/{eid}", timeout=30)
        assert r.status_code == 200
        d = r.json()
        emp = d["employee"]
        assert emp["employee_id"] == eid
        # explainable AI fields
        assert isinstance(emp.get("reasons", []), list) and len(emp["reasons"]) > 0
        assert isinstance(emp.get("features", {}), dict) and len(emp["features"]) > 0
        assert isinstance(emp.get("recommended_actions", []), list) and len(emp["recommended_actions"]) > 0
        assert "risk_history" in d
        assert "suspicious_events" in d

    def test_details_404(self, admin_session):
        r = admin_session.get(f"{API}/employees/EMP-DOES-NOT-EXIST", timeout=10)
        assert r.status_code == 404


# ---------------- CSV upload + analysis ----------------
class TestUploadAndAnalysis:
    def test_template_download(self, admin_session):
        r = admin_session.get(f"{API}/upload/template", timeout=30)
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/csv")
        text = r.text
        assert "employee_id" in text and "login_time" in text and "downloads" in text

    def test_upload_csv_runs_analysis(self, admin_session):
        # build a small valid CSV with 2 employees using the template header
        header = ("employee_id,department,login_time,logout_time,login_location,device,ip_address,"
                  "downloads,uploads,usb_connected,external_emails,internal_emails,failed_logins,"
                  "restricted_access,website_category,vpn_usage,date")
        rows = [
            "EMP-TESTUPLOAD-1,Finance,2026-01-05T02:15:00,2026-01-05T11:40:00,Remote,LAP-1,10.0.0.1,1200,45,1,45,8,3,1,Cloud Storage,1,2026-01-05T02:15:00",
            "EMP-TESTUPLOAD-2,Sales,2026-01-05T09:15:00,2026-01-05T17:40:00,HQ,WKS-1,10.0.0.2,20,3,0,2,10,0,0,Business,0,2026-01-05T09:15:00",
        ]
        csv_bytes = ("\n".join([header] + rows) + "\n").encode()
        files = {"file": ("upload.csv", io.BytesIO(csv_bytes), "text/csv")}
        r = admin_session.post(f"{API}/upload/logs", files=files, timeout=120)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "quality_report" in d
        qr = d["quality_report"]
        assert qr["cleaned_rows"] >= 2
        assert d["analyzed_employees"] >= 2

    def test_upload_missing_columns_400(self, admin_session):
        csv_bytes = b"employee_id,login_time\nEMP-X,2026-01-05T09:00:00\n"
        files = {"file": ("bad.csv", io.BytesIO(csv_bytes), "text/csv")}
        r = admin_session.post(f"{API}/upload/logs", files=files, timeout=30)
        assert r.status_code == 400

    def test_analysis_rerun(self, admin_session):
        r = admin_session.post(f"{API}/analysis/run", timeout=120)
        assert r.status_code == 200
        assert r.json()["analyzed"] >= 40


# ---------------- Alerts ----------------
class TestAlerts:
    def test_list_and_severity_filter(self, admin_session):
        r = admin_session.get(f"{API}/alerts", timeout=30)
        assert r.status_code == 200
        alerts = r.json()
        assert isinstance(alerts, list) and len(alerts) > 0
        # sorted with Critical/High first
        order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
        pos = [order.get(a["severity"], 4) for a in alerts]
        assert pos == sorted(pos)

        r2 = admin_session.get(f"{API}/alerts", params={"severity": "Critical"}, timeout=30)
        for a in r2.json():
            assert a["severity"] == "Critical"

    def test_patch_alert_updates_status_and_appends_note(self, admin_session):
        alerts = admin_session.get(f"{API}/alerts", timeout=30).json()
        assert alerts, "no alerts"
        aid = alerts[0]["alert_id"]
        r = admin_session.patch(
            f"{API}/alerts/{aid}",
            json={"status": "Acknowledged", "note": "TEST_note_" + uuid.uuid4().hex[:6], "assigned_analyst": "Sarah Chen"},
            timeout=15,
        )
        assert r.status_code == 200
        updated = r.json()
        assert updated["status"] == "Acknowledged"
        assert updated["assigned_analyst"] == "Sarah Chen"
        assert any("TEST_note_" in n.get("text", "") for n in updated.get("notes", []))


# ---------------- Investigations, Reports ----------------
class TestInvestigationsAndReports:
    _emp_id = None
    _inv_id = None

    def test_create_investigation(self, admin_session):
        # pick an employee without an open investigation
        emps = admin_session.get(f"{API}/employees", timeout=30).json()
        target = next((e for e in emps if not e.get("current_investigation")), None)
        assert target is not None, "no employee free of investigation"
        TestInvestigationsAndReports._emp_id = target["employee_id"]

        r = admin_session.post(
            f"{API}/investigations",
            json={"employee_id": target["employee_id"], "priority": "High"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        inv = r.json()
        assert inv["employee_id"] == target["employee_id"]
        assert inv["status"] == "Open"
        TestInvestigationsAndReports._inv_id = inv["investigation_id"]

    def test_update_investigation(self, admin_session):
        inv_id = TestInvestigationsAndReports._inv_id
        assert inv_id
        r = admin_session.patch(
            f"{API}/investigations/{inv_id}",
            json={"status": "In Progress", "note": "TEST_findings", "evidence": "TEST_evidence"},
            timeout=15,
        )
        assert r.status_code == 200
        upd = r.json()
        assert upd["status"] == "In Progress"
        assert any("TEST_findings" in n.get("text", "") for n in upd.get("notes", []))
        assert any("TEST_evidence" in e.get("detail", "") for e in upd.get("evidence", []))

    def test_mark_false_positive_and_close(self, admin_session):
        inv_id = TestInvestigationsAndReports._inv_id
        r = admin_session.patch(
            f"{API}/investigations/{inv_id}",
            json={"false_positive": True, "status": "Closed"},
            timeout=15,
        )
        assert r.status_code == 200
        upd = r.json()
        assert upd["false_positive"] is True
        assert upd["status"] == "Closed"

    def test_generate_report_and_pdf(self, admin_session):
        emp_id = TestInvestigationsAndReports._emp_id
        r = admin_session.post(f"{API}/reports/generate/{emp_id}", timeout=30)
        assert r.status_code == 200
        rep = r.json()
        assert rep["employee_id"] == emp_id
        assert rep["report_id"].startswith("RPT-")

        # PDF download
        r2 = admin_session.get(f"{API}/reports/download/{emp_id}", timeout=60)
        assert r2.status_code == 200
        assert r2.headers["content-type"] == "application/pdf"
        body = r2.content
        assert body.startswith(b"%PDF"), "response is not a valid PDF"
        assert len(body) > 1000

    def test_list_reports(self, admin_session):
        r = admin_session.get(f"{API}/reports", timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list) and len(r.json()) >= 1


# ---------------- Analytics / ML ----------------
class TestAnalytics:
    def test_model_metrics(self, admin_session):
        r = admin_session.get(f"{API}/analytics/model", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "models" in d and len(d["models"]) == 2
        names = [m["name"] for m in d["models"]]
        assert "Isolation Forest" in names and "Local Outlier Factor" in names
        for m in d["models"]:
            for k in ("accuracy", "precision", "recall", "f1", "confusion_matrix", "roc", "roc_auc"):
                assert k in m, f"missing {k} in {m['name']}"
            assert 0 <= m["accuracy"] <= 1
        assert "feature_importance" in d and len(d["feature_importance"]) > 0
        assert d.get("selected_model") in names

    def test_analytics_overview(self, admin_session):
        r = admin_session.get(f"{API}/analytics/overview", timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ("top_departments", "common_threats", "login_heatmap", "usb_total", "download_total", "external_email_total"):
            assert k in d
        assert len(d["top_departments"]) > 0
        assert len(d["login_heatmap"]) == 7


# ---------------- Notifications ----------------
class TestNotifications:
    def test_list_and_read_all(self, admin_session):
        r = admin_session.get(f"{API}/notifications", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "notifications" in d and "unread" in d
        assert isinstance(d["notifications"], list)

        r2 = admin_session.post(f"{API}/notifications/read-all", timeout=10)
        assert r2.status_code == 200

        r3 = admin_session.get(f"{API}/notifications", timeout=15)
        assert r3.json()["unread"] == 0


# ---------------- User Management (admin only) ----------------
class TestUserManagement:
    _uid = None

    def test_list_users_as_admin(self, admin_session):
        r = admin_session.get(f"{API}/users", timeout=15)
        assert r.status_code == 200
        users = r.json()
        assert any(u["email"] == ADMIN_EMAIL for u in users)
        assert all("password_hash" not in u for u in users)

    def test_analyst_forbidden_from_users(self, analyst_session):
        r = analyst_session.get(f"{API}/users", timeout=15)
        assert r.status_code == 403

    def test_create_user(self, admin_session):
        email = f"test_user_{uuid.uuid4().hex[:6]}@insiderguard.io"
        r = admin_session.post(
            f"{API}/users",
            json={"name": "Test User", "email": email, "password": "TestPass@123", "role": "analyst"},
            timeout=15,
        )
        assert r.status_code == 200
        u = r.json()
        assert u["email"] == email.lower()  # backend lowercases emails
        TestUserManagement._uid = u["id"]

    def test_update_user(self, admin_session):
        uid = TestUserManagement._uid
        r = admin_session.patch(f"{API}/users/{uid}", json={"status": "Disabled"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["status"] == "Disabled"

    def test_delete_user(self, admin_session):
        uid = TestUserManagement._uid
        r = admin_session.delete(f"{API}/users/{uid}", timeout=15)
        assert r.status_code == 200
        # confirm removed
        r2 = admin_session.get(f"{API}/users", timeout=15)
        assert not any(u["id"] == uid for u in r2.json())

    def test_analyst_cannot_create_user(self, analyst_session):
        r = analyst_session.post(
            f"{API}/users",
            json={"name": "Nope", "email": "nope@x.com", "password": "x", "role": "analyst"},
            timeout=15,
        )
        assert r.status_code == 403


# ---------------- Settings ----------------
class TestSettings:
    def test_get_settings_any_user(self, analyst_session):
        r = analyst_session.get(f"{API}/settings", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "risk_thresholds" in d

    def test_update_settings_admin(self, admin_session):
        # read then bump then restore
        current = admin_session.get(f"{API}/settings", timeout=15).json()
        original = current["risk_thresholds"]
        new_thresh = {"medium": 32, "high": 62, "critical": 82}
        current["risk_thresholds"] = new_thresh
        r = admin_session.put(f"{API}/settings", json=current, timeout=15)
        assert r.status_code == 200
        assert r.json()["risk_thresholds"] == new_thresh
        # restore
        current["risk_thresholds"] = original
        r2 = admin_session.put(f"{API}/settings", json=current, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["risk_thresholds"] == original

    def test_analyst_cannot_update_settings(self, analyst_session):
        r = analyst_session.put(f"{API}/settings", json={"risk_thresholds": {"medium": 30, "high": 60, "critical": 80}}, timeout=15)
        assert r.status_code == 403


# ---------------- Global search ----------------
class TestSearch:
    def test_search(self, admin_session):
        r = admin_session.get(f"{API}/search", params={"q": "EMP"}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "employees" in d and "alerts" in d and "investigations" in d
        assert len(d["employees"]) > 0

    def test_search_empty(self, admin_session):
        r = admin_session.get(f"{API}/search", params={"q": ""}, timeout=10)
        assert r.status_code == 200
        assert r.json() == {"employees": [], "alerts": [], "investigations": []}
