"""
InsiderGuard ML Engine
Feature engineering, anomaly detection (Isolation Forest + Local Outlier Factor),
risk scoring, explainable AI, and model evaluation.
"""
import numpy as np
import pandas as pd
from datetime import datetime

from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, roc_curve, auc,
)

# ------------------------- Config -------------------------
WORK_START = 8   # 8 AM
WORK_END = 19    # 7 PM
FEATURE_COLUMNS = [
    "offhours_logins", "weekend_logins", "avg_downloads", "max_downloads",
    "avg_uploads", "total_failed_logins", "external_email_ratio",
    "usb_usage_count", "restricted_access_count", "distinct_devices",
    "distinct_ips", "avg_session_hours", "vpn_usage_count", "max_external_emails",
]

FEATURE_LABELS = {
    "offhours_logins": "Off-hours logins",
    "weekend_logins": "Weekend logins",
    "avg_downloads": "Average file downloads",
    "max_downloads": "Peak file downloads",
    "avg_uploads": "Average file uploads",
    "total_failed_logins": "Failed login attempts",
    "external_email_ratio": "External email ratio",
    "usb_usage_count": "USB device usage",
    "restricted_access_count": "Restricted folder access",
    "distinct_devices": "Distinct devices used",
    "distinct_ips": "Distinct IP addresses",
    "avg_session_hours": "Average session duration",
    "vpn_usage_count": "VPN usage",
    "max_external_emails": "Peak external emails",
}


def _parse_hour(ts):
    try:
        return datetime.fromisoformat(str(ts)).hour
    except Exception:
        try:
            return int(str(ts).split(":")[0])
        except Exception:
            return 9


def _is_weekend(dstr):
    try:
        return datetime.fromisoformat(str(dstr)[:19]).weekday() >= 5
    except Exception:
        return False


def _session_hours(login, logout):
    try:
        a = datetime.fromisoformat(str(login))
        b = datetime.fromisoformat(str(logout))
        h = (b - a).total_seconds() / 3600.0
        return h if h > 0 else 8.0
    except Exception:
        return 8.0


# ------------------------- Feature Engineering -------------------------
def engineer_features(logs):
    """Aggregate raw activity logs into per-employee behavioural features."""
    df = pd.DataFrame(logs)
    if df.empty:
        return pd.DataFrame()

    rows = []
    for emp_id, g in df.groupby("employee_id"):
        hours = g["login_time"].apply(_parse_hour)
        offhours = int(((hours < WORK_START) | (hours >= WORK_END)).sum())
        weekend = int(g["date"].apply(_is_weekend).sum())
        sessions = [
            _session_hours(l, o)
            for l, o in zip(g["login_time"], g["logout_time"])
        ]
        ext = g["external_emails"].astype(float)
        intn = g["internal_emails"].astype(float)
        total_emails = (ext + intn).replace(0, np.nan)
        ext_ratio = float((ext / total_emails).fillna(0).mean())

        rows.append({
            "employee_id": emp_id,
            "department": g["department"].iloc[0],
            "offhours_logins": offhours,
            "weekend_logins": weekend,
            "avg_downloads": float(g["downloads"].astype(float).mean()),
            "max_downloads": float(g["downloads"].astype(float).max()),
            "avg_uploads": float(g["uploads"].astype(float).mean()),
            "total_failed_logins": int(g["failed_logins"].astype(float).sum()),
            "external_email_ratio": round(ext_ratio, 3),
            "usb_usage_count": int(g["usb_connected"].astype(int).sum()),
            "restricted_access_count": int(g["restricted_access"].astype(int).sum()),
            "distinct_devices": int(g["device"].nunique()),
            "distinct_ips": int(g["ip_address"].nunique()),
            "avg_session_hours": round(float(np.mean(sessions)), 2),
            "vpn_usage_count": int(g["vpn_usage"].astype(int).sum()),
            "max_external_emails": float(ext.max()),
            "log_count": int(len(g)),
        })
    return pd.DataFrame(rows)


# ------------------------- Model Training + Scoring -------------------------
def run_analysis(logs, ground_truth=None):
    """
    Full pipeline: features -> scale -> Isolation Forest + LOF -> risk scores +
    explanations. Returns (employee_results, model_evaluation, feature_frame_records).
    ground_truth: optional dict employee_id -> 0/1 insider label for honest evaluation.
    """
    feats = engineer_features(logs)
    if feats.empty or len(feats) < 3:
        return [], {}, []

    X = feats[FEATURE_COLUMNS].fillna(0).values
    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)

    # ---- Isolation Forest ----
    iso = IsolationForest(n_estimators=200, contamination=0.15, random_state=42)
    iso.fit(Xs)
    iso_scores = -iso.score_samples(Xs)  # higher = more anomalous
    iso_pred = (iso.predict(Xs) == -1).astype(int)

    # ---- Local Outlier Factor ----
    n_neighbors = min(20, max(2, len(feats) - 1))
    lof = LocalOutlierFactor(n_neighbors=n_neighbors, contamination=0.15)
    lof_pred = (lof.fit_predict(Xs) == -1).astype(int)
    lof_scores = -lof.negative_outlier_factor_

    # Normalise anomaly scores to 0..1
    def norm(a):
        a = np.asarray(a, dtype=float)
        rng = a.max() - a.min()
        return (a - a.min()) / rng if rng > 1e-9 else np.zeros_like(a)

    iso_n = norm(iso_scores)
    lof_n = norm(lof_scores)
    anomaly = 0.6 * iso_n + 0.4 * lof_n  # ensemble

    # ---- Rule-based severity signal (weighted feature contributions) ----
    rule = _rule_score(feats)

    # Final risk score 0..100 (blend anomaly + rule signals, softly stretched)
    combined = 0.55 * anomaly + 0.45 * rule
    combined = np.power(combined, 0.85)  # gentle stretch to spread the mid-band
    risk_scores = np.clip(np.round(combined * 108), 0, 100).astype(int)

    results = []
    for i, (_, row) in enumerate(feats.iterrows()):
        score = int(risk_scores[i])
        reasons, evidence = _explain(row)
        results.append({
            "employee_id": row["employee_id"],
            "department": row["department"],
            "risk_score": score,
            "risk_level": risk_level(score),
            "anomaly_score": round(float(anomaly[i]), 4),
            "iso_flag": int(iso_pred[i]),
            "lof_flag": int(lof_pred[i]),
            "features": {k: _clean(row[k]) for k in FEATURE_COLUMNS},
            "reasons": reasons,
            "evidence": evidence,
            "recommended_actions": _recommend(score, reasons),
        })

    # ---- Model Evaluation ----
    # Use provided ground-truth insider labels when available (honest metrics);
    # otherwise fall back to ensemble consensus.
    if ground_truth:
        y_true = np.array([int(ground_truth.get(eid, 0)) for eid in feats["employee_id"]])
        if y_true.sum() == 0 or y_true.sum() == len(y_true):
            y_true = ((iso_pred + lof_pred) >= 1).astype(int)
    else:
        y_true = ((iso_pred + lof_pred) >= 1).astype(int)
    evaluation = _evaluate_models(Xs, y_true, iso_pred, lof_pred, iso_n, feats)

    return results, evaluation, feats.to_dict("records")


def _rule_score(feats):
    """Weighted normalised rule signal per employee (0..1)."""
    def mm(col):
        v = feats[col].astype(float).values
        rng = v.max() - v.min()
        return (v - v.min()) / rng if rng > 1e-9 else np.zeros_like(v)

    weights = {
        "max_downloads": 0.18, "offhours_logins": 0.14, "restricted_access_count": 0.16,
        "usb_usage_count": 0.10, "external_email_ratio": 0.12, "total_failed_logins": 0.10,
        "distinct_devices": 0.06, "distinct_ips": 0.06, "weekend_logins": 0.04,
        "max_external_emails": 0.04,
    }
    total = np.zeros(len(feats))
    for col, w in weights.items():
        total += w * mm(col)
    return np.clip(total, 0, 1)


def _clean(v):
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        return round(float(v), 3)
    return v


def risk_level(score):
    if score >= 81:
        return "Critical"
    if score >= 61:
        return "High"
    if score >= 31:
        return "Medium"
    return "Low"


def _explain(row):
    """Human-readable reasons + evidence based on feature thresholds."""
    reasons, evidence = [], []
    if row["offhours_logins"] >= 2:
        reasons.append(f"Logged in outside working hours {int(row['offhours_logins'])} times")
        evidence.append({"type": "login", "detail": f"{int(row['offhours_logins'])} off-hours sessions detected"})
    if row["weekend_logins"] >= 1:
        reasons.append(f"Accessed systems on weekends {int(row['weekend_logins'])} times")
    if row["max_downloads"] >= 300:
        reasons.append(f"Downloaded up to {int(row['max_downloads'])} files in a single session")
        evidence.append({"type": "download", "detail": f"Peak download volume: {int(row['max_downloads'])} files"})
    if row["restricted_access_count"] >= 1:
        reasons.append(f"Accessed restricted folders {int(row['restricted_access_count'])} times")
        evidence.append({"type": "access", "detail": f"{int(row['restricted_access_count'])} restricted folder access events"})
    if row["usb_usage_count"] >= 2:
        reasons.append(f"Connected USB storage devices {int(row['usb_usage_count'])} times")
        evidence.append({"type": "usb", "detail": f"{int(row['usb_usage_count'])} USB insertion events"})
    if row["external_email_ratio"] >= 0.4:
        reasons.append(f"High external email ratio ({int(row['external_email_ratio']*100)}% of emails external)")
    if row["max_external_emails"] >= 25:
        reasons.append(f"Sent up to {int(row['max_external_emails'])} external emails in a day")
    if row["total_failed_logins"] >= 5:
        reasons.append(f"{int(row['total_failed_logins'])} failed login attempts recorded")
        evidence.append({"type": "auth", "detail": f"{int(row['total_failed_logins'])} failed authentications"})
    if row["distinct_devices"] >= 3:
        reasons.append(f"Used {int(row['distinct_devices'])} different devices")
    if row["distinct_ips"] >= 4:
        reasons.append(f"Logged in from {int(row['distinct_ips'])} distinct IP addresses")
    if row["avg_session_hours"] >= 11:
        reasons.append(f"Unusually long sessions averaging {row['avg_session_hours']}h")
    if not reasons:
        reasons.append("Behaviour is consistent with historical baseline")
    else:
        reasons.append("Risk increased because behaviour significantly differs from historical activity")
    return reasons, evidence


def _recommend(score, reasons):
    if score >= 81:
        return [
            "Immediately suspend account access pending review",
            "Escalate to CISO and open a formal investigation",
            "Preserve endpoint and network logs as evidence",
            "Interview the employee and their line manager",
        ]
    if score >= 61:
        return [
            "Assign a security analyst to investigate",
            "Enable enhanced monitoring on the account",
            "Review recent file transfers and USB activity",
        ]
    if score >= 31:
        return [
            "Add to watchlist for continued monitoring",
            "Verify recent activity with the employee's manager",
        ]
    return ["No action required; continue routine monitoring"]


def _evaluate_models(Xs, y_true, iso_pred, lof_pred, iso_scores, feats):
    """Compute classification metrics for each model vs consensus proxy."""
    models = {}

    def metrics_for(pred, scores, name):
        try:
            cm = confusion_matrix(y_true, pred, labels=[0, 1]).tolist()
            fpr, tpr, _ = roc_curve(y_true, scores)
            roc_auc = float(auc(fpr, tpr)) if len(set(y_true)) > 1 else 0.5
            tn = cm[0][0]; fp = cm[0][1]
            fp_rate = fp / (fp + tn) if (fp + tn) > 0 else 0.0
            return {
                "name": name,
                "accuracy": round(float(accuracy_score(y_true, pred)), 3),
                "precision": round(float(precision_score(y_true, pred, zero_division=0)), 3),
                "recall": round(float(recall_score(y_true, pred, zero_division=0)), 3),
                "f1": round(float(f1_score(y_true, pred, zero_division=0)), 3),
                "confusion_matrix": cm,
                "roc": [{"fpr": round(float(a), 3), "tpr": round(float(b), 3)} for a, b in zip(fpr, tpr)],
                "roc_auc": round(roc_auc, 3),
                "false_positive_rate": round(float(fp_rate), 3),
            }
        except Exception:
            return {"name": name, "accuracy": 0, "precision": 0, "recall": 0, "f1": 0,
                    "confusion_matrix": [[0, 0], [0, 0]], "roc": [], "roc_auc": 0.5,
                    "false_positive_rate": 0}

    iso_m = metrics_for(iso_pred, iso_scores, "Isolation Forest")
    lof_m = metrics_for(lof_pred, iso_scores, "Local Outlier Factor")
    models["models"] = [iso_m, lof_m]

    # Feature importance from Isolation Forest via variance of feature vs anomaly
    importances = []
    for i, col in enumerate(FEATURE_COLUMNS):
        corr = np.corrcoef(Xs[:, i], iso_scores)[0, 1]
        importances.append({"feature": FEATURE_LABELS[col], "importance": round(abs(float(corr)) if not np.isnan(corr) else 0.0, 3)})
    importances.sort(key=lambda x: x["importance"], reverse=True)
    models["feature_importance"] = importances

    # Best model by F1
    best = max(models["models"], key=lambda m: m["f1"])
    models["selected_model"] = best["name"]

    # Anomaly distribution
    scores = (feats["max_downloads"] * 0)  # placeholder not used
    models["anomaly_distribution"] = {
        "anomalies": int((y_true == 1).sum()),
        "normal": int((y_true == 0).sum()),
    }
    return models
